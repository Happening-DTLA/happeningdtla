/**
 * Image storage, on the Supabase project we already pay for.
 *
 * Files never pass through this app. The client asks for a signed URL and then
 * PUTs straight to storage, which is not an optimisation — a serverless
 * function body on Vercel is capped at 4.5MB, and an artist photographing a
 * canvas on a modern phone will exceed that with one image. Proxying uploads
 * would fail in exactly the case the feature exists for.
 *
 * The project reference is derived from the database URL rather than being a
 * second thing to configure and keep in sync. Only the key is a secret.
 */
const BUCKET = "submissions";

/** Everything a phone camera or a scanner realistically produces. */
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

/** Generous for a photograph of a painting, far below anything alarming. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function projectRef(): string | null {
  const raw = process.env.SUPABASE_DIRECT_URL || process.env.DATABASE_URL;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    // Pooled connections carry it as postgres.<ref>; direct ones as the host.
    if (u.username.includes(".")) return u.username.split(".").pop() ?? null;
    if (u.hostname.endsWith(".supabase.co")) return u.hostname.split(".")[0] ?? null;
    return null;
  } catch {
    return null;
  }
}

export function storageConfigured(): boolean {
  return Boolean(projectRef() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function base(): { url: string; key: string } {
  const ref = projectRef();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!ref || !key) {
    throw new Error(
      "Image uploads need SUPABASE_SERVICE_ROLE_KEY. Supabase dashboard → Project Settings → API.",
    );
  }
  return { url: `https://${ref}.supabase.co/storage/v1`, key };
}

/**
 * Makes sure the bucket exists, once.
 *
 * Created here rather than left as a step in a setup document, because a
 * missing bucket surfaces as an opaque 404 at the moment someone is trying to
 * submit — and the failure would be ours, not theirs.
 */
let ensured: Promise<void> | null = null;
async function ensureBucket(): Promise<void> {
  ensured ??= (async () => {
    const { url, key } = base();
    const headers = { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };
    const existing = await fetch(`${url}/bucket/${BUCKET}`, { headers });
    if (existing.ok) return;
    const created = await fetch(`${url}/bucket`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: BUCKET,
        name: BUCKET,
        // Public reads: these images go into an email to the curators and into
        // the app itself, and signing every read would mean URLs that expire
        // inside an inbox someone opens next week.
        public: true,
        file_size_limit: MAX_UPLOAD_BYTES,
        allowed_mime_types: [...ALLOWED],
      }),
    });
    if (!created.ok && created.status !== 409) {
      throw new Error(`Could not create the ${BUCKET} bucket: ${created.status}`);
    }
  })();
  return ensured;
}

export interface SignedUpload {
  /** PUT the file here, with no auth header. */
  uploadUrl: string;
  /** Where it will be readable once the PUT succeeds. Store this. */
  publicUrl: string;
}

/**
 * A one-shot URL for a single file.
 *
 * The path is server-chosen. Letting a client name its own object is how a
 * bucket ends up with someone else's file overwritten, or with a path that
 * escapes its prefix.
 */
export async function signUpload(folder: string, contentType: string): Promise<SignedUpload> {
  if (!ALLOWED.has(contentType)) {
    throw new Error(`${contentType} is not an image type we accept.`);
  }
  await ensureBucket();
  const { url, key } = base();

  const ext = contentType.split("/")[1]!.replace("jpeg", "jpg");
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "misc";
  const path = `${safeFolder}/${crypto.randomUUID()}.${ext}`;

  const res = await fetch(`${url}/object/upload/sign/${BUCKET}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 60 * 30 }),
  });
  if (!res.ok) throw new Error(`Storage refused to sign an upload: ${res.status}`);

  const { url: signedPath } = (await res.json()) as { url: string };
  return {
    uploadUrl: `${url.replace(/\/storage\/v1$/, "")}/storage/v1${signedPath.startsWith("/") ? "" : "/"}${signedPath}`,
    publicUrl: `${url}/object/public/${BUCKET}/${path}`,
  };
}

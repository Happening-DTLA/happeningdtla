import * as ImagePicker from "expo-image-picker";
import { API_BASE_URL } from "@/api";

/**
 * Getting a photograph from the phone into storage.
 *
 * Two hops on purpose. The app asks the server for a one-shot URL and then
 * sends the bytes straight to storage, never through our API — a Vercel
 * function body is capped at 4.5MB and a photograph of a canvas taken on a
 * modern phone will exceed that on its own.
 */
export type Picked = { uri: string; mimeType: string };

/** What the picker gives back, normalised — it reports type inconsistently. */
function mimeOf(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  const ext = asset.uri.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic" || ext === "heif") return `image/${ext}`;
  return "image/jpeg";
}

export async function pickImages(limit: number): Promise<Picked[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error("Photo access is needed to attach images.");

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    // Re-encoded at 82%: the originals are frequently 8MB HEICs, and a
    // curator looking at a wall of submissions on a laptop cannot tell the
    // difference. Uploading the original would mostly cost the artist's data.
    quality: 0.82,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => ({ uri: a.uri, mimeType: mimeOf(a) }));
}

export async function uploadImage(picked: Picked, folder: "portfolio" | "artwork"): Promise<string> {
  const signed = await fetch(`${API_BASE_URL}/api/uploads/sign`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ folder, contentType: picked.mimeType }),
  });
  if (!signed.ok) {
    const body = await signed.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Could not prepare the upload.");
  }
  const { data } = (await signed.json()) as { data: { uploadUrl: string; publicUrl: string } };

  // fetch with a file:// blob is unreliable on iOS for large files; the
  // upload task streams from disk instead of loading it into JS memory.
  const body = await fetch(picked.uri).then((r) => r.blob());
  const put = await fetch(data.uploadUrl, {
    method: "PUT",
    headers: { "content-type": picked.mimeType },
    body,
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status}).`);

  return data.publicUrl;
}

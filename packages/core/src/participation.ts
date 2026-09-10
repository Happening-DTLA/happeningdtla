/**
 * Entertainment and volunteer sign-ups.
 *
 * The two free ways to take part. Shaped to the organisers' own forms at
 * dtlaartnight.com/entertainers-submission and /volunteer-submission, and in
 * core for the same reason the other two are: the mobile form and the API have
 * to agree on the shape exactly.
 */

/** Their three options, in their order and their words. */
export const ENTERTAINER_FEE_PREFERENCES = [
  { value: "FEE_REQUIRED", label: "Fee required" },
  { value: "VOLUNTEER", label: "Happy to volunteer" },
  { value: "OTHER", label: "Other" },
] as const;

export type EntertainerFeePreference = (typeof ENTERTAINER_FEE_PREFERENCES)[number]["value"];

export const ENTERTAINER_FEE_LABELS: Record<EntertainerFeePreference, string> = Object.fromEntries(
  ENTERTAINER_FEE_PREFERENCES.map((f) => [f.value, f.label]),
) as Record<EntertainerFeePreference, string>;

export interface EntertainmentSubmissionInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** "Band or Artist Name" on their form. */
  actName: string;
  /** Optional — a live painter is not a music act. */
  performanceType?: string | null;
  /** Instagram, YouTube or other. Free text: usually a handle, not a URL. */
  links: string;
  /** Required. The organisers use it in event marketing. */
  promoImageUrl: string;
  feePreference: EntertainerFeePreference;
  /** Only meaningful when feePreference is OTHER. */
  feeNote?: string | null;
  consent: boolean;
}

/** Their five roles, as checkboxes — a volunteer may pick several. */
export const VOLUNTEER_ROLES = [
  { value: "INFORMATION_BOOTH", label: "Information booth" },
  { value: "DOOR_ATTENDANT", label: "Door attendant" },
  { value: "BLOCK_ENTERTAINMENT", label: "Block entertainment" },
  { value: "GALLERY_ASSISTANT", label: "Gallery assistant" },
  { value: "RUNNER", label: "Runner" },
] as const;

export type VolunteerRole = (typeof VOLUNTEER_ROLES)[number]["value"];

export const VOLUNTEER_ROLE_LABELS: Record<VolunteerRole, string> = Object.fromEntries(
  VOLUNTEER_ROLES.map((r) => [r.value, r.label]),
) as Record<VolunteerRole, string>;

/** Their rule, stated on the submissions page: volunteers must be 18 or over. */
export const VOLUNTEER_MIN_AGE = 18;

/**
 * Why this app does not ask for a photo of your driving licence.
 *
 * Their web form requires uploading a California/US ID to check age. Ours asks
 * you to confirm you are 18 instead, because the bucket these uploads go to is
 * public — an identity document put there would sit on a URL anyone could
 * read. Collecting one needs private storage, signed reads and a privacy
 * policy that mentions it. Age is checked in person on the night anyway, which
 * is the moment it matters.
 */
export const VOLUNTEER_ID_NOTE =
  `Volunteers must be ${VOLUNTEER_MIN_AGE} or over. Bring photo ID on the night — ` +
  `we don't collect it here.`;

export interface VolunteerSubmissionInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** Free text: "after 4pm on weekdays" is a real answer no dropdown holds. */
  bestTimeToReach: string;
  roles: VolunteerRole[];
  /** Must be true. The fact their ID upload was establishing. */
  isAdult: boolean;
  consent: boolean;
}

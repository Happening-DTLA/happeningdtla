import { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const PROFILE_TYPES = ["ATTENDEE", "ARTIST", "VENUE"] as const;
export type ProfileType = (typeof PROFILE_TYPES)[number];

export const PROFILE_COPY: Record<ProfileType, { label: string; blurb: string }> = {
  ATTENDEE: { label: "Attendee", blurb: "You're here to walk the night." },
  ARTIST: { label: "Artist", blurb: "You make work and want to exhibit." },
  VENUE: { label: "Venue", blurb: "You have a space and want to host." },
};

/**
 * What this person is here to do.
 *
 * Held on the device for now, and that is a stopgap with a known shape rather
 * than a design. The real home for this is the User row the server already
 * has a column for — it is set the moment someone submits an application —
 * but the app has no sign-in yet, so there is no account to read it from.
 *
 * Deliberately not a permission: choosing "artist" reveals the submission
 * module, it does not grant anything. Nothing here is trusted by the server,
 * which validates every application on its own terms regardless of what the
 * device claims to be. When onboarding lands, this store keeps its interface
 * and starts reading from the account instead.
 */
const KEY = "profile-type/v1";

type Store = { profileType: ProfileType; setProfileType: (t: ProfileType) => void; ready: boolean };

const Ctx = createContext<Store>({ profileType: "ATTENDEE", setProfileType: () => {}, ready: false });

export function ProfileTypeProvider({ children }: { children: React.ReactNode }) {
  const [profileType, setType] = useState<ProfileType>("ATTENDEE");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY)
      .then((stored) => {
        if (!active) return;
        if (stored && (PROFILE_TYPES as readonly string[]).includes(stored)) {
          setType(stored as ProfileType);
        }
      })
      .catch(() => {})
      .finally(() => active && setReady(true));
    return () => { active = false; };
  }, []);

  const value = useMemo<Store>(
    () => ({
      profileType,
      ready,
      setProfileType: (t) => {
        setType(t);
        // Not awaited: the choice should feel instant, and a failed write
        // costs one re-selection rather than anything irreversible.
        AsyncStorage.setItem(KEY, t).catch(() => {});
      },
    }),
    [profileType, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useProfileType = () => useContext(Ctx);

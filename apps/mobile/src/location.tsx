import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";
import type { LatLng } from "@dtlahappening/core";

/**
 * Where the person is, shared by every screen that has a use for it.
 *
 * Deliberately does NOT ask on mount. A permission dialog thrown at someone
 * three seconds into their first launch, before the app has shown what it is
 * for, is the reliable way to get a permanent "no" — and once denied, iOS will
 * not ask again from inside the app. So this only ever prompts when something
 * asks it to, which means a screen that wants distances has to offer the
 * person a reason first.
 *
 * If permission was already granted on a previous run it starts watching
 * straight away, because that question has been answered.
 */
type Status = "unknown" | "granted" | "denied";

type Store = {
  coords: LatLng | null;
  status: Status;
  /** Prompts if it has not been asked. Returns whether we ended up with access. */
  request: () => Promise<boolean>;
};

const Ctx = createContext<Store>({ coords: null, status: "unknown", request: async () => false });

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<Status>("unknown");
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      subscription.current?.remove();
      subscription.current = null;
    };
  }, []);

  const startWatching = useCallback(async () => {
    if (subscription.current) return;
    // Watched rather than sampled once: this is a map for walking a mile of
    // Downtown over an evening, and a fix taken when a screen opened is wrong
    // by the second block. Ten metres is about a doorway.
    subscription.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
      (position) => {
        if (mounted.current) {
          setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        }
      },
    );
    if (!mounted.current) {
      subscription.current.remove();
      subscription.current = null;
    }
  }, []);

  // Already answered on a previous run — no dialog, just start.
  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then((p) => {
        if (!mounted.current || !p.granted) return;
        setStatus("granted");
        return startWatching();
      })
      .catch(() => {});
  }, [startWatching]);

  const request = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        if (mounted.current) setStatus("denied");
        return false;
      }
      if (mounted.current) setStatus("granted");
      await startWatching();
      return true;
    } catch {
      return false;
    }
  }, [startWatching]);

  const value = useMemo<Store>(() => ({ coords, status, request }), [coords, status, request]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLocation = () => useContext(Ctx);

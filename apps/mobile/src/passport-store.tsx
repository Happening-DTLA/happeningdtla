import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Crypto from "expo-crypto";
import type { Stamp } from "@dtlahappening/core";
import { API_BASE_URL } from "@/api";
import { createPassportSyncQueue } from "@/passport-sync-queue";

/**
 * Stamps collected on the night.
 *
 * The device is the source of truth, not the server, and that is the whole
 * design rather than a shortcut around not having sign-in. Cell service in a
 * ground-floor gallery on Spring Street is bad and in a basement it is absent;
 * a passport that needs the network to stamp a door is a passport that fails
 * in the exact room it exists for. So a stamp is written locally and is
 * immediately real, and the server hears about it whenever it can.
 *
 * The sync is best-effort and one-way. Nothing the server says can remove a
 * stamp — losing someone's evening because a request failed would be far
 * worse than a count being slightly behind.
 */
const KEY = "passport/v1";
const DEVICE_KEY = "passport/device/v1";

type Store = {
  stamps: Stamp[];
  ready: boolean;
  /** Venue ids stamped for a given night, for the card to read cheaply. */
  stampedFor: (nightId: string) => Set<string>;
  add: (stamp: Omit<Stamp, "at">) => Promise<void>;
  /** Removes one, for a mis-tap. Their record, their call. */
  remove: (venueId: string, nightId: string) => Promise<void>;
};

const Ctx = createContext<Store>({
  stamps: [],
  ready: false,
  stampedFor: () => new Set(),
  add: async () => {},
  remove: async () => {},
});

/**
 * An anonymous, per-install id.
 *
 * Exists so venue footfall can be counted without knowing who anyone is: it is
 * a random value generated on this device, tied to no account, no contact
 * detail and nothing that identifies a person. Reinstalling produces a new one,
 * which is the correct trade — a stable identifier that survived reinstalls
 * would be a tracking id, and counting visits does not need one.
 */
async function deviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const fresh = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_KEY, fresh);
  return fresh;
}

const reports = createPassportSyncQueue({
  storage: AsyncStorage,
  send: async (stamp) => {
    const device = await deviceId();
    const res = await fetch(`${API_BASE_URL}/api/checkins`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deviceId: device,
        venueId: stamp.venueId,
        nightId: stamp.nightId,
        at: stamp.at,
        verified: stamp.verified,
      }),
    });
    if (!res.ok) throw new Error(String(res.status));
  },
});

export function PassportProvider({ children }: { children: React.ReactNode }) {
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!active || !raw) return;
        const parsed = JSON.parse(raw) as Stamp[];
        if (Array.isArray(parsed)) setStamps(parsed);
      })
      // A corrupt store is not a reason to lose the app. Start empty.
      .catch(() => {})
      .finally(() => active && setReady(true));
    return () => { active = false; };
  }, []);

  const drainReports = useCallback(() => {
    void reports.drain().catch(() => {
      // Storage and network failures are expected here. The durable queue is
      // left intact and another lifecycle or connectivity event will retry it.
    });
  }, []);

  useEffect(() => {
    drainReports();

    const network = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) drainReports();
    });
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") drainReports();
    });

    return () => {
      network();
      appState.remove();
    };
  }, [drainReports]);

  const persist = useCallback(async (next: Stamp[]) => {
    setStamps(next);
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Written to state regardless: the stamp is real for this session even
      // if the disk write failed, and the alternative is telling someone their
      // check-in did not happen when they are standing in the room.
    }
  }, []);

  const add = useCallback(
    async (stamp: Omit<Stamp, "at">) => {
      const full: Stamp = { ...stamp, at: new Date().toISOString() };
      const already = stamps.some(
        (s) => s.venueId === full.venueId && s.nightId === full.nightId,
      );
      if (already) return;

      await persist([...stamps, full]);
      await reports.enqueue(full);
      drainReports();
    },
    [stamps, persist, drainReports],
  );

  const remove = useCallback(
    async (venueId: string, nightId: string) => {
      await persist(stamps.filter((s) => !(s.venueId === venueId && s.nightId === nightId)));
      await reports.discard(venueId, nightId);
    },
    [stamps, persist],
  );

  const stampedFor = useCallback(
    (nightId: string) =>
      new Set(stamps.filter((s) => s.nightId === nightId).map((s) => s.venueId)),
    [stamps],
  );

  const value = useMemo<Store>(
    () => ({ stamps, ready, stampedFor, add, remove }),
    [stamps, ready, stampedFor, add, remove],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePassport = () => useContext(Ctx);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ApiEventSummary } from "@dtlahappening/core";

/**
 * Saved events, on this device.
 *
 * There is no account to hang these on: mobile has no auth at all, because
 * `@clerk/clerk-expo` needs a native module Expo Go does not ship. So likes
 * follow the same shape as `orders-store` — the device remembers, and when
 * accounts arrive these get claimed onto the signed-in user. `EventInterest`
 * already exists in the schema, unique on (userId, eventId), which is exactly
 * one row per entry here.
 *
 * AsyncStorage rather than SecureStore, deliberately. SecureStore is the
 * Keychain and is for secrets — an order's access token is one, a list of
 * events someone likes is not. It also caps individual values on some
 * platforms, and this list grows.
 *
 * The whole event summary is stored, not just an id. There is no bulk
 * "events by id" endpoint, so ids alone would mean one request per saved
 * event before anything could render; the snapshot draws instantly and works
 * with no signal, which matters in a basement. It goes stale, so opening an
 * event refreshes its copy.
 */
const KEY = "dtlahappening.likes.v1";

/** Bounds the stored blob. Nobody curates 200 saved events; a runaway list is a bug. */
const LIMIT = 200;

export interface LikedEvent {
  event: ApiEventSummary;
  /** ISO instant. Newest first is the order the list is shown in. */
  likedAt: string;
}

interface LikesValue {
  liked: LikedEvent[];
  isLiked: (eventId: string) => boolean;
  toggle: (event: ApiEventSummary) => void;
  /** Replaces a stored snapshot with fresher data, if this event is saved. */
  refreshSnapshot: (event: ApiEventSummary) => void;
  /** False until the store has been read, so the UI doesn't flash "empty". */
  ready: boolean;
}

/**
 * Narrows an event to exactly the fields the saved list renders.
 *
 * Fields are picked by hand, the same discipline `apps/web/src/lib/dto.ts`
 * applies at the API boundary. The detail screen hands over a full `ApiEvent`
 * carrying ticket tiers and descriptions; spreading that would quietly write
 * several kilobytes per like to disk and make two saves of the same event
 * hold different shapes depending on which screen the heart was tapped on.
 */
function toSnapshot(e: ApiEventSummary): ApiEventSummary {
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    imageUrl: e.imageUrl,
    doorsAt: e.doorsAt,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    minAge: e.minAge,
    category: e.category,
    isFree: e.isFree,
    fromPriceCents: e.fromPriceCents,
    fromAllInCents: e.fromAllInCents,
    soldOut: e.soldOut,
    venue: e.venue,
    organizer: e.organizer,
  };
}

const LikesContext = createContext<LikesValue | null>(null);

export function LikesProvider({ children }: { children: ReactNode }) {
  const [liked, setLiked] = useState<LikedEvent[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        // A corrupt store should not brick the app — start empty rather than throw.
        if (active && Array.isArray(parsed)) setLiked(parsed as LikedEvent[]);
      } catch {
        /* unreadable store: fall through to empty */
      }
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((next: LikedEvent[]) => {
    // State first so the heart fills on the same frame as the tap. A write
    // that fails leaves the UI ahead of disk until the next launch, which is
    // the right trade for a like.
    setLiked(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const likedIds = useMemo(
    () => new Set(liked.map((l) => l.event.id)),
    [liked],
  );

  const isLiked = useCallback((eventId: string) => likedIds.has(eventId), [likedIds]);

  const toggle = useCallback(
    (event: ApiEventSummary) => {
      const next = likedIds.has(event.id)
        ? liked.filter((l) => l.event.id !== event.id)
        : [
            { event: toSnapshot(event), likedAt: new Date().toISOString() },
            ...liked,
          ].slice(0, LIMIT);
      persist(next);
    },
    [liked, likedIds, persist],
  );

  const refreshSnapshot = useCallback(
    (event: ApiEventSummary) => {
      const current = liked.find((l) => l.event.id === event.id);
      if (!current) return;
      const snapshot = toSnapshot(event);
      // Bail when nothing changed. Without this, a caller that refreshes in an
      // effect keyed on this function would loop: writing changes `liked`,
      // which rebuilds the callback, which fires the effect again.
      if (JSON.stringify(current.event) === JSON.stringify(snapshot)) return;
      persist(
        liked.map((l) =>
          l.event.id === event.id ? { ...l, event: snapshot } : l,
        ),
      );
    },
    [liked, persist],
  );

  const value = useMemo(
    () => ({ liked, isLiked, toggle, refreshSnapshot, ready }),
    [liked, isLiked, toggle, refreshSnapshot, ready],
  );

  return <LikesContext.Provider value={value}>{children}</LikesContext.Provider>;
}

export function useLikes(): LikesValue {
  const value = useContext(LikesContext);
  if (!value) throw new Error("useLikes must be used inside <LikesProvider>");
  return value;
}

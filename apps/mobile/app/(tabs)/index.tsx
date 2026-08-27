import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import type { EventCategory } from "@dtlahappening/core";
import { EVENT_CATEGORIES } from "@dtlahappening/core";
import { api } from "@/api";
import { useAsync } from "@/useAsync";
import { theme, space } from "@/theme";
import {
  CategoryChips,
  EmptyState,
  ErrorState,
  EventCard,
  Label,
  Loading,
  NightCard,
} from "@/components";

/**
 * Explore. The city-wide night leads, because "what's happening" is the
 * question people actually open this app with — a search box would make them
 * do the work of already knowing.
 *
 * The night is one card rather than its dozen events laid out flat. Art Night
 * is a crawl and belongs on screen as a single thing you decide to attend;
 * `n/[slug]` is where its events live. Everything below the card is what is on
 * in Downtown that is NOT part of the night.
 */
export default function ExploreScreen() {
  const [category, setCategory] = useState<EventCategory | null>(null);

  const nightFetcher = useCallback((s: AbortSignal) => api.upcomingNight(s), []);
  const night = useAsync(nightFetcher);

  const upcomingFetcher = useCallback((s: AbortSignal) => api.search({}, s), []);
  const upcoming = useAsync(upcomingFetcher);

  // Events already inside the night are not repeated below it.
  const laterEvents = useMemo(() => {
    const nightIds = new Set((night.data?.events ?? []).map((e) => e.id));
    const rest = (upcoming.data?.events ?? []).filter((e) => !nightIds.has(e.id));
    return category ? rest.filter((e) => e.category === category) : rest;
  }, [upcoming.data, night.data, category]);

  const retry = () => {
    night.retry();
    upcoming.retry();
  };

  if (night.status === "loading" || upcoming.status === "loading") return <Loading />;

  // Only the events list is load-bearing. /api/nights/upcoming 404s when no
  // night is scheduled, and a between-nights month must not turn the whole
  // screen into an error — it just means there is no card to show.
  if (upcoming.status === "error") {
    return <ErrorState message={upcoming.error.message} onRetry={retry} />;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingBottom: space.xxl * 2 }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={retry} tintColor={theme.textMuted} />
      }
    >
      {night.data ? (
        <View style={{ padding: space.lg, paddingBottom: space.sm }}>
          <NightCard night={night.data} />
        </View>
      ) : null}

      <View style={{ paddingVertical: space.sm }}>
        <CategoryChips categories={EVENT_CATEGORIES} selected={category} onSelect={setCategory} />
      </View>

      {laterEvents.length === 0 ? (
        <EmptyState
          title={category ? "Nothing else in that category" : "Nothing else on yet"}
          body={
            night.data
              ? "Everything scheduled right now is part of the night above."
              : "Check back soon — new events are added as venues confirm them."
          }
        />
      ) : (
        <View style={{ marginTop: space.lg }}>
          <View style={{ marginBottom: space.sm, paddingHorizontal: space.lg }}>
            <Label>{night.data ? "Also on in Downtown" : "Coming up in Downtown"}</Label>
          </View>
          {/* No gap: the rows carry their own rules, and a continuous ruled
              list is the point — spacing them apart turns it back into cards. */}
          {laterEvents.map((e) => (
            <EventCard key={e.id} event={e} showDate />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

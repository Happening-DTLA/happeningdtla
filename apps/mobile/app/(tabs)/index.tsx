import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import type { ApiEventSummary, EventCategory } from "@dtlahappening/core";
import { EVENT_CATEGORIES, formatCalendarDate } from "@dtlahappening/core";
import { api } from "@/api";
import { useAsync } from "@/useAsync";
import { theme, space } from "@/theme";
import { CategoryChips, EmptyState, ErrorState, EventCard, Label, Loading } from "@/components";

/**
 * Explore. The city-wide night leads, because "what's happening" is the
 * question people actually open this app with — a search box would make them
 * do the work of already knowing.
 */
export default function ExploreScreen() {
  const [category, setCategory] = useState<EventCategory | null>(null);

  const nightFetcher = useCallback((s: AbortSignal) => api.upcomingNight(s), []);
  const night = useAsync(nightFetcher);

  const upcomingFetcher = useCallback((s: AbortSignal) => api.search({}, s), []);
  const upcoming = useAsync(upcomingFetcher);

  const loading = night.status === "loading" || upcoming.status === "loading";
  const error = night.error ?? upcoming.error;

  const nightEvents = useMemo(() => {
    const events = night.data?.events ?? [];
    return category ? events.filter((e) => e.category === category) : events;
  }, [night.data, category]);

  const laterEvents = useMemo(() => {
    const nightIds = new Set((night.data?.events ?? []).map((e) => e.id));
    const rest = (upcoming.data?.events ?? []).filter((e) => !nightIds.has(e.id));
    return category ? rest.filter((e) => e.category === category) : rest;
  }, [upcoming.data, night.data, category]);

  const retry = () => {
    night.retry();
    upcoming.retry();
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error.message} onRetry={retry} />;

  const byNeighborhood = new Map<string, ApiEventSummary[]>();
  for (const e of nightEvents) {
    const key = e.venue.neighborhood ?? "Downtown";
    byNeighborhood.set(key, [...(byNeighborhood.get(key) ?? []), e]);
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
        <View style={{ gap: space.sm, padding: space.lg, paddingBottom: space.md }}>
          <Text style={{ color: theme.accent, fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase" }}>
            Next city-wide night
          </Text>
          <Text style={{ color: theme.text, fontSize: 32, fontWeight: "700", lineHeight: 36 }}>
            {night.data.name.split("—")[0].trim()}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 17 }}>
            {formatCalendarDate(night.data.date)}
          </Text>
          {night.data.description ? (
            <Text style={{ color: theme.textMuted, fontSize: 15, lineHeight: 22 }}>
              {night.data.description}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ paddingVertical: space.sm }}>
        <CategoryChips categories={EVENT_CATEGORIES} selected={category} onSelect={setCategory} />
      </View>

      {nightEvents.length === 0 && category ? (
        <EmptyState
          title="Nothing in that category that night"
          body="Try another category, or clear the filter to see the whole night."
        />
      ) : (
        [...byNeighborhood.entries()].map(([neighborhood, events]) => (
          <View key={neighborhood} style={{ marginTop: space.lg, paddingHorizontal: space.lg }}>
            <View style={{ marginBottom: space.md }}>
              <Label>{neighborhood}</Label>
            </View>
            <View style={{ gap: space.md }}>
              {events.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </View>
          </View>
        ))
      )}

      {laterEvents.length > 0 ? (
        <View style={{ marginTop: space.xxl, paddingHorizontal: space.lg }}>
          <View style={{ marginBottom: space.md }}>
            <Label>Coming up in Downtown</Label>
          </View>
          <View style={{ gap: space.md }}>
            {laterEvents.map((e) => (
              <EventCard key={e.id} event={e} showDate />
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

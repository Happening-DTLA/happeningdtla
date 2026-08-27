import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { ApiEventSummary, EventCategory } from "@dtlahappening/core";
import {
  EVENT_CATEGORIES,
  formatCalendarDate,
  shortNightName,
} from "@dtlahappening/core";
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
} from "@/components";

/**
 * One city-wide night, and everything inside it.
 *
 * Grouped by neighbourhood rather than by time, because the decision this
 * screen supports is a route, not a schedule — on a crawl you pick a part of
 * Downtown and work through it, and things overlap on purpose. The map tab
 * answers the same question geographically.
 */
export default function NightScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [category, setCategory] = useState<EventCategory | null>(null);

  const fetcher = useCallback((s: AbortSignal) => api.night(slug, s), [slug]);
  const { status, data: night, error, retry } = useAsync(fetcher, [slug]);

  const events = useMemo(() => {
    const all = night?.events ?? [];
    return category ? all.filter((e) => e.category === category) : all;
  }, [night, category]);

  const venueCount = useMemo(
    () => new Set((night?.events ?? []).map((e) => e.venue.id)).size,
    [night],
  );

  if (status === "loading") return <Loading />;
  if (status === "error") return <ErrorState message={error.message} onRetry={retry} />;

  const byNeighborhood = new Map<string, ApiEventSummary[]>();
  for (const e of events) {
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
      <View style={{ gap: space.sm, padding: space.lg, paddingBottom: space.md }}>
        <Text
          style={{
            color: theme.accent,
            fontSize: 11,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            fontWeight: "700",
          }}
        >
          City-wide night
        </Text>
        <Text style={{ color: theme.text, fontSize: 32, fontWeight: "700", lineHeight: 36 }}>
          {shortNightName(night.name)}
        </Text>
        <Text style={{ color: theme.text, fontSize: 17 }}>
          {formatCalendarDate(night.date)}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 14 }}>
          {night.events.length} {night.events.length === 1 ? "event" : "events"} across{" "}
          {venueCount} {venueCount === 1 ? "venue" : "venues"}
        </Text>
        {night.description ? (
          <Text style={{ color: theme.textMuted, fontSize: 15, lineHeight: 22 }}>
            {night.description}
          </Text>
        ) : null}
      </View>

      <View style={{ paddingVertical: space.sm }}>
        <CategoryChips categories={EVENT_CATEGORIES} selected={category} onSelect={setCategory} />
      </View>

      {events.length === 0 ? (
        <EmptyState
          title="Nothing in that category that night"
          body="Try another category, or clear the filter to see the whole night."
        />
      ) : (
        [...byNeighborhood.entries()].map(([neighborhood, list]) => (
          <View key={neighborhood} style={{ marginTop: space.lg }}>
            <View style={{ marginBottom: space.sm, paddingHorizontal: space.lg }}>
              <Label>{neighborhood}</Label>
            </View>
            {list.map((e, i) => (
              <EventCard key={e.id} event={e} index={i} />
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

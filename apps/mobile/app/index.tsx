import { useCallback } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { ApiEventSummary } from "@dtlahappening/core";
import { formatCalendarDate, formatCents, formatTimeRange } from "@dtlahappening/core";
import { api } from "@/api";
import { useAsync } from "@/useAsync";
import { theme, space } from "@/theme";
import { ErrorState, Label, Loading } from "@/components";

export default function NightScreen() {
  const fetcher = useCallback((signal: AbortSignal) => api.upcomingNight(signal), []);
  const { status, data: night, error, retry } = useAsync(fetcher);

  if (status === "loading") return <Loading />;
  if (status === "error") return <ErrorState message={error.message} onRetry={retry} />;

  // Group by neighborhood — on Art Night people plan by where they'll walk,
  // not by start time.
  const groups = new Map<string, ApiEventSummary[]>();
  for (const event of night.events) {
    const key = event.venue.neighborhood ?? "Downtown";
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2 }}
    >
      <View style={{ gap: space.sm, marginBottom: space.xl }}>
        <Text style={{ color: theme.accent, fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase" }}>
          Next city-wide night
        </Text>
        <Text style={{ color: theme.text, fontSize: 32, fontWeight: "700", lineHeight: 36 }}>
          {night.name.split("—")[0].trim()}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 17 }}>
          {formatCalendarDate(night.date)}
        </Text>
        {night.description ? (
          <Text style={{ color: theme.textMuted, fontSize: 15, lineHeight: 22, marginTop: space.xs }}>
            {night.description}
          </Text>
        ) : null}
      </View>

      {[...groups.entries()].map(([neighborhood, events]) => (
        <View key={neighborhood} style={{ marginBottom: space.xl }}>
          <View style={{ marginBottom: space.md }}>
            <Label>{neighborhood}</Label>
          </View>
          <View style={{ gap: space.md }}>
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function EventCard({ event }: { event: ApiEventSummary }) {
  const router = useRouter();
  return (
    // Navigating imperatively rather than with <Link asChild>. asChild clones
    // the child into an <a>, and the Pressable's style function is dropped in
    // the process — the card renders with no background, border or row layout.
    <Pressable
      onPress={() => router.push(`/e/${event.slug}`)}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: pressed ? theme.surface2 : theme.surface,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: space.lg,
        flexDirection: "row",
        justifyContent: "space-between",
        gap: space.lg,
        })}
      >
        <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>
          {event.title}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 14 }} numberOfLines={1}>
          {event.venue.name}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 12, fontVariant: ["tabular-nums"] }}>
          {formatTimeRange(event.startsAt, event.endsAt)}
          {event.minAge ? ` · ${event.minAge}+` : ""}
        </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
        {event.soldOut ? (
          <Text style={{ color: theme.danger, fontSize: 13 }}>Sold out</Text>
        ) : event.isFree ? (
          <Text style={{ color: theme.accent, fontSize: 15, fontWeight: "700" }}>Free</Text>
        ) : (
          <>
            <Text style={{ color: theme.accent, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
              {formatCents(event.fromAllInCents ?? 0)}
            </Text>
            {/* All-in on the very first surface — no fee reveal at checkout. */}
            <Text style={{ color: theme.textMuted, fontSize: 10 }}>all-in</Text>
          </>
        )}
        </View>
    </Pressable>
  );
}

import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import type { ApiEventSummary } from "@dtlahappening/core";
import { formatCalendarDate, shortNightName } from "@dtlahappening/core";
import { api } from "@/api";
import { useAsync } from "@/useAsync";
import { theme, space, radius, type, inkOn } from "@/theme";
import { ErrorState, EmptyState, Loading, Reveal } from "@/components";
import { countVenues, groupByCorridor } from "@/corridors";


/**
 * One destination on the crawl.
 *
 * Set as a listing, not an event card. On a night where fifty doors open at
 * once, every card would repeat the same time and the same "FREE" — noise that
 * buries the only thing that differs, which is the name and the street.
 */
function Destination({
  event,
  color,
  index,
}: {
  event: ApiEventSummary;
  color: string;
  index: number;
}) {
  const router = useRouter();
  const pinned = event.venue.lat !== null && event.venue.lng !== null;

  return (
    <Reveal index={index}>
      <Pressable
        onPress={() => router.push(`/e/${event.slug}`)}
        accessibilityRole="button"
        accessibilityLabel={`${event.venue.name}, ${event.venue.address1}`}
        style={({ pressed }) => ({
          backgroundColor: pressed ? theme.surface : "transparent",
          borderTopColor: theme.border,
          borderTopWidth: 1,
          paddingVertical: space.md,
          paddingHorizontal: space.lg,
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
        })}
      >
        {/* The corridor's colour, carried down to every row beneath its
            heading, so a glance anywhere in the list says which street. */}
        <View style={{ width: 3, alignSelf: "stretch", backgroundColor: color }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.heading, { color: theme.text }]} numberOfLines={1}>
            {event.venue.name}
          </Text>
          <Text style={[type.meta, { color: theme.textMuted }]} numberOfLines={1}>
            {event.venue.address1}
          </Text>
        </View>
        {/* Says whether this one can be found on the map. Silence would be a
            small lie on a screen whose whole job is helping someone walk. */}
        {pinned ? (
          <Ionicons name="location" size={14} color={theme.textMuted} />
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={theme.border} />
      </Pressable>
    </Reveal>
  );
}

export default function NightScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [only, setOnly] = useState<string | null>(null);

  const fetcher = useCallback((s: AbortSignal) => api.night(slug, s), [slug]);
  const { status, data: night, error, retry } = useAsync(fetcher, [slug]);

  const groups = useMemo(() => groupByCorridor(night?.events ?? []), [night]);
  const shown = only ? groups.filter((g) => g.corridor.slug === only) : groups;

  if (status === "loading") return <Loading />;
  if (status === "error") return <ErrorState message={error.message} onRetry={retry} />;

  const destinations = countVenues(night.events);
  const pinned = groups.reduce((n, g) => n + g.pinned, 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingBottom: space.xxl * 2 }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={retry} tintColor={theme.textMuted} />
      }
    >
      <View style={{ padding: space.lg, paddingBottom: space.md, gap: space.sm }}>
        <Text style={[type.label, { color: theme.accent }]}>City-wide night</Text>
        <Text style={[type.poster, { color: theme.text }]}>{shortNightName(night.name)}</Text>
        <Text style={[type.heading, { color: theme.text }]}>
          {formatCalendarDate(night.date)}
        </Text>
        <View style={{ height: 1, backgroundColor: theme.border, marginVertical: space.xs }} />
        <Text style={[type.meta, { color: theme.textMuted }]}>
          {destinations} destinations across {groups.length}{" "}
          {groups.length === 1 ? "corridor" : "corridors"}
          {pinned < destinations ? ` · ${pinned} on the map` : ""}
        </Text>
        {night.description ? (
          <Text style={[type.body, { color: theme.textMuted }]}>{night.description}</Text>
        ) : null}
      </View>

      {/* The poster's key, made operable. Tapping a corridor is how someone
          decides which stretch of Downtown to walk tonight. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm }}
      >
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setOnly(null);
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: only === null }}
          style={{
            backgroundColor: only === null ? theme.text : "transparent",
            borderColor: only === null ? theme.text : theme.border,
            borderWidth: 1,
            borderRadius: radius.pill,
            paddingVertical: 7,
            paddingHorizontal: 14,
          }}
        >
          <Text style={[type.label, { color: only === null ? theme.bg : theme.textMuted }]}>
            All {destinations}
          </Text>
        </Pressable>

        {groups.map((g) => {
          const active = only === g.corridor.slug;
          return (
            <Pressable
              key={g.corridor.slug}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setOnly(active ? null : g.corridor.slug);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${g.corridor.name}, ${g.events.length} destinations`}
              style={{
                backgroundColor: active ? g.corridor.color : "transparent",
                borderColor: g.corridor.color,
                borderWidth: 1,
                borderRadius: radius.pill,
                paddingVertical: 7,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
              }}
            >
              {!active ? (
                <View
                  style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: g.corridor.color }}
                />
              ) : null}
              <Text
                style={[
                  type.label,
                  { color: active ? inkOn(g.corridor.color) : theme.text },
                ]}
              >
                {g.corridor.name.replace(" Corridor", "")}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {shown.length === 0 ? (
        <EmptyState title="Nothing listed there" body="Pick another corridor, or show them all." />
      ) : (
        shown.map((g) => (
          <View key={g.corridor.slug} style={{ marginTop: space.lg }}>
            {/* The key's colour block, lifted straight off the poster. */}
            <View
              style={{
                backgroundColor: g.corridor.color,
                marginHorizontal: space.lg,
                paddingVertical: space.sm,
                paddingHorizontal: space.md,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: space.md,
              }}
            >
              <Text style={[type.heading, { color: inkOn(g.corridor.color), flex: 1 }]}>
                {g.corridor.name}
              </Text>
              <Text style={[type.label, { color: inkOn(g.corridor.color) }]}>
                {g.events.length} {g.events.length === 1 ? "stop" : "stops"}
              </Text>
            </View>
            {g.corridor.along ? (
              <Text
                style={[
                  type.label,
                  { color: theme.textMuted, paddingHorizontal: space.lg, paddingTop: space.sm },
                ]}
              >
                Along {g.corridor.along}
                {g.pinned < g.events.length ? ` · ${g.pinned} of ${g.events.length} mapped` : ""}
              </Text>
            ) : null}
            <View style={{ marginTop: space.sm }}>
              {g.events.map((e, i) => (
                <Destination key={e.id} event={e} color={g.corridor.color} index={i} />
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

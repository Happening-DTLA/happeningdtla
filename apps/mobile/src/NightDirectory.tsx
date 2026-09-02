import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import type { ApiEventSummary, ApiNight } from "@dtlahappening/core";
import {
  formatCalendarDate,
  shortNightName,
  venueSubtitle,
  VENUE_TAGS,
} from "@dtlahappening/core";
import { theme, space, radius, type, inkOn } from "@/theme";
import { EmptyState, Reveal } from "@/components";
import { countVenues, groupByCorridor } from "@/corridors";

/**
 * The night, as a directory.
 *
 * Lives here rather than in a screen because two routes need exactly this: the
 * Art Night tab, which is the app's home, and /n/[slug], which is where a
 * shared link lands. Two copies of a screen this size drift within a month.
 */

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
  const subtitle = venueSubtitle(event.venue);

  return (
    <Reveal index={index}>
      <Pressable
        onPress={() => router.push(`/e/${event.slug}`)}
        accessibilityRole="button"
        accessibilityLabel={[event.venue.name, subtitle].filter(Boolean).join(", ")}
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
          {/* Absent rather than repeated: for two thirds of these the feed's
              address field is just the venue's name again. */}
          {subtitle ? (
            <Text style={[type.meta, { color: theme.textMuted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {/* Says whether this one can be found on the map. Silence would be a
            small lie on a screen whose whole job is helping someone walk. */}
        {pinned ? <Ionicons name="location" size={14} color={theme.textMuted} /> : null}
        <Ionicons name="chevron-forward" size={16} color={theme.border} />
      </Pressable>
    </Reveal>
  );
}

export function NightDirectory({ night, onRetry }: { night: ApiNight; onRetry: () => void }) {
  const [only, setOnly] = useState<string | null>(null);
  // One axis, deliberately. Kind and tag are different questions, but stacking
  // two filter rows on top of the corridor row turns the top of the screen
  // into a control panel — on a street corner people want one tap, not three.
  const [refine, setRefine] = useState<{ axis: "kind" | "tag"; value: string } | null>(null);
  const router = useRouter();

  // Only offer what the night actually contains, in a fixed order so the row
  // does not reshuffle as venues come and go month to month.
  const refinements = useMemo(() => {
    const kinds = new Map<string, number>();
    const tags = new Map<string, number>();
    for (const e of night.events) {
      const k = e.venue.kind;
      if (k) kinds.set(k, (kinds.get(k) ?? 0) + 1);
      for (const t of e.venue.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
    }
    const KIND_ORDER = ["Art Galleries", "Food and Drink", "Museums", "Shopping", "Special Events"];
    return [
      ...KIND_ORDER.filter((k) => kinds.has(k)).map((k) => ({
        axis: "kind" as const,
        value: k,
        label: k.replace("Art Galleries", "Galleries").replace("Food and Drink", "Food & Drink"),
        count: kinds.get(k)!,
      })),
      ...VENUE_TAGS.filter((t) => tags.has(t)).map((t) => ({
        axis: "tag" as const,
        value: t as string,
        label: t as string,
        count: tags.get(t)!,
      })),
    ];
  }, [night]);

  const matches = useCallback(
    (e: ApiEventSummary) =>
      !refine ||
      (refine.axis === "kind" ? e.venue.kind === refine.value : e.venue.tags.includes(refine.value)),
    [refine],
  );

  const groups = useMemo(
    () => groupByCorridor(night.events.filter(matches)),
    [night, matches],
  );
  const shown = only ? groups.filter((g) => g.corridor.slug === only) : groups;

  const destinations = countVenues(night.events);
  const pinned = groups.reduce((n, g) => n + g.pinned, 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingBottom: space.xxl * 2 }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={onRetry} tintColor={theme.textMuted} />
      }
    >
      <View style={{ padding: space.lg, paddingBottom: space.md, gap: space.sm }}>
        <Text style={[type.label, { color: theme.accent }]}>City-wide night</Text>
        <Text style={[type.poster, { color: theme.text }]}>{shortNightName(night.name)}</Text>
        <Text style={[type.heading, { color: theme.text }]}>{formatCalendarDate(night.date)}</Text>
        <View style={{ height: 1, backgroundColor: theme.border, marginVertical: space.xs }} />
        <Text style={[type.meta, { color: theme.textMuted }]}>
          {destinations} destinations across {groups.length}{" "}
          {groups.length === 1 ? "corridor" : "corridors"}
          {pinned < destinations ? ` · ${pinned} on the map` : ""}
        </Text>
        <Pressable
          onPress={() => router.push("/visitor-guide")}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            alignSelf: "flex-start",
            paddingVertical: space.xs,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name="information-circle-outline" size={16} color={theme.accent} />
          <Text style={[type.label, { color: theme.accent }]}>Getting there & what to expect</Text>
        </Pressable>

        {night.description ? (
          <Text style={[type.body, { color: theme.textMuted }]}>{night.description}</Text>
        ) : null}
      </View>

      {/* The poster's key, made operable. Tapping a corridor is how someone
          decides which stretch of Downtown to walk tonight. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: space.sm,
          paddingHorizontal: space.lg,
          paddingVertical: space.sm,
        }}
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
              <Text style={[type.label, { color: active ? inkOn(g.corridor.color) : theme.text }]}>
                {g.corridor.name.replace(" Corridor", "")}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {refinements.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: space.sm,
            paddingHorizontal: space.lg,
            paddingBottom: space.sm,
          }}
        >
          {refinements.map((r) => {
            const active = refine?.axis === r.axis && refine.value === r.value;
            return (
              <Pressable
                key={`${r.axis}:${r.value}`}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setRefine(active ? null : { axis: r.axis, value: r.value });
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${r.label}, ${r.count} stops`}
                style={{
                  backgroundColor: active ? theme.text : "transparent",
                  borderColor: active ? theme.text : theme.border,
                  borderWidth: 1,
                  borderRadius: radius.pill,
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                }}
              >
                <Text style={[type.label, { color: active ? theme.bg : theme.textMuted }]}>
                  {r.label}  {r.count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

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

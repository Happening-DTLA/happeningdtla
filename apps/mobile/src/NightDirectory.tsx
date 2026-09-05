import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import type { ApiEventSummary, ApiNight } from "@dtlahappening/core";
import {
  describeWalk,
  distanceMeters,
  formatCalendarDate,
  HERE_METERS,
  shortNightName,
  venueSubtitle,
  VENUE_TAGS,
} from "@dtlahappening/core";
import { useLocation } from "@/location";
import { usePassport } from "@/passport-store";
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
  meters,
}: {
  event: ApiEventSummary;
  color: string;
  index: number;
  /** How far the person is from the door, when we know where they are. */
  meters: number | null;
}) {
  const router = useRouter();
  const pinned = event.venue.lat !== null && event.venue.lng !== null;
  const subtitle = venueSubtitle(event.venue);
  const walk = meters === null ? null : describeWalk(meters);

  return (
    <Reveal index={index}>
      <Pressable
        onPress={() => router.push(`/e/${event.slug}`)}
        accessibilityRole="button"
        accessibilityLabel={[event.venue.name, subtitle, walk && `${walk} away`].filter(Boolean).join(", ")}
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
        {/* The distance replaces the map pin rather than sitting beside it:
            a walking time already implies the place has a location, and two
            pieces of the same information is one too many in a row this
            narrow. Falls back to the pin when we do not know where they are. */}
        {walk ? (
          <Text
            style={[
              type.label,
              { color: meters !== null && meters <= HERE_METERS ? theme.accent : theme.textMuted },
            ]}
          >
            {walk}
          </Text>
        ) : pinned ? (
          <Ionicons name="location" size={14} color={theme.textMuted} />
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={theme.border} />
      </Pressable>
    </Reveal>
  );
}

export function NightDirectory({
  night,
  onRetry,
  topInset = 0,
}: {
  night: ApiNight;
  onRetry: () => void;
  /**
   * Room for the status bar. Passed by the tab, which draws no navigation bar
   * of its own and would otherwise start its headline underneath the clock;
   * left at zero by /n/[slug], where the stack header has already reserved it.
   */
  topInset?: number;
}) {
  const [only, setOnly] = useState<string | null>(null);
  // One axis, deliberately. Kind and tag are different questions, but stacking
  // two filter rows on top of the corridor row turns the top of the screen
  // into a control panel — on a street corner people want one tap, not three.
  const [refine, setRefine] = useState<{ axis: "kind" | "tag"; value: string } | null>(null);
  const [nearestFirst, setNearestFirst] = useState(false);
  const { coords, status: locationStatus, request: requestLocation } = useLocation();
  const { stampedFor } = usePassport();
  const stampedCount = stampedFor(night.id).size;

  /** Metres from the person to each venue, once we know where they are. */
  const metersFor = useCallback(
    (event: ApiEventSummary): number | null => {
      if (!coords || event.venue.lat === null || event.venue.lng === null) return null;
      return distanceMeters(coords, { latitude: event.venue.lat, longitude: event.venue.lng });
    },
    [coords],
  );
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

  /**
   * Every visible stop, flattened and ordered by how far away it is.
   *
   * Stops with no coordinates sink to the bottom rather than being dropped: a
   * venue that quietly disappears from a crawl guide is worse than one listed
   * last, because someone walks past an open door.
   */
  const nearbyEvents = useMemo(() => {
    const rows = shown.flatMap((g) =>
      g.events.map((event) => ({ event, color: g.corridor.color, meters: metersFor(event) })),
    );
    return rows.sort((a, b) => (a.meters ?? Infinity) - (b.meters ?? Infinity));
  }, [shown, metersFor]);

  const destinations = countVenues(night.events);
  const pinned = groups.reduce((n, g) => n + g.pinned, 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingTop: topInset, paddingBottom: space.xxl * 2 }}
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
          onPress={() => router.push("/passport")}
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
          <Ionicons name="ribbon-outline" size={16} color={theme.accent} />
          <Text style={[type.label, { color: theme.accent }]}>
            {stampedCount > 0 ? `Passport · ${stampedCount} stamped` : "Start your passport"}
          </Text>
        </Pressable>
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

      {/* Nearest first, offered rather than imposed.
          The corridor grouping is what agrees with the printed map someone is
          holding, so it stays the default. But standing on a corner at nine in
          the evening the question stops being "what is on Spring Street" and
          becomes "what can I still get to", and alphabetical-within-corridor
          is no answer to that. Asking for location is deferred to this tap:
          the button explains what the permission buys before iOS asks, which
          is the difference between a considered yes and a reflexive no. */}
      <Pressable
        onPress={async () => {
          Haptics.selectionAsync().catch(() => {});
          if (!nearestFirst && locationStatus !== "granted") {
            const granted = await requestLocation();
            if (!granted) return;
          }
          setNearestFirst((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: nearestFirst }}
        style={({ pressed }) => ({
          marginHorizontal: space.lg,
          marginTop: space.sm,
          paddingVertical: 10,
          paddingHorizontal: space.md,
          borderColor: nearestFirst ? theme.accent : theme.border,
          borderWidth: 1,
          backgroundColor: nearestFirst ? theme.accent : pressed ? theme.surface : "transparent",
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
        })}
      >
        <Ionicons
          name={nearestFirst ? "navigate" : "navigate-outline"}
          size={15}
          color={nearestFirst ? theme.accentInk : theme.textMuted}
        />
        <Text style={[type.label, { color: nearestFirst ? theme.accentInk : theme.text, flex: 1 }]}>
          {nearestFirst ? "Nearest first" : "Sort by what's closest"}
        </Text>
        {!nearestFirst && locationStatus === "denied" ? (
          <Text style={[type.meta, { color: theme.textMuted }]}>Needs location</Text>
        ) : null}
      </Pressable>

      {shown.length === 0 ? (
        <EmptyState title="Nothing listed there" body="Pick another corridor, or show them all." />
      ) : nearestFirst ? (
        /* Flat, because distance does not respect the corridors — the closest
           three doors can be on three different streets, and re-grouping them
           would hide the exact thing being asked for. The colour bar on each
           row still says which corridor it belongs to. */
        <View style={{ marginTop: space.md }}>
          {nearbyEvents.map(({ event, color, meters }, i) => (
            <Destination key={event.id} event={event} color={color} index={i} meters={meters} />
          ))}
        </View>
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
                <Destination key={e.id} event={e} color={g.corridor.color} index={i} meters={metersFor(e)} />
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

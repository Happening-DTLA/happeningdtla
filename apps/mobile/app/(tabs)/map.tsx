import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import type { ApiEventSummary } from "@dtlahappening/core";
import { VENUE_TAGS } from "@dtlahappening/core";
import { api } from "@/api";
import { useAsync } from "@/useAsync";
import { theme, space, radius, type, inkOn } from "@/theme";
import { ErrorState, Loading } from "@/components";
import { EventMap } from "@/EventMap";
import { boundsOf, groupEventsByVenue } from "@/venue-pins";
import { groupByCorridor } from "@/corridors";
import { describeWalk, distanceMeters } from "@dtlahappening/core";
import { useLocation } from "@/location";

/**
 * The night, on a map.
 *
 * Sourced from the night itself rather than a date search. This app is
 * ArtNight, so "what is on tonight" has exactly one answer and a row of date
 * presets over it was three taps that could only ever lead back here.
 */
/**
 * A filter chip.
 *
 * Declared out here rather than inside the screen. A component defined during
 * render is a brand new type on every render, so React unmounts and remounts
 * every chip rather than updating it — and now that location is watched while
 * someone walks, this screen re-renders every ten metres.
 */
function Chip({
  label, active, color, onPress,
}: { label: string; active: boolean; color?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        backgroundColor: active ? (color ?? theme.text) : "transparent",
        borderColor: color ?? theme.border,
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingVertical: 6,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      {color && !active ? (
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      ) : null}
      <Text
        style={[
          type.label,
          { color: active ? (color ? inkOn(color) : theme.bg) : theme.textMuted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [corridor, setCorridor] = useState<string | null>(null);
  const [refine, setRefine] = useState<{ axis: "kind" | "tag"; value: string } | null>(null);
  // The map is where asking for location is self-explanatory, so this is the
  // screen that prompts. Everywhere else reads what it gets.
  const { coords, status: locationStatus, request: requestLocation } = useLocation();
  useEffect(() => { void requestLocation(); }, [requestLocation]);

  const fetcher = useCallback((s: AbortSignal) => api.upcomingNight(s), []);
  const { status, data: night, error, retry } = useAsync(fetcher);

  const events = useMemo(() => night?.events ?? [], [night]);

  const refinements = useMemo(() => {
    const kinds = new Map<string, number>();
    const tags = new Map<string, number>();
    for (const e of events) {
      if (e.venue.kind) kinds.set(e.venue.kind, (kinds.get(e.venue.kind) ?? 0) + 1);
      for (const t of e.venue.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
    }
    const ORDER = ["Art Galleries", "Food and Drink", "Museums", "Shopping", "Special Events"];
    return [
      ...ORDER.filter((k) => kinds.has(k)).map((k) => ({
        axis: "kind" as const, value: k, count: kinds.get(k)!,
        label: k.replace("Art Galleries", "Galleries").replace("Food and Drink", "Food & Drink"),
      })),
      ...VENUE_TAGS.filter((t) => tags.has(t)).map((t) => ({
        axis: "tag" as const, value: t as string, label: t as string, count: tags.get(t)!,
      })),
    ];
  }, [events]);

  const matches = useCallback(
    (e: ApiEventSummary) =>
      (!refine ||
        (refine.axis === "kind" ? e.venue.kind === refine.value : e.venue.tags.includes(refine.value))) &&
      (!corridor || e.venue.corridor?.slug === corridor),
    [refine, corridor],
  );

  // Every pin the night has. This is what the map renders — always, in full.
  // EventMap explains why the child list must never change size.
  const allPins = useMemo(() => groupEventsByVenue(events), [events]);
  // What the filter admits. Used for framing, for the empty state, and to tell
  // the map which pins to draw; never to decide which ones exist.
  const pins = useMemo(() => groupEventsByVenue(events.filter(matches)), [events, matches]);
  const shownIds = useMemo(() => new Set(pins.map((p) => p.venue.id)), [pins]);

  const corridors = useMemo(
    () => groupByCorridor(events).map((g) => ({ ...g.corridor, stops: g.events.length })),
    [events],
  );
  const routes = useMemo(
    () => corridors.filter((c) => c.path?.length).map((c) => ({ slug: c.slug, color: c.color, path: c.path! })),
    [corridors],
  );

  // Framing follows the filter: choosing a corridor goes there, clearing it
  // comes back out to everything. Parked on a corridor, the rest of the pins
  // look deleted when they are merely off-screen.
  const focusRegion = useMemo(() => boundsOf(pins.length ? pins : allPins), [pins, allPins]);
  const focusKey = `${corridor ?? "all"}:${refine?.value ?? "all"}`;

  const selected = pins.find((p) => p.venue.id === selectedVenueId) ?? null;
  const openGroup = corridor
    ? (groupByCorridor(events.filter(matches)).find((g) => g.corridor.slug === corridor) ?? null)
    : null;

  useEffect(() => {
    setSelectedVenueId(null);
  }, [corridor, refine]);


  if (status === "loading") return <Loading />;
  if (status === "error") return <ErrorState message={error.message} onRetry={retry} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ paddingTop: space.sm, gap: space.sm }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}
        >
          <Chip label={`All ${allPins.length}`} active={!corridor} onPress={() => setCorridor(null)} />
          {corridors.map((c) => (
            <Chip
              key={c.slug}
              label={`${c.name.replace(" Corridor", "")}  ${c.stops}`}
              active={corridor === c.slug}
              color={c.color}
              onPress={() => setCorridor(corridor === c.slug ? null : c.slug)}
            />
          ))}
        </ScrollView>

        {refinements.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}
          >
            {refinements.map((r) => (
              <Chip
                key={`${r.axis}:${r.value}`}
                label={`${r.label}  ${r.count}`}
                active={refine?.axis === r.axis && refine.value === r.value}
                onPress={() =>
                  setRefine(
                    refine?.axis === r.axis && refine.value === r.value
                      ? null
                      : { axis: r.axis, value: r.value },
                  )
                }
              />
            ))}
          </ScrollView>
        ) : null}
      </View>

      <View style={{ flex: 1, marginTop: space.sm }}>
        <EventMap
          pins={allPins}
          shownIds={shownIds}
          routes={routes}
          activeRoute={corridor}
          focusRegion={focusRegion}
          focusKey={focusKey}
          selectedVenueId={selectedVenueId}
          onSelectVenue={setSelectedVenueId}
          showUserLocation={locationStatus === "granted"}
          userCoords={coords}
        />

        {pins.length === 0 ? (
          <View
            style={{
              position: "absolute",
              left: space.lg, right: space.lg, bottom: space.lg,
              backgroundColor: theme.surface,
              borderColor: theme.border, borderWidth: 1,
              padding: space.lg,
            }}
          >
            <Text style={[type.heading, { color: theme.text }]}>Nothing here with that filter</Text>
            <Text style={[type.meta, { color: theme.textMuted, marginTop: 2 }]}>
              Clear it, or pick another corridor.
            </Text>
          </View>
        ) : null}

        {/* A chosen corridor lists everything on it, so a stop is never hidden
            just because the map could not place it. */}
        {openGroup && !selected ? (
          <View
            style={{
              position: "absolute", left: 0, right: 0, bottom: 0,
              maxHeight: "52%",
              backgroundColor: theme.bg,
              borderTopWidth: 2, borderColor: openGroup.corridor.color,
              paddingBottom: insets.bottom,
            }}
          >
            <View
              style={{
                backgroundColor: openGroup.corridor.color,
                paddingVertical: space.sm, paddingHorizontal: space.lg,
                flexDirection: "row", alignItems: "center", justifyContent: "space-between",
              }}
            >
              <Text style={[type.heading, { color: inkOn(openGroup.corridor.color), flex: 1 }]}>
                {openGroup.corridor.name}
              </Text>
              <Text style={[type.label, { color: inkOn(openGroup.corridor.color) }]}>
                {openGroup.events.length} stops
              </Text>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: space.lg }}>
              {openGroup.events.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    if (e.venue.lat !== null) setSelectedVenueId(e.venue.id);
                    else router.push(`/e/${e.slug}`);
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? theme.surface : "transparent",
                    borderTopColor: theme.border, borderTopWidth: 1,
                    paddingVertical: space.md, paddingHorizontal: space.lg,
                    flexDirection: "row", alignItems: "center", gap: space.md,
                  })}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[type.heading, { color: theme.text }]} numberOfLines={1}>
                      {e.venue.name}
                    </Text>
                    <Text style={[type.meta, { color: theme.textMuted }]} numberOfLines={1}>
                      {e.venue.address1}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={theme.border} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {selected ? (
          <View
            style={{
              position: "absolute", left: 0, right: 0, bottom: 0,
              maxHeight: "48%",
              backgroundColor: theme.bg,
              borderTopWidth: 1, borderColor: theme.border,
              paddingBottom: insets.bottom,
            }}
          >
            <View
              style={{
                flexDirection: "row", alignItems: "flex-start", gap: space.md,
                padding: space.lg, paddingBottom: space.md,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[type.title, { color: theme.text }]}>{selected.venue.name}</Text>
                <Text style={[type.meta, { color: theme.textMuted, marginTop: 2 }]}>
                  {selected.venue.address1}
                  {selected.venue.kind ? ` · ${selected.venue.kind}` : ""}
                </Text>
                {/* The one number someone standing on a corner wants. */}
                {coords ? (
                  <Text style={[type.label, { color: theme.accent, marginTop: 6 }]}>
                    {describeWalk(
                      distanceMeters(coords, {
                        latitude: selected.venue.lat,
                        longitude: selected.venue.lng,
                      }),
                    )}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => setSelectedVenueId(null)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={10}
              >
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </Pressable>
            </View>
            <Pressable
              onPress={() => router.push(`/e/${selected.events[0]!.slug}`)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                marginHorizontal: space.lg,
                backgroundColor: pressed ? "#a8db55" : theme.accent,
                borderRadius: radius.control,
                paddingVertical: 13,
                alignItems: "center",
              })}
            >
              <Text style={[type.label, { color: theme.accentInk }]}>Open this stop</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

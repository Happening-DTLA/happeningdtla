import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import type { EventCategory } from "@dtlahappening/core";
import {
  EVENT_CATEGORIES,
  pacificToday,
  pacificWeekendRange,
} from "@dtlahappening/core";
import { api } from "@/api";
import { useAsync } from "@/useAsync";
import { theme, space, radius, type, inkOn } from "@/theme";
import { CategoryChips, ErrorState, EventCard, Loading } from "@/components";
import { EventMap, type Coords } from "@/EventMap";
import { boundsOf, countEvents, groupEventsByVenue, type VenuePin } from "@/venue-pins";

type DatePreset = "TONIGHT" | "WEEKEND" | "ART_NIGHT" | "ALL";

const PRESET_LABELS: Record<DatePreset, string> = {
  TONIGHT: "Tonight",
  WEEKEND: "This weekend",
  ART_NIGHT: "Art Night",
  ALL: "All upcoming",
};

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        backgroundColor: active ? theme.accent : pressed ? theme.surface2 : theme.surface,
        borderColor: active ? theme.accent : theme.border,
        borderWidth: 1,
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 14,
      })}
    >
      <Text
        style={{
          color: active ? theme.accentInk : theme.text,
          fontSize: 13,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [preset, setPreset] = useState<DatePreset>("TONIGHT");
  const [category, setCategory] = useState<EventCategory | null>(null);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [corridor, setCorridor] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationGranted, setLocationGranted] = useState(false);

  // The Art Night date comes from the Night row rather than being computed as
  // "first Thursday". The schedule is data, not a rule — a night moved for a
  // holiday would silently disagree with a computed date, and the row is what
  // tickets are actually sold against.
  //
  // Its own request on purpose: /api/nights/upcoming 404s when none is
  // scheduled, and that should grey out one chip, not break the map.
  const nightFetcher = useCallback((s: AbortSignal) => api.upcomingNight(s), []);
  const night = useAsync(nightFetcher, []);
  const artNightDate = night.status === "ready" ? night.data.date : null;

  const { from, to } = useMemo((): { from?: string; to?: string } => {
    switch (preset) {
      case "TONIGHT": {
        // Recomputed only when the preset changes, so an app left open across
        // midnight keeps showing the night it was opened for. That is the
        // right answer at 1am — "tonight" is still the night you went out.
        const today = pacificToday();
        return { from: today, to: today };
      }
      case "WEEKEND":
        return pacificWeekendRange();
      case "ART_NIGHT":
        return artNightDate ? { from: artNightDate, to: artNightDate } : {};
      case "ALL":
        return {};
    }
  }, [preset, artNightDate]);

  // No scheduled night means no Art Night chip. Showing it would make the
  // filter quietly equivalent to "all upcoming", which looks like a bug.
  const presets: DatePreset[] = artNightDate
    ? ["TONIGHT", "WEEKEND", "ART_NIGHT", "ALL"]
    : ["TONIGHT", "WEEKEND", "ALL"];

  const fetcher = useCallback(
    (s: AbortSignal) => api.search({ category: category ?? undefined, from, to }, s),
    [category, from, to],
  );
  const { status, data, error, retry } = useAsync(fetcher, [category, from, to]);

  const pins = useMemo(() => (data ? groupEventsByVenue(data.events) : []), [data]);

  // The corridors actually represented in what is on the map right now, in the
  // printed map's own order. Derived rather than fetched: the answer is
  // already in the pins, and a second request could disagree with them.
  const corridors = useMemo(() => {
    const seen = new Map<string, NonNullable<VenuePin["venue"]["corridor"]>>();
    for (const pin of pins) {
      const c = pin.venue.corridor;
      if (c && !seen.has(c.slug)) seen.set(c.slug, c);
    }
    return [...seen.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [pins]);

  // Only corridors that actually carry geometry. A district has no single
  // street, and a line invented through one would be a route nobody walks.
  const routes = useMemo(
    () =>
      corridors
        .filter((c) => c.path && c.path.length > 0)
        .map((c) => ({ slug: c.slug, color: c.color, path: c.path! })),
    [corridors],
  );

  const visiblePins = useMemo(
    () => (corridor ? pins.filter((p) => p.venue.corridor?.slug === corridor) : pins),
    [pins, corridor],
  );

  // Picking a corridor takes the map there. Without this the filter would drop
  // most of the pins and leave the person looking at empty streets.
  // Picking a corridor takes the map there — and clearing it brings the map
  // back out to everything. Leaving it parked on the corridor made the other
  // pins look deleted when they were simply off-screen.
  const focusRegion = useMemo(
    () => boundsOf(corridor ? visiblePins : pins),
    [corridor, visiblePins, pins],
  );

  const selected = visiblePins.find((p) => p.venue.id === selectedVenueId) ?? null;

  // A venue that no longer matches the filters must not keep its sheet open,
  // and a corridor that is not in the new results must not stay selected.
  useEffect(() => {
    setSelectedVenueId(null);
    setCorridor(null);
  }, [category, from, to]);

  useEffect(() => {
    let active = true;
    (async () => {
      // Asked on arrival rather than behind a button: the blue dot is the
      // point of this screen. Denial is a normal outcome, not an error — the
      // map is already centred on Downtown and stays fully usable without it.
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!active || permission.status !== "granted") return;
      setLocationGranted(true);

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!active) return;
      setCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    })().catch(() => {
      /* No fix available. The map still works; there is nothing to tell the user. */
    });
    return () => {
      active = false;
    };
  }, []);

  const eventCount = countEvents(visiblePins);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ paddingTop: space.md, gap: space.sm }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm }}
        >
          {presets.map((p) => (
            <Chip
              key={p}
              label={PRESET_LABELS[p]}
              active={preset === p}
              onPress={() => setPreset(p)}
            />
          ))}
        </ScrollView>

        <View>
          <CategoryChips
            categories={EVENT_CATEGORIES}
            selected={category}
            onSelect={setCategory}
          />
        </View>

        {/* The night's own key, when there is one. On ArtNight the corridor is
            what people navigate by — the poster is organised that way and so is
            the walk — so it appears only when the results actually carry one. */}
        {corridors.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}
          >
            {corridors.map((c) => {
              const active = corridor === c.slug;
              return (
                <Pressable
                  key={c.slug}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setCorridor(active ? null : c.slug);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={c.name}
                  style={{
                    backgroundColor: active ? c.color : "transparent",
                    borderColor: c.color,
                    borderWidth: 1,
                    borderRadius: radius.pill,
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {!active ? (
                    <View
                      style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.color }}
                    />
                  ) : null}
                  <Text
                    style={[type.label, { color: active ? inkOn(c.color) : theme.text }]}
                  >
                    {c.name.replace(" Corridor", "")}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      <View style={{ flex: 1, marginTop: space.sm }}>
        {status === "loading" ? (
          <Loading />
        ) : status === "error" ? (
          <ErrorState message={error.message} onRetry={retry} />
        ) : (
          <>
            <EventMap
              // A chosen corridor really filters: only its venues are drawn,
              // and clearing it brings every one back. Fading the rest looked
              // like the same thing and was not — react-native-maps caches a
              // marker's image once it stops tracking, so a faded pin could
              // stay faded after the filter was cleared and read as deleted.
              pins={visiblePins}
              routes={routes}
              focusKey={corridor ?? "all"}
              activeRoute={corridor}
              focusRegion={focusRegion}
              selectedVenueId={selectedVenueId}
              onSelectVenue={setSelectedVenueId}
              showUserLocation={locationGranted}
              userCoords={coords}
            />

            {eventCount === 0 ? (
              <View
                style={{
                  position: "absolute",
                  left: space.lg,
                  right: space.lg,
                  bottom: space.lg,
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: space.lg,
                }}
              >
                <Text style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}>
                  Nothing on the map for that
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 2 }}>
                  Try a wider date range or clear the category.
                </Text>
              </View>
            ) : null}

            {selected ? (
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  maxHeight: "55%",
                  backgroundColor: theme.bg,
                  borderTopWidth: 1,
                  borderColor: theme.border,
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  paddingBottom: insets.bottom,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: space.md,
                    padding: space.lg,
                    paddingBottom: space.md,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 17, fontWeight: "700" }}>
                      {selected.venue.name}
                    </Text>
                    <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 2 }}>
                      {selected.venue.neighborhood
                        ? `${selected.venue.neighborhood} · ${selected.venue.address1}`
                        : selected.venue.address1}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setSelectedVenueId(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Close venue details"
                    hitSlop={10}
                  >
                    <Ionicons name="close" size={22} color={theme.textMuted} />
                  </Pressable>
                </View>

                <ScrollView
                  contentContainerStyle={{ paddingBottom: space.lg }}
                >
                  {selected.events.map((event, i) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      showDate={preset === "ALL"}
                      index={i}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

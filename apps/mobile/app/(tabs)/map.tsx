import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import type { EventCategory } from "@dtlahappening/core";
import {
  EVENT_CATEGORIES,
  pacificToday,
  pacificWeekendRange,
} from "@dtlahappening/core";
import { api } from "@/api";
import { useAsync } from "@/useAsync";
import { theme, space } from "@/theme";
import { CategoryChips, ErrorState, EventCard, Loading } from "@/components";
import { EventMap, type Coords } from "@/EventMap";
import { countEvents, groupEventsByVenue } from "@/venue-pins";

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
  const selected = pins.find((p) => p.venue.id === selectedVenueId) ?? null;

  // A venue that no longer matches the filters must not keep its sheet open.
  useEffect(() => {
    setSelectedVenueId(null);
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

  const eventCount = countEvents(pins);

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
      </View>

      <View style={{ flex: 1, marginTop: space.sm }}>
        {status === "loading" ? (
          <Loading />
        ) : status === "error" ? (
          <ErrorState message={error.message} onRetry={retry} />
        ) : (
          <>
            <EventMap
              pins={pins}
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

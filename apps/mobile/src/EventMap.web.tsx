import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, space } from "@/theme";
import type { VenuePin } from "@/venue-pins";

/**
 * Web stand-in for the native map.
 *
 * react-native-maps has no web implementation — importing it in a web bundle
 * throws at module load, which would take down the whole tab rather than just
 * the map. Metro picks this file for `platform: web`, so the native module is
 * never referenced there at all.
 *
 * This is a real fallback rather than an apology: the same venues, grouped the
 * same way, tappable the same way. Someone on a laptop gets the list; a map
 * for web can come later behind the same props.
 */
export const DTLA_REGION = {
  latitude: 34.044,
  longitude: -118.245,
  latitudeDelta: 0.035,
  longitudeDelta: 0.035,
};

export type Coords = { latitude: number; longitude: number };

export function EventMap({
  pins,
  selectedVenueId,
  onSelectVenue,
}: {
  pins: VenuePin[];
  selectedVenueId: string | null;
  onSelectVenue: (venueId: string | null) => void;
  showUserLocation: boolean;
  userCoords: Coords | null;
  region?: typeof DTLA_REGION;
  focusRegion?: typeof DTLA_REGION | null;
  focusKey?: string | null;
  routes?: { slug: string; color: string; path: number[][][] }[];
  activeRoute?: string | null;
}) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: space.lg, gap: space.sm }}
    >
      <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: space.sm }}>
        The map is available in the iOS and Android apps. These are the same
        venues, with the same filters applied.
      </Text>

      {pins.map((pin) => {
        const selected = pin.venue.id === selectedVenueId;
        return (
          <Pressable
            key={pin.venue.id}
            onPress={() => onSelectVenue(selected ? null : pin.venue.id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.md,
              backgroundColor: theme.surface,
              borderColor: selected ? theme.accent : theme.border,
              borderWidth: 1,
              borderRadius: 12,
              padding: space.md,
            }}
          >
            <Ionicons name="location" size={18} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}>
                {pin.venue.name}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                {pin.venue.neighborhood ?? pin.venue.address1} ·{" "}
                {pin.events.length} {pin.events.length === 1 ? "event" : "events"}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

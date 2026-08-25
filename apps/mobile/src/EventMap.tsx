import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/theme";
import type { VenuePin } from "@/venue-pins";

/**
 * Downtown Los Angeles. The entire product is a few square miles, so the map
 * opens on the neighbourhood rather than waiting for a location fix — someone
 * who denies the permission still gets a useful screen.
 */
export const DTLA_REGION: Region = {
  latitude: 34.044,
  longitude: -118.245,
  latitudeDelta: 0.035,
  longitudeDelta: 0.035,
};

export type Coords = { latitude: number; longitude: number };

/**
 * A venue pin.
 *
 * react-native-maps rasterises a custom marker view into an image. Leaving
 * `tracksViewChanges` on re-rasterises every frame and the map visibly
 * stutters once there are more than a handful of pins; turning it off from the
 * start can rasterise before layout and leave a blank marker. So it tracks
 * briefly, then stops — and tracks again whenever the marker's appearance
 * actually changes.
 */
function VenueMarker({
  pin,
  selected,
  onPress,
}: {
  pin: VenuePin;
  selected: boolean;
  onPress: (venueId: string) => void;
}) {
  const [tracks, setTracks] = useState(true);

  useEffect(() => {
    setTracks(true);
    const timer = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(timer);
  }, [selected, pin.events.length]);

  return (
    <Marker
      coordinate={{ latitude: pin.venue.lat, longitude: pin.venue.lng }}
      onPress={() => onPress(pin.venue.id)}
      tracksViewChanges={tracks}
      // The default callout is a system bubble that cannot be themed and
      // duplicates the sheet below, so the marker owns the whole interaction.
      stopPropagation
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: selected ? theme.accent : theme.surface,
          borderColor: selected ? theme.accent : theme.border,
          borderWidth: 1,
          borderRadius: 999,
          paddingVertical: 6,
          paddingHorizontal: 10,
          // Pins sit on a light map; without a shadow the dark pill disappears
          // against dark buildings at zoom.
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      >
        <Ionicons
          name="location"
          size={13}
          color={selected ? theme.accentInk : theme.accent}
        />
        <Text
          style={{
            color: selected ? theme.accentInk : theme.text,
            fontSize: 12,
            fontWeight: "700",
          }}
        >
          {pin.events.length}
        </Text>
      </View>
    </Marker>
  );
}

export function EventMap({
  pins,
  selectedVenueId,
  onSelectVenue,
  showUserLocation,
  userCoords,
  region = DTLA_REGION,
}: {
  pins: VenuePin[];
  selectedVenueId: string | null;
  onSelectVenue: (venueId: string | null) => void;
  showUserLocation: boolean;
  userCoords: Coords | null;
  /** Opening view. Defaults to the neighbourhood; a single venue passes its own. */
  region?: Region;
}) {
  const mapRef = useRef<MapView>(null);

  const recenter = (coords: Coords) =>
    mapRef.current?.animateToRegion(
      { ...coords, latitudeDelta: 0.012, longitudeDelta: 0.012 },
      450,
    );

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={region}
        // No `provider` on purpose. iOS then uses Apple Maps, which needs no
        // API key and no billing account; forcing PROVIDER_GOOGLE would make a
        // Google Maps key a prerequisite for the app to run at all.
        userInterfaceStyle="dark"
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        showsPointsOfInterest={false}
        showsCompass={false}
        toolbarEnabled={false}
        // Tapping the map itself dismisses the sheet, the way a modal does.
        onPress={() => onSelectVenue(null)}
      >
        {pins.map((pin) => (
          <VenueMarker
            key={pin.venue.id}
            pin={pin}
            selected={pin.venue.id === selectedVenueId}
            onPress={onSelectVenue}
          />
        ))}
      </MapView>

      {userCoords ? (
        <Pressable
          onPress={() => recenter(userCoords)}
          accessibilityRole="button"
          accessibilityLabel="Centre the map on my location"
          style={({ pressed }) => ({
            position: "absolute",
            right: 12,
            top: 12,
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? theme.surface2 : theme.surface,
            borderColor: theme.border,
            borderWidth: 1,
          })}
        >
          <Ionicons name="navigate" size={18} color={theme.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

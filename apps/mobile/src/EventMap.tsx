import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { theme, inkOn, withAlpha } from "@/theme";
import type { EventCategory } from "@dtlahappening/core";
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
 * What kind of place this is, at a glance.
 *
 * The printed map draws a little building for its landmarks. Those
 * illustrations are the organisers' artwork, so this says the same thing in
 * the app's own language: an icon for what the place IS, which also works for
 * the forty-odd venues the poster never drew.
 */
const CATEGORY_ICON: Record<EventCategory, keyof typeof Ionicons.glyphMap> = {
  ART: "color-palette",
  MUSIC: "musical-notes",
  NIGHTLIFE: "wine",
  FOOD_DRINK: "restaurant",
  PERFORMANCE: "mic",
  MARKET: "storefront",
  WORKSHOP: "construct",
  OTHER: "location",
};

/** A corridor's street, ready to draw. */
export type MapRoute = { slug: string; color: string; path: number[][][] };


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

  // The corridor's own colour, so the map and the printed key agree at a
  // glance. Falls back to the brand accent for venues outside a corridor.
  const tint = pin.venue.corridor?.color ?? theme.accent;

  useEffect(() => {
    setTracks(true);
    const timer = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(timer);
    // Every input the rasterised marker draws from. react-native-maps caches
    // that image once tracking stops, so anything affecting its appearance has
    // to be listed here or the map keeps showing a stale one — which is how a
    // landmark ends up rendered as an anonymous count.
  }, [selected, tint, pin.venue.isLandmark, pin.venue.name, pin.events.length, pin.events[0]?.category]);

  return (
    <Marker
      coordinate={{ latitude: pin.venue.lat, longitude: pin.venue.lng }}
      onPress={() => onPress(pin.venue.id)}
      tracksViewChanges={tracks}
      zIndex={selected ? 3 : pin.venue.isLandmark ? 2 : 1}
      // The default callout is a system bubble that cannot be themed and
      // duplicates the sheet below, so the marker owns the whole interaction.
      stopPropagation
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: selected ? tint : theme.surface,
          borderColor: tint,
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
          name={CATEGORY_ICON[pin.events[0]?.category ?? "OTHER"]}
          size={13}
          color={selected ? inkOn(tint) : tint}
        />
        {/* Landmarks carry their name; everything else carries its count.
            Naming all fifty would turn the map into a wall of labels and hide
            the streets underneath, which are the thing being navigated. */}
        <Text
          numberOfLines={1}
          style={{
            color: selected ? inkOn(tint) : theme.text,
            fontSize: 12,
            fontWeight: "700",
            maxWidth: pin.venue.isLandmark ? 132 : undefined,
          }}
        >
          {pin.venue.isLandmark ? pin.venue.name : pin.events.length}
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
  focusRegion = null,
  focusKey = null,
  routes = [],
  activeRoute = null,
}: {
  pins: VenuePin[];
  selectedVenueId: string | null;
  onSelectVenue: (venueId: string | null) => void;
  showUserLocation: boolean;
  userCoords: Coords | null;
  /** Opening view. Defaults to the neighbourhood; a single venue passes its own. */
  region?: Region;
  /** Where to fly. Paired with focusKey, which decides WHEN. */
  focusRegion?: Region | null;
  /**
   * Identity of the current framing. The map moves when this changes and not
   * otherwise, so a background refetch cannot yank the map out from under
   * someone who is panning around.
   */
  focusKey?: string | null;
  /** The night's corridors, drawn as coloured routes along their streets. */
  routes?: MapRoute[];
  /** Which route is picked. The others recede rather than disappear. */
  activeRoute?: string | null;
}) {
  const mapRef = useRef<MapView>(null);

  // Animated rather than re-mounted: `initialRegion` only applies once, so a
  // changed region prop would do nothing at all.
  //
  // Keyed, and the first key is swallowed. Without that the map flies on mount,
  // fighting initialRegion; and without keying at all it would re-frame on
  // every refetch. Crucially this also runs when a corridor is DESELECTED —
  // the map has to come back out, or the pins it flew away from look deleted.
  const framedAs = useRef<string | null>(null);
  useEffect(() => {
    if (!focusKey || !focusRegion) return;
    if (framedAs.current === null) {
      framedAs.current = focusKey;
      return;
    }
    if (framedAs.current === focusKey) return;
    framedAs.current = focusKey;
    mapRef.current?.animateToRegion(focusRegion, 520);
    // focusRegion is read, not depended on: only the key decides when to move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

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
        {/* The poster's coloured lines, over a real map instead of a diagram.
            Drawn before the markers so pins sit on top and stay tappable.
            Nothing selected: every route at a readable weight, which is what
            the printed key shows. One selected: that street thickens and the
            rest recede rather than vanishing, so the chosen stretch is read in
            the context of the ones around it. */}
        {routes.map((route) =>
          route.path.map((run, i) => {
            const active = activeRoute === route.slug;
            const dimmed = activeRoute !== null && !active;
            return (
              <Polyline
                key={`${route.slug}-${i}`}
                coordinates={run.map(([latitude, longitude]) => ({ latitude, longitude }))}
                strokeColor={withAlpha(route.color, dimmed ? 0.22 : active ? 1 : 0.75)}
                strokeWidth={active ? 7 : 4}
                lineCap="round"
                lineJoin="round"
                zIndex={active ? 2 : 1}
              />
            );
          }),
        )}

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

import { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { CHECK_IN_RADIUS_M, distanceMeters, isNear } from "@dtlahappening/core";
import { usePassport } from "@/passport-store";
import { useLocation } from "@/location";
import { theme, space, radius, type } from "@/theme";

/**
 * Collecting a door.
 *
 * Never refuses. If the phone can see you near the venue it stamps on one tap;
 * if it cannot — no signal, a basement, or GPS bouncing off a tower block —
 * it asks once and then stamps anyway. That is a deliberate choice about who
 * this is for: a souvenir of an evening someone actually walked, not a
 * competition worth policing. Turning away a person standing in the room
 * because a satellite fix was poor is the one outcome with no upside.
 *
 * Location is requested here rather than on launch, because standing outside a
 * gallery about to collect a stamp is the moment the permission explains
 * itself.
 */
export function StampButton({
  venueId,
  venueName,
  nightId,
  lat,
  lng,
}: {
  venueId: string;
  venueName: string;
  nightId: string | null;
  lat: number | null;
  lng: number | null;
}) {
  const { stampedFor, add, remove } = usePassport();
  const { coords, status, request } = useLocation();
  const [busy, setBusy] = useState(false);

  // A night is what a stamp belongs to; without one there is nothing to collect.
  if (!nightId) return null;

  const stamped = stampedFor(nightId).has(venueId);
  const venue = lat !== null && lng !== null ? { latitude: lat, longitude: lng } : null;
  const near = isNear(coords, venue);
  const away = coords && venue ? Math.round(distanceMeters(coords, venue)) : null;

  const stamp = useCallback(
    async (verified: boolean) => {
      setBusy(true);
      try {
        await add({ venueId, nightId, verified });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } finally {
        setBusy(false);
      }
    },
    [add, venueId, nightId],
  );

  const onPress = useCallback(async () => {
    if (stamped) {
      Alert.alert(venueName, "Remove this stamp?", [
        { text: "Keep", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void remove(venueId, nightId) },
      ]);
      return;
    }

    let here = coords;
    if (!here && status !== "denied") {
      const granted = await request();
      if (granted) {
        // The fix may not have landed yet; the confirm below covers that.
        here = coords;
      }
    }

    if (here && venue && isNear(here, venue)) {
      void stamp(true);
      return;
    }

    Alert.alert(
      "Stamp this stop?",
      away !== null
        ? `We make it about ${away}m away, but GPS is unreliable between these buildings. If you're here, stamp it.`
        : "We can't see where you are right now. If you're here, stamp it.",
      [
        { text: "Not yet", style: "cancel" },
        { text: "I'm here", onPress: () => void stamp(false) },
      ],
    );
  }, [stamped, venueName, remove, venueId, nightId, coords, status, request, venue, away, stamp]);

  return (
    <View style={{ gap: 6 }}>
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ checked: stamped }}
        style={({ pressed }) => ({
          backgroundColor: stamped ? theme.surface : pressed ? "#a8db55" : theme.accent,
          borderColor: stamped ? theme.accent : "transparent",
          borderWidth: 1,
          borderRadius: radius.control,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
        })}
      >
        <Ionicons
          name={stamped ? "checkmark-circle" : "location"}
          size={18}
          color={stamped ? theme.accent : theme.accentInk}
        />
        <Text style={[type.label, { color: stamped ? theme.accent : theme.accentInk }]}>
          {stamped ? "Stamped" : "Stamp this stop"}
        </Text>
      </Pressable>
      {!stamped && near ? (
        <Text style={[type.meta, { color: theme.textMuted, textAlign: "center" }]}>
          You're here — one tap.
        </Text>
      ) : !stamped && away !== null && away > CHECK_IN_RADIUS_M ? (
        <Text style={[type.meta, { color: theme.textMuted, textAlign: "center" }]}>
          About {away}m away.
        </Text>
      ) : null}
    </View>
  );
}

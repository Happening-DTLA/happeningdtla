import { useEffect } from "react";
import { Modal, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { theme, space, type, inkOn } from "@/theme";
import { useReducedMotion } from "@/motion";

/**
 * The moment the stamp lands.
 *
 * A rubber stamp, not a confetti cannon: it comes in oversized and rotated,
 * hits the page hard, and settles a couple of degrees off square. Everything
 * about the timing is borrowed from the physical object — fast in, an abrupt
 * stop, no bounce. A stamp that eases gently into place is a sticker.
 *
 * It takes over the screen for three-quarters of a second and then gets out of
 * the way on its own. Nothing to dismiss: someone is standing in a gallery
 * with one hand on their phone, and a celebration that needs tapping away is a
 * chore attached to a reward.
 */
const HIT = 260;   // oversized to landed
const HOLD = 420;  // long enough to read the name

export function StampBurst({
  venueName,
  color,
  corridorComplete,
  onDone,
}: {
  venueName: string;
  color: string;
  /** The louder version: this stamp finished a whole street. */
  corridorComplete: boolean;
  onDone: () => void;
}) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  const hit = useSharedValue(0);
  const out = useSharedValue(0);
  const ring = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      hit.value = 1;
      out.value = withDelay(HOLD, withTiming(1, { duration: 180 }, (done) => {
        if (done) runOnJS(onDone)();
      }));
      return;
    }

    // Out fast, stop dead. Easing.out on a short duration is the closest thing
    // to an impact that a timing curve gives you.
    hit.value = withTiming(1, { duration: HIT, easing: Easing.out(Easing.quad) });
    // The shockwave leaves as the stamp lands, not with it.
    ring.value = withDelay(HIT - 90, withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) }));
    out.value = withDelay(
      HIT + HOLD,
      withTiming(1, { duration: 220, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) runOnJS(onDone)();
      }),
    );

    return () => {
      for (const v of [hit, out, ring]) cancelAnimation(v);
    };
  }, [reduced, hit, out, ring, onDone]);

  const sheet = useAnimatedStyle(() => ({ opacity: 1 - out.value }));

  const mark = useAnimatedStyle(() => ({
    opacity: hit.value,
    transform: [
      // 2.4 → 1: it arrives from above the page rather than growing on it.
      { scale: 2.4 - 1.4 * hit.value + out.value * 0.12 },
      { rotate: `${-14 + 10 * hit.value}deg` },
    ],
  }));

  const shock = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : (1 - ring.value) * 0.5,
    transform: [{ scale: 0.85 + ring.value * 0.9 }],
  }));

  const caption = useAnimatedStyle(() => ({
    opacity: hit.value === 1 ? 1 - out.value : 0,
    transform: [{ translateY: (1 - hit.value) * 12 }],
  }));

  const size = Math.min(width * 0.52, 220);

  return (
    <Modal transparent animationType="none" statusBarTranslucent onRequestClose={onDone}>
      <Animated.View
        style={[
          { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0ccc" },
          sheet,
        ]}
        pointerEvents="none"
      >
        {/* The ink spreading out from the impact. */}
        <Animated.View
          style={[
            {
              position: "absolute",
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 3,
              borderColor: color,
            },
            shock,
          ]}
        />

        <Animated.View
          style={[
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            },
            mark,
          ]}
        >
          <Ionicons name="checkmark-sharp" size={size * 0.38} color={inkOn(color)} />
          <Text style={[type.label, { color: inkOn(color), fontSize: 11 }]}>
            {corridorComplete ? "Street complete" : "Stamped"}
          </Text>
        </Animated.View>

        <Animated.View style={[{ marginTop: space.xl, paddingHorizontal: space.xl }, caption]}>
          <Text style={[type.title, { color: theme.text, textAlign: "center" }]} numberOfLines={2}>
            {venueName}
          </Text>
          {corridorComplete ? (
            <Text style={[type.label, { color: theme.accent, textAlign: "center", marginTop: space.sm }]}>
              You walked the whole street
            </Text>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

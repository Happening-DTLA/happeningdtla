import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { api } from "@/api";
import { theme, space, type } from "@/theme";
import { useReducedMotion } from "@/motion";

/**
 * The way in.
 *
 * Built as a screenprint rather than a splash: a band of ink is pulled across
 * the screen, and the type prints on top of it. That is the app's whole visual
 * argument in one gesture — this is a poster for a night out, not a utility —
 * and it costs the person about a second before they can tap through.
 *
 * Everything is one shared clock. Separate timers for six elements drift on a
 * loaded JS thread and the sequence arrives ragged; one value with staggered
 * interpolations cannot.
 */
const INK = 620;   // the squeegee pass
const STEP = 90;   // between lines of type

export function Welcome({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const router = useRouter();

  // Fetched while the poster is still animating, so the tap lands in the
  // directory rather than on a spinner. A failure here is silent: the app
  // still opens, just on Explore instead.
  const [nightSlug, setNightSlug] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    api.upcomingNight()
      .then((n) => { if (active) setNightSlug(n.slug); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const ink = useSharedValue(0);      // the band being pulled across
  const type1 = useSharedValue(0);    // "welcome to"
  const type2 = useSharedValue(0);    // "DTLA"
  const type3 = useSharedValue(0);    // "ARTNIGHT"
  const meta = useSharedValue(0);     // the date line
  const cue = useSharedValue(0);      // "tap to continue"
  const exit = useSharedValue(0);     // the whole thing leaving

  useEffect(() => {
    if (reduced) {
      // No performance for someone who asked for less motion — just the poster.
      ink.value = 1; type1.value = 1; type2.value = 1; type3.value = 1;
      meta.value = 1; cue.value = 1;
      return;
    }
    const rise = (v: typeof type1, delay: number) =>
      withDelay(delay, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));

    ink.value = withTiming(1, { duration: INK, easing: Easing.out(Easing.cubic) });
    type1.value = rise(type1, INK * 0.55);
    type2.value = rise(type2, INK * 0.55 + STEP);
    type3.value = rise(type3, INK * 0.55 + STEP * 2);
    meta.value = rise(meta, INK * 0.55 + STEP * 3.5);
    cue.value = withDelay(
      INK + STEP * 4,
      withRepeat(
        // Breathing, not blinking. A hard flash reads as an error state.
        withSequence(
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );
    return () => {
      for (const v of [ink, type1, type2, type3, meta, cue, exit]) cancelAnimation(v);
    };
  }, [reduced, ink, type1, type2, type3, meta, cue, exit]);

  const go = useCallback(() => {
    if (nightSlug) router.push(`/n/${nightSlug}`);
    onDone();
  }, [nightSlug, router, onDone]);

  const dismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (reduced) { go(); return; }
    cancelAnimation(cue);
    exit.value = withTiming(1, { duration: 260, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) runOnJS(go)();
    });
  }, [go, reduced, cue, exit]);

  const sheet = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [{ scale: 1 - exit.value * 0.04 }],
  }));

  // The ink pass. Scales from the left edge because a band that grows from its
  // own centre reads as a loading bar, not a squeegee.
  const band = useAnimatedStyle(() => ({
    width: width * 1.4 * ink.value,
    transform: [{ rotate: "-4deg" }],
  }));

  // Called unconditionally and in a fixed order, so hook order is stable.
  const useRise = (v: typeof type1, distance = 14) =>
    useAnimatedStyle(() => ({
      opacity: v.value,
      transform: [{ translateY: (1 - v.value) * distance }],
    }));

  const l1 = useRise(type1);
  const l2 = useRise(type2, 20);
  const l3 = useRise(type3, 24);
  const l4 = useRise(meta);
  const cueStyle = useAnimatedStyle(() => ({ opacity: cue.value }));

  return (
    <Animated.View
      style={[
        { position: "absolute", inset: 0, backgroundColor: theme.bg, justifyContent: "center" },
        sheet,
      ]}
    >
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel="Welcome to DTLA ArtNight. Tap to continue."
        style={{ flex: 1, justifyContent: "center", paddingHorizontal: space.xl }}
      >
        {/* The ink, behind the type. Overflowing the screen on purpose: a band
            that stops short of the edge looks like a component, not a print. */}
        <View style={{ position: "absolute", left: -40, right: 0, top: "34%", overflow: "hidden" }}>
          <Animated.View style={[{ height: 96, backgroundColor: theme.accent }, band]} />
        </View>

        <View style={{ gap: space.xs }}>
          <Animated.Text style={[type.label, { color: theme.textMuted }, l1]}>
            Welcome to
          </Animated.Text>
          <Animated.Text
            style={[type.poster, { color: theme.text, fontSize: 46, lineHeight: 46 }, l2]}
          >
            DTLA
          </Animated.Text>
          <Animated.Text
            style={[type.poster, { color: theme.accentInk, fontSize: 46, lineHeight: 46 }, l3]}
          >
            ARTNIGHT
          </Animated.Text>
          <Animated.Text style={[type.meta, { color: theme.textMuted, marginTop: space.md }, l4]}>
            Galleries, studios and rooftops across Downtown. First Thursday, 6pm until late.
          </Animated.Text>
        </View>

        <Animated.View style={[{ position: "absolute", left: 0, right: 0, bottom: space.xxl * 2, alignItems: "center" }, cueStyle]}>
          <Text style={[type.label, { color: theme.textMuted }]}>Tap to continue</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

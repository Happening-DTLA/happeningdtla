import { useEffect, useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { theme } from "./theme";
import { useReducedMotion } from "./motion";

/**
 * Torn paper, not party confetti.
 *
 * The app's visual direction is the screenprinted gig poster, so the
 * celebration is the thing that falls when you tear a flyer off a wall:
 * rectangular scraps in the two inks the product actually uses, fluttering
 * rather than spraying. Generic multicoloured confetti would be the one moment
 * in the app that belonged to some other product.
 */
const DURATION = 2400;
const COUNT = 26;

/** Weighted toward the spot ink and the paper; the greys are the torn edges. */
const PAPER = [
  theme.accent,
  theme.accent,
  theme.accent,
  theme.text,
  theme.text,
  theme.textMuted,
  theme.surface2,
] as const;

type Scrap = {
  color: string;
  width: number;
  height: number;
  startX: number;
  delay: number;
  spin: number;
  flutterAmp: number;
  flutterFreq: number;
  phase: number;
};

function ScrapPiece({
  scrap,
  progress,
  fallDistance,
}: {
  scrap: Scrap;
  progress: SharedValue<number>;
  fallDistance: number;
}) {
  const style = useAnimatedStyle(() => {
    // Each scrap runs its own clock inside the shared one, so they do not all
    // leave the top edge on the same frame.
    const t = Math.max(0, Math.min(1, (progress.value - scrap.delay) / (1 - scrap.delay)));

    // Squared-ish, because paper accelerates downward. A linear fall reads as
    // a screensaver.
    const fall = Math.pow(t, 1.7);
    const translateY = -60 + fallDistance * fall;

    // Side-to-side is what makes it paper rather than a particle: a flat scrap
    // catches air and slews as it turns.
    const translateX = Math.sin(t * scrap.flutterFreq + scrap.phase) * scrap.flutterAmp;

    const rotate = scrap.spin * t;

    // Gone before it reaches the bottom edge, so nothing piles up on the tab bar.
    const opacity = t <= 0 ? 0 : t < 0.72 ? 1 : Math.max(0, 1 - (t - 0.72) / 0.28);

    return {
      opacity,
      transform: [{ translateX }, { translateY }, { rotate: `${rotate}deg` }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: scrap.startX,
          top: 0,
          width: scrap.width,
          height: scrap.height,
          backgroundColor: scrap.color,
        },
        style,
      ]}
    />
  );
}

export function Confetti({ active, onDone }: { active: boolean; onDone?: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  const scraps = useMemo<Scrap[]>(
    () =>
      Array.from({ length: COUNT }, (): Scrap => {
        // Rectangles of varied proportion. Squares read as pixels; long thin
        // slivers read as torn paper.
        const w = 5 + Math.random() * 7;
        return {
          color: PAPER[Math.floor(Math.random() * PAPER.length)]!,
          width: w,
          height: w * (1.4 + Math.random() * 1.6),
          startX: Math.random() * width,
          delay: Math.random() * 0.28,
          spin: (Math.random() < 0.5 ? -1 : 1) * (220 + Math.random() * 520),
          flutterAmp: 12 + Math.random() * 34,
          flutterFreq: 4 + Math.random() * 5,
          phase: Math.random() * Math.PI * 2,
        };
      }),
    [width],
  );

  useEffect(() => {
    if (!active || reduced) return;
    progress.value = 0;
    progress.value = withTiming(
      1,
      // Linear on purpose. The gravity curve lives per scrap, so easing the
      // shared clock as well would make every piece decelerate on the way
      // down, which is the one thing falling paper never does.
      { duration: DURATION, easing: Easing.linear },
      (finished) => {
        if (finished && onDone) runOnJS(onDone)();
      },
    );
  }, [active, reduced, progress, onDone]);

  // Someone who has asked for less motion gets none of this. The purchase is
  // still confirmed by the ticket itself, which is the part that matters.
  if (!active || reduced) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden>
      {scraps.map((scrap, i) => (
        <ScrapPiece key={i} scrap={scrap} progress={progress} fallDistance={height + 160} />
      ))}
    </View>
  );
}

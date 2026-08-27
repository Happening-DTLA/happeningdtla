import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { Easing } from "react-native-reanimated";

/**
 * Motion tokens.
 *
 * The brief is smooth and minimal. In practice that means one easing curve
 * used everywhere, durations short enough that nobody waits on them, and
 * movement small enough to be felt rather than watched — 10px, not 40. A
 * transition you notice is a transition that is too big.
 */
export const motion = {
  /** Entrances and reveals. */
  enter: 240,
  /** Presses, toggles, anything answering a finger. Must feel instant. */
  micro: 140,

  /** Distance a row travels on entry. Deliberately small. */
  rise: 10,

  /** Between staggered siblings. */
  stagger: 35,
  /**
   * Past this many items the delay stops growing. Without a cap, row 40 waits
   * a second and a half to appear and the list looks broken rather than
   * choreographed.
   */
  staggerCap: 7,

  /** One curve for the whole app: decelerate out, never bounce. */
  easeOut: Easing.out(Easing.cubic),
} as const;

/** Staggered delay for the nth sibling, capped so long lists stay responsive. */
export const stagger = (index: number) =>
  Math.min(index, motion.staggerCap) * motion.stagger;

/**
 * Whether the person has asked the system to reduce motion.
 *
 * Honoured everywhere rather than treated as an edge case: for someone with
 * vestibular sensitivity, decorative movement is not a flourish, it is a
 * reason to close the app. Animations become instant and the confetti does
 * not fire at all.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => active && setReduced(value))
      .catch(() => {
        /* unsupported here — assume motion is welcome */
      });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

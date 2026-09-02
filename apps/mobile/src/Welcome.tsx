import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Line, Pattern, Rect } from "react-native-svg";
import * as Haptics from "expo-haptics";
import type { ApiNight } from "@dtlahappening/core";
import { formatCalendarDate } from "@dtlahappening/core";
import { api } from "@/api";
import { theme, space, type, font } from "@/theme";
import { groupByCorridor, countVenues } from "@/corridors";
import { useReducedMotion } from "@/motion";

/**
 * The way in.
 *
 * Built as a screenprint being pulled, rather than a splash screen: a cyan
 * plate goes down first, the lime plate goes down over it a beat later and
 * lands fractionally off-register, and the type inverts under the blade as it
 * passes. That is the app's whole visual argument in one gesture — this is a
 * poster for a night out, not a utility.
 *
 * The knockout is real, not painted. The headline is rendered twice at
 * identical metrics: once in white on the black page, and once in near-black
 * inside a clipped layer that carries the lime. Animating that layer's width
 * is what makes each letter flip as the ink reaches it. The previous version
 * faked it by putting dark type near a band, which is why "ART NIGHT" was
 * invisible — the band never actually got there.
 *
 * Everything runs off staggered delays on one mount. Separate timers for a
 * dozen elements drift on a loaded JS thread and the sequence arrives ragged.
 */

const PLATE = 560;  // the under-colour going down
const INK = 640;    // the lime pass over it
const LEAD = 70;    // how far behind the under-plate the lime starts

/** Beats, from mount. Everything else is derived from these. */
const AT = {
  headline: 120,
  kicker: 300,
  date: LEAD + INK + 60,
  body: LEAD + INK + 150,
  cue: LEAD + INK + 560,
} as const;

/**
 * A misregistration. Real two-colour prints never line up perfectly, and the
 * sliver of another ink at the edge is the tell that something was printed
 * rather than rendered. Cyan under lime because that is what the pairing
 * actually looks like on paper.
 */
const MISREGISTER = "#22d3ee";
const OFFSET = { x: 4, y: 5 };

/**
 * Counts up to a number instead of printing it.
 *
 * Driven from JS rather than the UI thread on purpose: text content is not
 * something Reanimated can interpolate, and the alternative — an animated
 * TextInput — brings its own padding and font quirks for no gain on a screen
 * that is doing nothing else. Isolated in its own component so the twenty-odd
 * renders never touch the animated tree above it.
 */
/**
 * One corridor's colour in the key.
 *
 * Staggered off the same shared value the rest of the live half fades on, by
 * offsetting where each tick starts inside that one progress. Nine separate
 * timers would be nine chances to arrive out of order.
 */
function Tick({
  color,
  index,
  progress,
}: {
  color: string;
  index: number;
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (progress.value - index * 0.055) / 0.45));
    return { opacity: t, transform: [{ scaleX: t }] };
  });
  return (
    <Animated.View
      style={[
        { flex: 1, height: 5, backgroundColor: color, transformOrigin: "left" },
        style,
      ]}
    />
  );
}

function Tally({ to, duration = 700 }: { to: number; duration?: number }) {
  const [n, setN] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || to <= 0) { setN(to); return; }
    const started = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / duration);
      // Same deceleration as everything else on screen, so the number settles
      // at the same moment the elements around it stop moving.
      setN(Math.round(to * (1 - (1 - t) ** 3)));
      if (t >= 1) clearInterval(id);
    }, 32);
    return () => clearInterval(id);
  }, [to, duration, reduced]);

  return <Text style={[type.numeral, { color: theme.text, fontSize: 30 }]}>{n}</Text>;
}

export function Welcome({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  /**
   * The lockup's true width, measured rather than assumed — the window width
   * is not the layout width everywhere, and a band that stops short of the
   * edge stops looking printed.
   *
   * Held twice, deliberately. The shared value is what the plates animate
   * against, so their worklets close over nothing but shared values and are
   * registered once; feeding them React state instead re-registers the style
   * the moment the measurement lands, which killed the ink pass at 42% of the
   * way across. The state copy exists only to give the knocked-out copy of the
   * type an explicit width, which is a layout prop and has to be a real number.
   */
  const bleed = useSharedValue(0);
  const [bleedPx, setBleedPx] = useState(0);
  const reduced = useReducedMotion();
  const done = useRef(false);

  // Loaded while the poster is still printing, so the corridor key and the
  // counts are real by the time anyone reads them. Failure is silent — the
  // poster stands on its own copy and the app opens as normal.
  const [night, setNight] = useState<ApiNight | null>(null);
  useEffect(() => {
    let active = true;
    api.upcomingNight()
      .then((n) => { if (active) setNight(n); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const key = useMemo(() => {
    if (!night) return null;
    const groups = groupByCorridor(night.events);
    return { groups, stops: countVenues(night.events), date: formatCalendarDate(night.date) };
  }, [night]);

  const plate = useSharedValue(0);     // cyan going down
  const ink = useSharedValue(0);       // lime going down over it
  const blade = useSharedValue(0);     // the squeegee edge riding the lime
  const headline = useSharedValue(0);  // white type, printed before the ink
  const kicker = useSharedValue(0);
  const dateLine = useSharedValue(0);
  const body = useSharedValue(0);
  const marks = useSharedValue(0);     // crop marks
  const data = useSharedValue(0);      // the live half, whenever it lands
  const cue = useSharedValue(0);
  const breathe = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      // Someone who asked for less motion gets the poster, printed, at rest.
      for (const v of [plate, ink, headline, kicker, dateLine, body, marks, cue]) v.value = 1;
      return;
    }
    const rise = (delay: number, duration = 420) =>
      withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));

    plate.value = rise(0, PLATE);
    ink.value = withDelay(LEAD, withTiming(1, { duration: INK, easing: Easing.out(Easing.cubic) }));
    // The blade is only visible while it is moving. It arrives with the lime
    // and lifts at the end of the pass; a bar that stays put is a scrollbar.
    blade.value = withDelay(LEAD, withSequence(
      withTiming(1, { duration: 140 }),
      withDelay(INK - 300, withTiming(0, { duration: 220 })),
    ));
    headline.value = rise(AT.headline, 380);
    kicker.value = rise(AT.kicker);
    dateLine.value = rise(AT.date);
    body.value = rise(AT.body);
    marks.value = rise(AT.body + 120, 600);
    cue.value = withDelay(AT.cue, withRepeat(
      // Breathing, not blinking. A hard flash reads as an error state.
      withSequence(
        withTiming(1, { duration: 760, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.32, { duration: 940, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    ));
    // Ambient. Half a percent over five seconds is under the threshold of
    // noticing and over the threshold of feeling — the page reads as alive
    // instead of as a screenshot.
    breathe.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );

    return () => {
      for (const v of [plate, ink, blade, headline, kicker, dateLine, body, marks, data, cue, breathe, exit]) {
        cancelAnimation(v);
      }
    };
  }, [reduced, plate, ink, blade, headline, kicker, dateLine, body, marks, data, cue, breathe, exit]);

  // Fades in whenever the night arrives, which may be before or after the
  // print has finished. Either order looks deliberate.
  useEffect(() => {
    if (!key) return;
    data.value = reduced ? 1 : withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
  }, [key, reduced, data]);

  const dismiss = useCallback(() => {
    if (done.current) return;
    done.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (reduced) { onDone(); return; }
    cancelAnimation(cue);
    cancelAnimation(breathe);
    exit.value = withTiming(1, { duration: 320, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onDone)();
    });
  }, [reduced, onDone, cue, breathe, exit]);

  /* ---- geometry ------------------------------------------------------- */

  const PAD = space.xl;
  // Sized off the viewport rather than fixed, because "ART NIGHT" set in
  // Archivo Black is the widest thing in the app and a hardcoded size that
  // fits a Pro Max wraps on an SE. The divisor is deliberately conservative.
  const display = Math.min(52, Math.round((width - PAD * 2) / 6.4));
  const headStyle = {
    fontFamily: font.display,
    fontSize: display,
    lineHeight: Math.round(display * 1.02),
    letterSpacing: -1.6,
  } as const;
  const BLOCK_PAD = Math.round(display * 0.26);

  /* ---- styles --------------------------------------------------------- */

  const useRise = (v: typeof body, distance = 14) =>
    useAnimatedStyle(() => ({
      opacity: v.value,
      transform: [{ translateY: (1 - v.value) * distance }],
    }));

  const sKicker = useRise(kicker, 10);
  const sDate = useRise(dateLine, 16);
  const sBody = useRise(body, 18);
  const sData = useRise(data, 20);
  const sMarks = useAnimatedStyle(() => ({ opacity: marks.value * 0.55 }));
  const sCue = useAnimatedStyle(() => ({ opacity: cue.value }));

  const sSheet = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [{ scale: (1 + breathe.value * 0.006) * (1 - exit.value * 0.05) }],
  }));

  // The white type, printed before the ink so the lime has something to cover.
  const sHeadline = useAnimatedStyle(() => ({
    opacity: headline.value,
    transform: [{ translateY: (1 - headline.value) * 26 }],
  }));

  // The two plates. Both are clips whose width is the pass, so the ink edge is
  // the animation rather than something drawn on top of it. On exit they slide
  // off to the right — the print being pulled away, not a dialog dismissing.
  const sPlate = useAnimatedStyle(() => ({
    width: bleed.value * plate.value,
    transform: [{ translateX: exit.value * width * 0.7 }],
  }));
  const sInk = useAnimatedStyle(() => ({
    width: bleed.value * ink.value,
    transform: [{ translateX: exit.value * width * 0.55 }],
  }));
  const sBlade = useAnimatedStyle(() => ({ opacity: blade.value * (1 - exit.value) }));

  // Called, not rendered as a component: a component type declared inside
  // render is new every time, so the whole lockup would remount the moment the
  // night arrived — mid-print.
  const headlineAt = (color: string, fixedWidth?: number) => (
    <View style={{ paddingVertical: BLOCK_PAD, paddingHorizontal: PAD, width: fixedWidth }}>
      <Text style={[headStyle, { color }]} numberOfLines={1}>DTLA</Text>
      <Text style={[headStyle, { color }]} numberOfLines={1}>ART NIGHT</Text>
    </View>
  );

  return (
    <Animated.View
      style={[
        { position: "absolute", inset: 0, backgroundColor: theme.bg, justifyContent: "center" },
        sSheet,
      ]}
    >
      {/* Paper. A halftone at five percent is not seen so much as missed when
          it is absent — flat black is what a rendered screen looks like. The
          crop marks are the other half of that: printers' furniture, and the
          cheapest possible way to say "this came off a press". */}
      <Animated.View style={[{ position: "absolute", inset: 0 }, sMarks]} pointerEvents="none">
        <Svg width={width} height={height}>
          <Defs>
            <Pattern id="halftone" width="7" height="7" patternUnits="userSpaceOnUse">
              <Circle cx="1.2" cy="1.2" r="0.75" fill="#ffffff" fillOpacity={0.075} />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="url(#halftone)" />
          {[
            [26, 74], [width - 26, 74],
            [26, height - 74], [width - 26, height - 74],
          ].map(([x, y], i) => (
            <React.Fragment key={i}>
              <Line x1={x - 9} y1={y} x2={x + 9} y2={y} stroke={theme.textMuted} strokeWidth={1} />
              <Line x1={x} y1={y - 9} x2={x} y2={y + 9} stroke={theme.textMuted} strokeWidth={1} />
            </React.Fragment>
          ))}
        </Svg>
      </Animated.View>

      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel="Welcome to DTLA Art Night. Tap to continue."
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: PAD,
          // Biased above centre. A poster carries its weight in the upper two
          // thirds; dead-centre left an empty top third and a cramped cue.
          paddingBottom: Math.round(height * 0.1),
        }}
      >
        <Animated.Text style={[type.label, { color: theme.textMuted, marginBottom: space.md }, sKicker]}>
          Welcome to
        </Animated.Text>

        {/* The lockup. Full-bleed on purpose: a band that stops short of the
            edge looks like a component, and the whole point is that it does
            not. Negative margin cancels the page padding, and each layer
            re-applies it internally so the three copies of the type sit on
            exactly the same baseline. */}
        <View
          style={{ marginHorizontal: -PAD }}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            bleed.value = w;
            setBleedPx((prev) => (prev === w ? prev : w));
          }}
        >
          {/* Plate one, offset. Only its edge is ever visible. */}
          <Animated.View
            style={[
              {
                position: "absolute",
                left: OFFSET.x,
                top: OFFSET.y,
                bottom: -OFFSET.y,
                backgroundColor: MISREGISTER,
                overflow: "hidden",
              },
              sPlate,
            ]}
          />

          {/* The white type on the page. */}
          <Animated.View style={sHeadline}>
            {headlineAt(theme.text)}
          </Animated.View>

          {/* Plate two, carrying the knocked-out type. This clip is the whole
              trick: identical metrics to the layer beneath, revealed by width,
              so a letter inverts at the instant the ink reaches it. */}
          <Animated.View
            style={[
              {
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                backgroundColor: theme.accent,
                overflow: "hidden",
              },
              sInk,
            ]}
          >
            {headlineAt(theme.accentInk, bleedPx)}
            {/* The blade, riding the leading edge. */}
            <Animated.View
              style={[
                { position: "absolute", right: 0, top: 0, bottom: 0, width: 3, backgroundColor: "#8fbf3a" },
                sBlade,
              ]}
            />
          </Animated.View>
        </View>

        <Animated.Text
          style={[type.heading, { color: theme.text, marginTop: space.lg }, sDate]}
        >
          {key ? key.date : "First Thursday of the month"} · 6pm until late
        </Animated.Text>

        <Animated.Text style={[type.body, { color: theme.textMuted, marginTop: space.sm }, sBody]}>
          Galleries, studios, museums and rooftops open their doors across Downtown.
        </Animated.Text>

        {/* The live half, on a reserved height. Copy that reflows after it has
            been read is the cheapest-looking thing a launch screen can do, so
            the space is held whether or not the night ever arrives. */}
        <Animated.View
          style={[{ marginTop: space.xl, minHeight: 86, gap: space.md }, sData]}
          pointerEvents="none"
        >
          {key ? (
            <>
              {/* The poster's key, before it is a control. */}
              <View style={{ flexDirection: "row", gap: 4 }}>
                {key.groups.map((g, i) => (
                  <Tick key={g.corridor.slug} color={g.corridor.color} index={i} progress={data} />
                ))}
              </View>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.xl }}>
                <View>
                  <Tally to={key.stops} />
                  <Text style={[type.label, { color: theme.textMuted }]}>Stops</Text>
                </View>
                <View>
                  <Tally to={key.groups.length} />
                  <Text style={[type.label, { color: theme.textMuted }]}>Corridors</Text>
                </View>
              </View>
            </>
          ) : null}
        </Animated.View>

        <Animated.View
          style={[
            { position: "absolute", left: 0, right: 0, bottom: space.xxl * 2, alignItems: "center" },
            sCue,
          ]}
        >
          <Text style={[type.label, { color: theme.textMuted }]}>Tap to continue</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

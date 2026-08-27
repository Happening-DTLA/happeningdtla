import { useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import type { ApiEventSummary, ApiNight, EventCategory } from "@dtlahappening/core";
import {
  CATEGORY_LABELS,
  formatCalendarDate,
  formatCents,
  formatDate,
  formatTimeRange,
  shortNightName,
} from "@dtlahappening/core";
import { theme, space, radius, type } from "./theme";
import { motion, stagger, useReducedMotion } from "./motion";
import { useLikes } from "./likes-store";

/**
 * The entrance every list row uses.
 *
 * Ten pixels and a fade, decelerating. Small enough to be felt rather than
 * watched — the point is that the page settles, not that it performs. The
 * stagger is capped in motion.ts so the fortieth row does not wait a second
 * and a half to appear.
 */
export function Reveal({
  index = 0,
  children,
}: {
  index?: number;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      stagger(index),
      withTiming(1, { duration: motion.enter, easing: motion.easeOut }),
    );
  }, [index, reduced, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * motion.rise }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl }}>
      <ActivityIndicator color={theme.accent} />
    </View>
  );
}

/** Errors say what happened and give a way out — never a dead end. */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.lg }}>
      <Text style={[type.body, { color: theme.text, textAlign: "center" }]}>{message}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        style={({ pressed }) => ({
          backgroundColor: pressed ? theme.accent : "transparent",
          borderColor: theme.accent,
          borderWidth: 1,
          borderRadius: radius.control,
          paddingVertical: space.md,
          paddingHorizontal: space.xl,
        })}
      >
        {({ pressed }) => (
          <Text style={[type.label, { color: pressed ? theme.accentInk : theme.accent }]}>
            Try again
          </Text>
        )}
      </Pressable>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ alignItems: "center", padding: space.xxl, gap: space.sm }}>
      <Text style={[type.title, { color: theme.text, textAlign: "center" }]}>{title}</Text>
      <Text style={[type.body, { color: theme.textMuted, textAlign: "center" }]}>{body}</Text>
    </View>
  );
}

/**
 * A section marker, set as a printed rule.
 *
 * The rule is not decoration — it is what makes a stack of listings read as a
 * page rather than a feed. Small caps, wide, with the line running to the edge
 * the way a gig guide sets its headings.
 */
export function Label({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
      <Text style={[type.label, { color: theme.accent }]}>{children}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
    </View>
  );
}

export function CategoryChips({
  categories,
  selected,
  onSelect,
}: {
  categories: readonly EventCategory[];
  selected: EventCategory | null;
  onSelect: (c: EventCategory | null) => void;
}) {
  // Pills, against square everything else. The one round shape in the app
  // marks "this is a control you can flip" and gives the hard blocks something
  // to be hard against.
  const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        backgroundColor: active ? theme.accent : pressed ? theme.surface2 : "transparent",
        borderColor: active ? theme.accent : theme.border,
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingVertical: 7,
        paddingHorizontal: 14,
      })}
    >
      <Text style={[type.label, { color: active ? theme.accentInk : theme.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}
    >
      <Chip label="All" active={selected === null} onPress={() => onSelect(null)} />
      {categories.map((c) => (
        <Chip
          key={c}
          label={CATEGORY_LABELS[c]}
          active={selected === c}
          onPress={() => onSelect(selected === c ? null : c)}
        />
      ))}
    </ScrollView>
  );
}

/**
 * The city-wide night, as a poster.
 *
 * This is the one place in the app that shouts, and everything else is quiet so
 * that it can. The accent stops being a thin highlight and becomes what it is
 * on a real flyer — a second ink, laid down in a solid block with the type
 * knocked out of it.
 *
 * Art Night is a crawl: a dozen events across half a dozen venues in one
 * evening. Listed flat it reads as a dozen unrelated shows, which is the model
 * Eventbrite is stuck with and the thing this product exists to do better.
 */
export function NightCard({ night }: { night: ApiNight }) {
  const router = useRouter();
  const venueCount = new Set(night.events.map((e) => e.venue.id)).size;
  const neighborhoods = [
    ...new Set(
      night.events.map((e) => e.venue.neighborhood).filter((n): n is string => Boolean(n)),
    ),
  ];

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        router.push(`/n/${night.slug}`);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${shortNightName(night.name)}, ${night.events.length} events across ${venueCount} venues`}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      {/* The masthead band: solid ink, type knocked out. */}
      <View
        style={{
          backgroundColor: theme.accent,
          paddingHorizontal: space.lg,
          paddingVertical: space.sm,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={[type.label, { color: theme.accentInk }]}>City-wide night</Text>
        <Text style={[type.label, { color: theme.accentInk }]}>
          {night.events.length} events
        </Text>
      </View>

      <View
        style={{
          borderColor: theme.accent,
          borderWidth: 1,
          borderTopWidth: 0,
          paddingHorizontal: space.lg,
          paddingTop: space.lg,
          paddingBottom: space.md,
          gap: space.sm,
        }}
      >
        <Text style={[type.poster, { color: theme.text }]}>{shortNightName(night.name)}</Text>

        <View style={{ height: 1, backgroundColor: theme.border }} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md }}>
          <Text style={[type.meta, { color: theme.text, flex: 1 }]}>
            {formatCalendarDate(night.date)}
          </Text>
          <Text style={[type.meta, { color: theme.textMuted }]}>
            {venueCount} {venueCount === 1 ? "venue" : "venues"}
          </Text>
        </View>

        {neighborhoods.length > 0 ? (
          <Text style={[type.label, { color: theme.textMuted }]} numberOfLines={1}>
            {neighborhoods.join(" · ")}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Save / unsave an event.
 *
 * Nested inside EventCard's own Pressable. A child Pressable consumes the
 * touch, so tapping the heart saves the event rather than opening it — but it
 * needs real hitSlop, because the target is small and it sits next to a
 * control that navigates away.
 *
 * The haptic is the point of the interaction as much as the fill is: saving
 * something is the one moment in browsing where the phone should answer back.
 */
export function LikeButton({
  event,
  size = 22,
}: {
  event: ApiEventSummary;
  size?: number;
}) {
  const { isLiked, toggle } = useLikes();
  const liked = isLiked(event.id);
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(
          liked ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
        ).catch(() => {
          /* no taptic engine, or a simulator — the fill is still feedback */
        });
        // Only on the way in. A flourish for removing something is a small lie
        // about what just happened.
        if (!liked && !reduced) {
          scale.value = withSequence(
            withTiming(1.3, { duration: 110, easing: motion.easeOut }),
            withTiming(1, { duration: motion.micro, easing: motion.easeOut }),
          );
        }
        toggle(event);
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      accessibilityLabel={liked ? `Remove ${event.title} from saved` : `Save ${event.title}`}
      hitSlop={12}
    >
      <Animated.View style={pop}>
        <Ionicons
          name={liked ? "heart" : "heart-outline"}
          size={size}
          color={liked ? theme.accent : theme.textMuted}
        />
      </Animated.View>
    </Pressable>
  );
}

/**
 * One listing in the guide.
 *
 * Set as a ruled row rather than a floating card. A stack of rounded cards on a
 * dark ground is the default shape of every events app; hairline rules and a
 * hard left edge are how a printed gig guide sets the same information, and the
 * type does the work that a border was doing before.
 */
export function EventCard({
  event,
  showDate = false,
  index = 0,
}: {
  event: ApiEventSummary;
  showDate?: boolean;
  /** Position in its list, for the staggered entrance. */
  index?: number;
}) {
  const router = useRouter();
  return (
    <Reveal index={index}>
    <Pressable
      onPress={() => router.push(`/e/${event.slug}`)}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: pressed ? theme.surface : "transparent",
        borderTopColor: theme.border,
        borderTopWidth: 1,
        paddingVertical: space.lg,
        paddingHorizontal: space.lg,
        flexDirection: "row",
        justifyContent: "space-between",
        gap: space.lg,
      })}
    >
      <View style={{ flex: 1, gap: 5 }}>
        {showDate ? (
          <Text style={[type.label, { color: theme.accent }]}>{formatDate(event.startsAt)}</Text>
        ) : null}
        <Text style={[type.title, { color: theme.text }]}>{event.title}</Text>
        <Text style={[type.meta, { color: theme.text }]} numberOfLines={1}>
          {event.venue.name}
        </Text>
        <Text style={[type.meta, { color: theme.textMuted }]}>
          {formatTimeRange(event.startsAt, event.endsAt)}
          {event.minAge ? ` · ${event.minAge}+` : ""}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end", justifyContent: "space-between", gap: space.md }}>
        <View style={{ alignItems: "flex-end" }}>
          {event.soldOut ? (
            <Text style={[type.label, { color: theme.danger }]}>Sold out</Text>
          ) : event.isFree ? (
            <Text style={[type.numeral, { color: theme.accent }]}>FREE</Text>
          ) : (
            <>
              <Text style={[type.numeral, { color: theme.accent }]}>
                {formatCents(event.fromAllInCents ?? 0)}
              </Text>
              {/* All-in on the first surface — no fee reveal at checkout. */}
              <Text style={[type.label, { color: theme.textMuted, fontSize: 9 }]}>all-in</Text>
            </>
          )}
        </View>
        <LikeButton event={event} />
      </View>
    </Pressable>
    </Reveal>
  );
}

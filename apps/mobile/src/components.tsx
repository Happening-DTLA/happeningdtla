import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
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
import { theme, space } from "./theme";
import { useLikes } from "./likes-store";

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
      <Text style={{ color: theme.text, fontSize: 16, textAlign: "center", lineHeight: 23 }}>
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        style={({ pressed }) => ({
          backgroundColor: pressed ? theme.surface2 : theme.surface,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 10,
          paddingVertical: space.md,
          paddingHorizontal: space.xl,
        })}
      >
        <Text style={{ color: theme.accent, fontWeight: "600" }}>Try again</Text>
      </Pressable>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ alignItems: "center", padding: space.xxl, gap: space.sm }}>
      <Text style={{ color: theme.text, fontSize: 17, fontWeight: "600", textAlign: "center" }}>
        {title}
      </Text>
      <Text style={{ color: theme.textMuted, fontSize: 14, textAlign: "center", lineHeight: 21 }}>
        {body}
      </Text>
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: theme.textMuted,
        fontSize: 11,
        letterSpacing: 1.4,
        textTransform: "uppercase",
      }}
    >
      {children}
    </Text>
  );
}

/** Horizontal category filter. `null` means "everything". */
export function CategoryChips({
  categories,
  selected,
  onSelect,
}: {
  categories: readonly EventCategory[];
  selected: EventCategory | null;
  onSelect: (c: EventCategory | null) => void;
}) {
  const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        backgroundColor: active ? theme.accent : pressed ? theme.surface2 : theme.surface,
        borderColor: active ? theme.accent : theme.border,
        borderWidth: 1,
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 14,
      })}
    >
      <Text
        style={{
          color: active ? theme.accentInk : theme.text,
          fontSize: 13,
          fontWeight: active ? "700" : "500",
        }}
      >
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
 * The city-wide night, presented as one destination.
 *
 * Art Night is a crawl — a dozen events across half a dozen venues in a single
 * evening. Listed flat among everything else it reads as a dozen unrelated
 * shows, which is exactly the model Eventbrite is stuck with and the thing
 * this product exists to do better. One card, one night, one way in.
 *
 * The eyebrow says "city-wide night" rather than "first Thursday": the cadence
 * is a convention, not a guarantee, and a night moved for a holiday would make
 * the label a lie. The date underneath is the authority.
 */
export function NightCard({ night }: { night: ApiNight }) {
  const router = useRouter();
  const venueCount = new Set(night.events.map((e) => e.venue.id)).size;
  const neighborhoods = [
    ...new Set(
      night.events
        .map((e) => e.venue.neighborhood)
        .filter((n): n is string => Boolean(n)),
    ),
  ];

  return (
    <Pressable
      onPress={() => router.push(`/n/${night.slug}`)}
      accessibilityRole="button"
      accessibilityLabel={`${shortNightName(night.name)}, ${night.events.length} events across ${venueCount} venues`}
      style={({ pressed }) => ({
        backgroundColor: pressed ? theme.surface2 : theme.surface,
        borderColor: theme.accent,
        borderWidth: 1,
        borderRadius: 16,
        padding: space.xl,
        gap: space.sm,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <View
          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accent }}
        />
        <Text
          style={{
            color: theme.accent,
            fontSize: 11,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            fontWeight: "700",
          }}
        >
          City-wide night
        </Text>
      </View>

      <Text style={{ color: theme.text, fontSize: 30, fontWeight: "700", lineHeight: 34 }}>
        {shortNightName(night.name)}
      </Text>
      <Text style={{ color: theme.text, fontSize: 16, fontWeight: "500" }}>
        {formatCalendarDate(night.date)}
      </Text>

      {night.events.length > 0 ? (
        <Text style={{ color: theme.textMuted, fontSize: 14 }}>
          {night.events.length} {night.events.length === 1 ? "event" : "events"} across{" "}
          {venueCount} {venueCount === 1 ? "venue" : "venues"}
        </Text>
      ) : null}

      {neighborhoods.length > 0 ? (
        <Text style={{ color: theme.textMuted, fontSize: 13 }} numberOfLines={1}>
          {neighborhoods.join(" · ")}
        </Text>
      ) : null}

      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: space.xs }}
      >
        <Text style={{ color: theme.accent, fontSize: 14, fontWeight: "600" }}>
          See the whole night
        </Text>
        <Ionicons name="arrow-forward" size={15} color={theme.accent} />
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
  return (
    <Pressable
      onPress={() => toggle(event)}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      accessibilityLabel={liked ? `Remove ${event.title} from saved` : `Save ${event.title}`}
      hitSlop={12}
    >
      <Ionicons
        name={liked ? "heart" : "heart-outline"}
        size={size}
        color={liked ? theme.accent : theme.textMuted}
      />
    </Pressable>
  );
}

/**
 * The event card, shared by every list in the app.
 *
 * Navigates with router.push rather than <Link asChild> — asChild clones the
 * child into an <a> and drops the Pressable's style function, which renders the
 * card with no background, border or row layout.
 */
export function EventCard({
  event,
  showDate = false,
}: {
  event: ApiEventSummary;
  showDate?: boolean;
}) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/e/${event.slug}`)}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: pressed ? theme.surface2 : theme.surface,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: space.lg,
        flexDirection: "row",
        justifyContent: "space-between",
        gap: space.lg,
      })}
    >
      <View style={{ flex: 1, gap: 3 }}>
        {showDate ? (
          <Text style={{ color: theme.accent, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 }}>
            {formatDate(event.startsAt).toUpperCase()}
          </Text>
        ) : null}
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>{event.title}</Text>
        <Text style={{ color: theme.textMuted, fontSize: 14 }} numberOfLines={1}>
          {event.venue.name}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 12 }}>
          {formatTimeRange(event.startsAt, event.endsAt)}
          {event.minAge ? ` · ${event.minAge}+` : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", justifyContent: "space-between", gap: space.sm }}>
        <View style={{ alignItems: "flex-end" }}>
          {event.soldOut ? (
            <Text style={{ color: theme.danger, fontSize: 13 }}>Sold out</Text>
          ) : event.isFree ? (
            <Text style={{ color: theme.accent, fontSize: 15, fontWeight: "700" }}>Free</Text>
          ) : (
            <>
              <Text style={{ color: theme.accent, fontSize: 15, fontWeight: "700" }}>
                {formatCents(event.fromAllInCents ?? 0)}
              </Text>
              {/* All-in on the first surface — no fee reveal at checkout. */}
              <Text style={{ color: theme.textMuted, fontSize: 10 }}>all-in</Text>
            </>
          )}
        </View>
        <LikeButton event={event} />
      </View>
    </Pressable>
  );
}

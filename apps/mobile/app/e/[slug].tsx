import { useCallback, useEffect } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ApiTicketType } from "@dtlahappening/core";
import {
  formatCents,
  formatDate,
  formatTime,
  formatTimeRange,
  shortNightName,
} from "@dtlahappening/core";
import { api } from "@/api";
import { useAsync } from "@/useAsync";
import { theme, space } from "@/theme";
import { ErrorState, Label, LikeButton, Loading } from "@/components";
import { useLikes } from "@/likes-store";

export default function EventScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const fetcher = useCallback((signal: AbortSignal) => api.event(slug, signal), [slug]);
  const { status, data: event, error, retry } = useAsync(fetcher, [slug]);
  const { refreshSnapshot } = useLikes();
  const router = useRouter();

  // This screen holds the freshest copy of an event, so it is where a saved
  // snapshot gets brought up to date — no extra request, and a saved list
  // heals itself as events are browsed.
  //
  // Keyed on the id alone: refreshSnapshot's identity changes on every write
  // to the store, so depending on it would retrigger this effect with its own
  // result. (The store also compares before writing, so this cannot loop.)
  useEffect(() => {
    if (event) refreshSnapshot(event);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  if (status === "loading") return <Loading />;
  if (status === "error") return <ErrorState message={error.message} onRetry={retry} />;

  const { venue } = event;
  const query = encodeURIComponent(`${venue.address1}, ${venue.city}, ${venue.state} ${venue.zip}`);
  const mapsUrl = Platform.select({
    ios: `maps://?q=${query}`,
    default: `https://maps.google.com/?q=${query}`,
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2, gap: space.xl }}
    >
      <View style={{ gap: space.sm }}>
        {event.night ? (
          <Pressable
            onPress={() => router.push(`/n/${event.night!.slug}`)}
            accessibilityRole="button"
            hitSlop={6}
          >
            <Text style={{ color: theme.accent, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase" }}>
              Part of {shortNightName(event.night.name)} ›
            </Text>
          </Pressable>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
          <Text
            style={{ color: theme.text, fontSize: 28, fontWeight: "700", lineHeight: 33, flex: 1 }}
          >
            {event.title}
          </Text>
          <LikeButton event={event} size={26} />
        </View>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: "500" }}>
          {formatDate(event.startsAt)}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 13, fontVariant: ["tabular-nums"] }}>
          {event.doorsAt ? `Doors ${formatTime(event.doorsAt)} · ` : ""}
          {formatTimeRange(event.startsAt, event.endsAt)}
          {event.minAge ? ` · ${event.minAge}+` : ""}
        </Text>
      </View>

      {event.description ? (
        <Text style={{ color: theme.textMuted, fontSize: 15, lineHeight: 23 }}>
          {event.description}
        </Text>
      ) : null}

      <View
        style={{
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 12,
          padding: space.lg,
          gap: space.xs,
        }}
      >
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>{venue.name}</Text>
        <Text style={{ color: theme.textMuted, fontSize: 14 }}>
          {venue.address1}
          {venue.neighborhood ? ` · ${venue.neighborhood}` : ""}
        </Text>
        {event.organizer ? (
          <Text style={{ color: theme.textMuted, fontSize: 12 }}>
            Presented by {event.organizer.name}
          </Text>
        ) : null}
        <Pressable
          onPress={() => mapsUrl && Linking.openURL(mapsUrl)}
          accessibilityRole="link"
          style={{ marginTop: space.sm }}
        >
          <Text style={{ color: theme.accent, fontSize: 13, textDecorationLine: "underline" }}>
            Open in Maps
          </Text>
        </Pressable>
      </View>

      <View style={{ gap: space.md }}>
        <Label>Tickets</Label>
        {event.ticketTypes.map((tier) => (
          <TicketTier key={tier.id} tier={tier} slug={event.slug} />
        ))}
      </View>
    </ScrollView>
  );
}

function TicketTier({ tier, slug }: { tier: ApiTicketType; slug: string }) {
  const router = useRouter();
  const free = tier.priceCents === 0;
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: space.lg,
        gap: space.md,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.lg }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>{tier.name}</Text>
          {tier.description ? (
            <Text style={{ color: theme.textMuted, fontSize: 14 }}>{tier.description}</Text>
          ) : null}
          {/* Fee stated next to the price, before any commitment. */}
          {!free ? (
            <Text style={{ color: theme.textMuted, fontSize: 12, fontVariant: ["tabular-nums"] }}>
              {formatCents(tier.priceCents)} + {formatCents(tier.serviceFeeCents)} fee
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: theme.accent, fontSize: 19, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
            {free ? "Free" : formatCents(tier.allInCents)}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 10 }}>
            {free ? "no ticket needed" : "all-in"}
          </Text>
        </View>
      </View>

      {free ? (
        // No RSVP flow exists yet, and sending people into a paid checkout that
        // rejects free orders would be a dead end with an error alert. Say the
        // true thing instead: for a free gallery night you just turn up.
        <View
          style={{
            backgroundColor: theme.surface2,
            borderRadius: 10,
            paddingVertical: 14,
            paddingHorizontal: space.md,
            alignItems: "center",
          }}
        >
          <Text style={{ color: theme.text, fontWeight: "600", fontSize: 15 }}>
            Just show up
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
            Free entry — no ticket needed
          </Text>
        </View>
      ) : (
        <Pressable
          disabled={tier.soldOut}
          onPress={() => router.push(`/buy/${slug}?tier=${tier.id}`)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            backgroundColor: tier.soldOut ? theme.surface2 : pressed ? "#a8db55" : theme.accent,
            borderRadius: 10,
            paddingVertical: 14,
            alignItems: "center",
          })}
        >
          <Text
            style={{
              color: tier.soldOut ? theme.textMuted : theme.accentInk,
              fontWeight: "700",
              fontSize: 15,
            }}
          >
            {tier.soldOut ? "Sold out" : "Get tickets"}
          </Text>
        </Pressable>
      )}

      {!tier.soldOut && tier.remaining < 25 ? (
        <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: "center" }}>
          {tier.remaining} left
        </Text>
      ) : null}
    </View>
  );
}

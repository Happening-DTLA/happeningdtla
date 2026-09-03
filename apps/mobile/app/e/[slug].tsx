import { useCallback, useEffect, useRef, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type { ApiTicketType } from "@dtlahappening/core";
import {
  formatCalendarDate,
  formatCents,
  formatDate,
  formatTime,
  formatTimeRange,
  relativeEventTime,
  shortNightName,
} from "@dtlahappening/core";
import { api, API_BASE_URL } from "@/api";
import { useAsync } from "@/useAsync";
import { theme, space, radius, type } from "@/theme";
import { ErrorState, EventCard, Label, LikeButton, Loading } from "@/components";
import { useLikes } from "@/likes-store";
import { TICKETING_ENABLED } from "@/features";
import { EventMap } from "@/EventMap";
import { VenuePhotos } from "@/VenuePhotos";

const Section = ({ children }: { children: React.ReactNode }) => (
  <View style={{ paddingHorizontal: space.lg, gap: space.md }}>{children}</View>
);

export default function EventScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const fetcher = useCallback((signal: AbortSignal) => api.event(slug, signal), [slug]);
  const { status, data: event, error, retry } = useAsync(fetcher, [slug]);
  const { refreshSnapshot } = useLikes();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [ticketsY, setTicketsY] = useState(0);

  // The rest of the night, for "also on". Its own request, and a failure is
  // silent — the page is about this event, and a missing sidebar is not worth
  // an error state.
  const nightSlug = event?.night?.slug ?? null;
  const nightFetcher = useCallback(
    (s: AbortSignal) => (nightSlug ? api.night(nightSlug, s) : Promise.resolve(null)),
    [nightSlug],
  );
  const night = useAsync(nightFetcher, [nightSlug]);

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
  const when = relativeEventTime(event.startsAt, event.endsAt);
  const over = when === "Ended";
  const live = when === "Happening now";
  const soon = live || when.startsWith("Starts in") || when === "Tonight" || when === "Today";

  const query = encodeURIComponent(`${venue.address1}, ${venue.city}, ${venue.state} ${venue.zip}`);
  const mapsUrl = Platform.select({
    ios: `maps://?q=${query}`,
    default: `https://maps.google.com/?q=${query}`,
  });

  const siblings = (night.data?.events ?? []).filter((e) => e.id !== event.id);
  const sameVenue = siblings.filter((e) => e.venue.id === venue.id).slice(0, 2);
  const elsewhere = siblings.filter((e) => e.venue.id !== venue.id).slice(0, 3);

  const cheapest = event.ticketTypes
    .filter((t) => !t.soldOut)
    .sort((a, b) => a.allInCents - b.allInCents)[0];

  const share = () =>
    Share.share({
      message: `${event.title} — ${formatDate(event.startsAt)} at ${venue.name}`,
      url: `${API_BASE_URL}/e/${event.slug}`,
    }).catch(() => {
      /* dismissed, or no share sheet on this platform */
    });

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 88 + insets.bottom, gap: space.xl }}
      >
        {/* The flyer, uncropped.
            Eventbrite letterboxes a portrait flyer into a wide hero and slices
            off the edges — on the reference recording the doors and show times
            were cropped away, so the picture said less than the poster did.
            For DTLA art and music the flyer IS the information, so it is
            contained on a dark field rather than cropped to fit a shape. */}
        {event.imageUrl ? (
          <Image
            source={event.imageUrl}
            style={{ width: "100%", height: 320, backgroundColor: theme.surface }}
            // `contain`, not cover. Eventbrite letterboxes a portrait flyer
            // into a wide hero and slices the edges off — in the reference
            // recording that removed the doors and show times, so the page
            // said less than the picture it was displaying.
            contentFit="contain"
            // expo-image rather than RN's: it caches to disk between launches,
            // so a flyer you have already seen is instant on the next open.
            cachePolicy="memory-disk"
            transition={220}
            accessibilityIgnoresInvertColors
          />
        ) : null}

        {/* The venue, when there is no flyer to lead with — which on an
            ArtNight night is every listing, because these are open doors
            rather than promoted shows. Renders nothing when the venue has no
            photographs, which is three quarters of them. */}
        {!event.imageUrl ? <VenuePhotos photos={venue.photos} name={venue.name} /> : null}

        <Section>
          {event.night ? (
            <Pressable
              onPress={() => router.push(`/n/${event.night!.slug}`)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                backgroundColor: pressed ? theme.surface2 : theme.surface,
                borderColor: theme.accent,
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: space.md,
                paddingHorizontal: space.lg,
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
              })}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: theme.accent,
                    fontSize: 11,
                    letterSpacing: 1.4,
                    textTransform: "uppercase",
                    fontWeight: "700",
                  }}
                >
                  Part of {shortNightName(event.night.name)}
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 2 }}>
                  {formatCalendarDate(event.night.date)}
                  {siblings.length > 0 ? ` · ${siblings.length} more events` : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.accent} />
            </Pressable>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
            <Text
              style={{ color: theme.text, fontSize: 28, fontWeight: "700", lineHeight: 33, flex: 1 }}
            >
              {event.title}
            </Text>
            <LikeButton event={event} size={26} />
            <Pressable onPress={share} accessibilityRole="button" accessibilityLabel="Share this event" hitSlop={12}>
              <Ionicons name="share-outline" size={24} color={theme.textMuted} />
            </Pressable>
          </View>

          {/* When, answered before what date.
              Nightlife is decided on a horizon of hours: "Tonight" and
              "Starts in 40 min" change whether someone leaves the house, and a
              date alone does not. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
            <View
              style={{
                backgroundColor: over ? theme.surface2 : live || soon ? theme.accent : theme.surface,
                borderColor: over ? theme.border : theme.accent,
                borderWidth: 1,
                borderRadius: 999,
                paddingVertical: 5,
                paddingHorizontal: 11,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              {live ? (
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accentInk }} />
              ) : null}
              <Text
                style={{
                  color: over ? theme.textMuted : live || soon ? theme.accentInk : theme.accent,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {when}
              </Text>
            </View>
            {event.minAge ? (
              <View
                style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  borderWidth: 1,
                  borderRadius: 999,
                  paddingVertical: 5,
                  paddingHorizontal: 11,
                }}
              >
                <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: "600" }}>
                  {event.minAge}+
                </Text>
              </View>
            ) : null}
          </View>

          <View style={{ gap: 2 }}>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: "500" }}>
              {formatDate(event.startsAt)}
            </Text>
            {/* Doors and show, separately. The reference page showed one time
                while its own flyer advertised two, so the app knew less than
                the picture it was displaying. */}
            {event.doorsAt ? (
              <Text style={{ color: theme.textMuted, fontSize: 13, fontVariant: ["tabular-nums"] }}>
                Doors {formatTime(event.doorsAt)} · Show {formatTimeRange(event.startsAt, event.endsAt)}
              </Text>
            ) : (
              <Text style={{ color: theme.textMuted, fontSize: 13, fontVariant: ["tabular-nums"] }}>
                {formatTimeRange(event.startsAt, event.endsAt)}
              </Text>
            )}
          </View>
        </Section>

        {event.description ? (
          <Section>
            <Label>About</Label>
            <Text style={{ color: theme.textMuted, fontSize: 15, lineHeight: 23 }}>
              {event.description}
            </Text>
          </Section>
        ) : null}

        {/* Where, shown rather than linked.
            The reference hides its map behind a "Show map" tap and then plots
            only the venue. This one is open by default and, on the map tab,
            the same component draws where you are too. */}
        <Section>
          <Label>Where</Label>
          <View
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
              borderWidth: 1,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {venue.lat !== null && venue.lng !== null ? (
              <View style={{ height: 160 }}>
                <EventMap
                  pins={[{ venue: { ...venue, lat: venue.lat, lng: venue.lng }, events: [event] }]}
                  shownIds={new Set([venue.id])}
                  selectedVenueId={null}
                  onSelectVenue={() => {}}
                  showUserLocation={false}
                  userCoords={null}
                  region={{
                    latitude: venue.lat,
                    longitude: venue.lng,
                    latitudeDelta: 0.006,
                    longitudeDelta: 0.006,
                  }}
                />
              </View>
            ) : null}
            <View style={{ padding: space.lg, gap: space.xs }}>
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
                  Directions
                </Text>
              </Pressable>
            </View>
          </View>
        </Section>

        {TICKETING_ENABLED ? (
          <View onLayout={(e) => setTicketsY(e.nativeEvent.layout.y)}>
            <Section>
              <Label>Tickets</Label>
              {event.ticketTypes.map((tier) => (
                <TicketTier key={tier.id} tier={tier} slug={event.slug} ended={over} />
              ))}
            </Section>
          </View>
        ) : (
          /* ArtNight is free and open. What someone needs here is the venue —
             what kind of place it is, whether they can bring a kid, and a way
             to look it up — not a purchase flow for a ticket that costs nothing. */
          <Section>
            <Label>The venue</Label>
            <View
              style={{
                borderColor: theme.border,
                borderWidth: 1,
                padding: space.lg,
                gap: space.md,
              }}
            >
              {venue.kind ? (
                <Text style={[type.label, { color: theme.accent }]}>{venue.kind}</Text>
              ) : null}
              {venue.tags.length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                  {venue.tags.map((t) => (
                    <View
                      key={t}
                      style={{
                        borderColor: theme.border,
                        borderWidth: 1,
                        borderRadius: radius.pill,
                        paddingVertical: 5,
                        paddingHorizontal: 11,
                      }}
                    >
                      <Text style={[type.label, { color: theme.textMuted }]}>{t}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text style={[type.body, { color: theme.textMuted }]}>
                Free to walk in. No ticket needed.
              </Text>
              {venue.website ? (
                <Pressable
                  onPress={() => Linking.openURL(venue.website!).catch(() => {})}
                  accessibilityRole="link"
                >
                  <Text style={[type.label, { color: theme.accent }]}>Visit their site ›</Text>
                </Pressable>
              ) : null}
            </View>
          </Section>
        )}

        {/* What Eventbrite fills with paid ads.
            Its longest section is "More like this", and on the recording two of
            the first three were Promoted — a page the venue is paying to be on,
            spending its tail selling a competitor. The same space here answers
            the question a crawl actually raises: what else can I walk to
            tonight, starting with this venue's own room. */}
        {sameVenue.length + elsewhere.length > 0 ? (
          <View style={{ gap: space.md }}>
            <View style={{ paddingHorizontal: space.lg }}>
              <Label>Also on that night</Label>
            </View>
            {sameVenue.length > 0 ? (
              <View>
                <Text
                  style={[type.label, { color: theme.textMuted, paddingHorizontal: space.lg, paddingBottom: space.sm }]}
                >
                  Same room, same night
                </Text>
                {sameVenue.map((e, i) => (
                  <EventCard key={e.id} event={e} index={i} />
                ))}
              </View>
            ) : null}
            {elsewhere.length > 0 ? (
              <View style={{ marginTop: sameVenue.length ? space.md : 0 }}>
                <Text
                  style={[type.label, { color: theme.textMuted, paddingHorizontal: space.lg, paddingBottom: space.sm }]}
                >
                  Nearby that night
                </Text>
                {elsewhere.map((e, i) => (
                  <EventCard key={e.id} event={e} index={i} />
                ))}
              </View>
            ) : null}
            {event.night ? (
              <Pressable
                onPress={() => router.push(`/n/${event.night!.slug}`)}
                accessibilityRole="button"
                style={{ paddingVertical: space.sm, paddingHorizontal: space.lg }}
              >
                <Text style={[type.label, { color: theme.accent }]}>
                  See the whole night ›
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Price and the way in, always reachable. Genuinely the best thing
          about the reference page — but it states a bare range, so the low
          number can be a tier that is already gone. This one quotes a price
          that is actually buyable, all-in, or says why there isn't one.
          Shown only when this build sells tickets. */}
      {TICKETING_ENABLED ? (
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: "row",
          alignItems: "center",
          gap: space.lg,
          paddingHorizontal: space.lg,
          paddingTop: space.md,
          paddingBottom: space.md + insets.bottom,
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: 1,
        }}
      >
        <View style={{ flex: 1 }}>
          {over ? (
            <Text style={{ color: theme.textMuted, fontSize: 15, fontWeight: "600" }}>
              This event has ended
            </Text>
          ) : event.isFree ? (
            <>
              <Text style={{ color: theme.accent, fontSize: 18, fontWeight: "700" }}>Free</Text>
              <Text style={{ color: theme.textMuted, fontSize: 11 }}>no ticket needed</Text>
            </>
          ) : cheapest ? (
            <>
              <Text
                style={{
                  color: theme.text,
                  fontSize: 18,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                }}
              >
                from {formatCents(cheapest.allInCents)}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                all-in · fees included
              </Text>
            </>
          ) : (
            <Text style={{ color: theme.danger, fontSize: 15, fontWeight: "600" }}>Sold out</Text>
          )}
        </View>

        {!over && !event.isFree && cheapest ? (
          <Pressable
            onPress={() => scrollRef.current?.scrollTo({ y: Math.max(0, ticketsY - 12), animated: true })}
            accessibilityRole="button"
            style={({ pressed }) => ({
              backgroundColor: pressed ? "#a8db55" : theme.accent,
              borderRadius: 10,
              paddingVertical: 13,
              paddingHorizontal: space.xl,
            })}
          >
            <Text style={{ color: theme.accentInk, fontWeight: "700", fontSize: 15 }}>
              Get tickets
            </Text>
          </Pressable>
        ) : null}
      </View>
      ) : null}
    </View>
  );
}

function TicketTier({
  tier,
  slug,
  ended,
}: {
  tier: ApiTicketType;
  slug: string;
  ended: boolean;
}) {
  const router = useRouter();
  const free = tier.priceCents === 0;
  const unavailable = tier.soldOut || ended;
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
          <Text style={{ color: theme.text, fontWeight: "600", fontSize: 15 }}>Just show up</Text>
          <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
            Free entry — no ticket needed
          </Text>
        </View>
      ) : (
        <Pressable
          disabled={unavailable}
          onPress={() => router.push(`/buy/${slug}?tier=${tier.id}`)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            backgroundColor: unavailable ? theme.surface2 : pressed ? "#a8db55" : theme.accent,
            borderRadius: 10,
            paddingVertical: 14,
            alignItems: "center",
          })}
        >
          <Text
            style={{
              color: unavailable ? theme.textMuted : theme.accentInk,
              fontWeight: "700",
              fontSize: 15,
            }}
          >
            {tier.soldOut ? "Sold out" : ended ? "Event ended" : "Get tickets"}
          </Text>
        </Pressable>
      )}

      {/* A real number or nothing. "Few tickets left" with no count, as on the
          reference page, is a claim the buyer cannot check and we would not be
          able to defend; below the threshold this is the actual remaining
          inventory, and above it we say nothing at all. */}
      {!unavailable && tier.remaining < 25 ? (
        <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: "center" }}>
          {tier.remaining} left
        </Text>
      ) : null}
    </View>
  );
}

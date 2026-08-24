import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { formatCents, priceBreakdown } from "@dtlahappening/core";
import { api } from "@/api";
import { useAsync } from "@/useAsync";
import { useCheckout } from "@/useCheckout";
import { theme, space } from "@/theme";
import { ErrorState, Loading } from "@/components";

export default function BuyScreen() {
  const { slug, tier: tierId } = useLocalSearchParams<{ slug: string; tier: string }>();
  const fetcher = useCallback((s: AbortSignal) => api.event(slug, s), [slug]);
  const { status, data: event, error, retry } = useAsync(fetcher, [slug]);

  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState("");
  const { buy, busy, canPayHere } = useCheckout();

  if (status === "loading") return <Loading />;
  if (status === "error") return <ErrorState message={error.message} onRetry={retry} />;

  const tier = event.ticketTypes.find((t) => t.id === tierId);
  if (!tier) return <ErrorState message="That ticket type is no longer available." onRetry={retry} />;

  const max = Math.min(tier.maxPerOrder, tier.remaining);
  const { subtotalCents, serviceFeeCents, totalCents } = priceBreakdown(tier.priceCents * quantity);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const blocked = busy || (canPayHere && !emailValid);

  const Step = ({ dir, disabled }: { dir: -1 | 1; disabled: boolean }) => (
    <Pressable
      onPress={() => setQuantity((q) => Math.min(max, Math.max(1, q + dir)))}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={dir === 1 ? "Increase quantity" : "Decrease quantity"}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? theme.surface2 : theme.surface,
        borderColor: theme.border,
        borderWidth: 1,
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <Ionicons name={dir === 1 ? "add" : "remove"} size={20} color={theme.text} />
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.bg }}
    >
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl }} keyboardDismissMode="on-drag">
        <View style={{ gap: 4 }}>
          <Text style={{ color: theme.textMuted, fontSize: 13 }}>{event.title}</Text>
          <Text style={{ color: theme.text, fontSize: 24, fontWeight: "700" }}>{tier.name}</Text>
          {tier.description ? (
            <Text style={{ color: theme.textMuted, fontSize: 14 }}>{tier.description}</Text>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>How many?</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
            <Step dir={-1} disabled={quantity <= 1} />
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: "700", minWidth: 28, textAlign: "center" }}>
              {quantity}
            </Text>
            <Step dir={1} disabled={quantity >= max} />
          </View>
        </View>
        {quantity >= max ? (
          <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: -space.md }}>
            {tier.remaining < tier.maxPerOrder
              ? `Only ${tier.remaining} left.`
              : `Limit ${tier.maxPerOrder} per order.`}
          </Text>
        ) : null}

        <View style={{ gap: space.sm }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>Where do we send them?</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={theme.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: space.md,
              paddingVertical: 14,
              color: theme.text,
              fontSize: 16,
            }}
          />
          {/* No account required — asking people to sign up before they can pay
              is the single biggest drop-off point in ticketing. */}
          <Text style={{ color: theme.textMuted, fontSize: 12 }}>
            No account needed. Your tickets stay in this app too.
          </Text>
        </View>

        {/* Every line shown before the button, not after it. */}
        <View
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: space.lg,
            gap: space.sm,
          }}
        >
          <Row label={`${quantity} × ${tier.name}`} value={formatCents(subtotalCents)} />
          <Row label="Service fee" value={formatCents(serviceFeeCents)} />
          <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 2 }} />
          <Row label="Total" value={formatCents(totalCents)} bold />
        </View>

        <Pressable
          disabled={blocked}
          onPress={() =>
            buy({
              eventId: event.id,
              eventSlug: event.slug,
              ticketTypeId: tier.id,
              quantity,
              buyerEmail: email.trim(),
              eventTitle: event.title,
            })
          }
          accessibilityRole="button"
          style={({ pressed }) => ({
            backgroundColor: blocked ? theme.surface2 : pressed ? "#a8db55" : theme.accent,
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: "center",
          })}
        >
          <Text
            style={{
              color: blocked ? theme.textMuted : theme.accentInk,
              fontWeight: "700",
              fontSize: 16,
            }}
          >
            {busy
              ? "Starting checkout…"
              : canPayHere
                ? `Pay ${formatCents(totalCents)}`
                : "Get tickets on the web"}
          </Text>
        </Pressable>

        {/* Don't let the button imply a payment this platform can't take. */}
        {!canPayHere ? (
          <Text
            style={{
              color: theme.textMuted,
              fontSize: 12,
              textAlign: "center",
              marginTop: -space.md,
            }}
          >
            The payment sheet is iOS and Android only. This opens the event on
            the website.
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: bold ? theme.text : theme.textMuted, fontSize: bold ? 16 : 14, fontWeight: bold ? "700" : "400" }}>
        {label}
      </Text>
      <Text style={{ color: bold ? theme.accent : theme.textMuted, fontSize: bold ? 16 : 14, fontWeight: bold ? "700" : "400" }}>
        {value}
      </Text>
    </View>
  );
}

import { ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, space } from "@/theme";

/**
 * The ticket wallet.
 *
 * Empty until checkout exists — tickets can only appear here once there is a
 * paid order behind them. Wiring this to fake tickets would make the hardest
 * part of the product look finished when it isn't.
 *
 * When it is real: each ticket renders a QR from Ticket.code, cached on the
 * device so it opens with no signal (see docs/ROADMAP.md).
 */
export default function TicketsScreen() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: space.xl, gap: space.lg }}
    >
      <View style={{ alignItems: "center", gap: space.md }}>
        <Ionicons name="ticket-outline" size={44} color={theme.textMuted} />
        <Text style={{ color: theme.text, fontSize: 19, fontWeight: "700", textAlign: "center" }}>
          No tickets yet
        </Text>
        <Text
          style={{
            color: theme.textMuted,
            fontSize: 15,
            lineHeight: 22,
            textAlign: "center",
            maxWidth: 300,
          }}
        >
          Tickets you buy will live here, with a QR code that works even when
          the venue has no signal.
        </Text>
      </View>

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
        <Text style={{ color: theme.textMuted, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>
          In development
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 14, lineHeight: 21 }}>
          Checkout is not wired up yet. It needs Stripe keys and a decision on
          who the merchant of record is — see the partner brief in docs/.
        </Text>
      </View>
    </ScrollView>
  );
}

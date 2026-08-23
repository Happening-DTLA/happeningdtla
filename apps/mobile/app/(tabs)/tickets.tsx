import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import type { ApiOrder } from "@dtlahappening/core";
import { formatDate, formatTicketCode, formatTime } from "@dtlahappening/core";
import { api } from "@/api";
import { loadOrders } from "@/orders-store";
import { theme, space } from "@/theme";
import { Loading } from "@/components";

/**
 * The ticket wallet.
 *
 * Orders live in SecureStore on this device because guest checkout has no
 * account to attach them to. Each stored entry carries the access token that
 * authorises reading its ticket codes back.
 */
export default function TicketsScreen() {
  const [orders, setOrders] = useState<ApiOrder[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const stored = await loadOrders();
    if (stored.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }
    const results = await Promise.allSettled(
      stored.map((s) => api.order(s.orderId, s.accessToken)),
    );
    // A single unreachable order shouldn't blank the whole wallet.
    setOrders(
      results
        .filter((r): r is PromiseFulfilledResult<ApiOrder> => r.status === "fulfilled")
        .map((r) => r.value),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-check on focus so a just-completed purchase appears without a restart.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  if (loading && orders === null) return <Loading />;

  const paid = (orders ?? []).filter((o) => o.status === "PAID");

  if (paid.length === 0) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: space.xl, gap: space.md }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={theme.textMuted} />}
      >
        <View style={{ alignItems: "center", gap: space.md }}>
          <Ionicons name="ticket-outline" size={44} color={theme.textMuted} />
          <Text style={{ color: theme.text, fontSize: 19, fontWeight: "700", textAlign: "center" }}>
            No tickets yet
          </Text>
          <Text
            style={{ color: theme.textMuted, fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 300 }}
          >
            Tickets you buy will live here, with a QR code that works even when
            the venue has no signal.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: space.xxl * 2 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={theme.textMuted} />}
    >
      {paid.map((order) => (
        <View key={order.id} style={{ gap: space.md }}>
          <View style={{ gap: 2 }}>
            <Text style={{ color: theme.text, fontSize: 19, fontWeight: "700" }}>{order.event.title}</Text>
            <Text style={{ color: theme.textMuted, fontSize: 14 }}>
              {formatDate(order.event.startsAt)} · {formatTime(order.event.startsAt)}
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 14 }}>{order.event.venueName}</Text>
          </View>

          {order.tickets.map((ticket, i) => (
            <View
              key={ticket.id}
              style={{
                backgroundColor: theme.surface,
                borderColor: ticket.checkedInAt ? theme.border : theme.accent,
                borderWidth: 1,
                borderRadius: 16,
                padding: space.lg,
                alignItems: "center",
                gap: space.md,
                opacity: ticket.checkedInAt ? 0.55 : 1,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
                <Text style={{ color: theme.text, fontWeight: "600" }}>{ticket.tierName}</Text>
                <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                  {i + 1} of {order.tickets.length}
                </Text>
              </View>

              {/* White plate behind the QR: scanners need the quiet zone and
                  the contrast, and a dark-on-dark code reads badly at a door. */}
              <View style={{ backgroundColor: "#ffffff", padding: space.md, borderRadius: 10 }}>
                <QRCode value={ticket.code} size={190} backgroundColor="#ffffff" color="#000000" />
              </View>

              {/* Printed too, so a cracked or dim screen can still be typed in. */}
              <Text style={{ color: theme.textMuted, fontSize: 13, letterSpacing: 1 }}>
                {formatTicketCode(ticket.code)}
              </Text>

              {ticket.checkedInAt ? (
                <Text style={{ color: theme.textMuted, fontSize: 13, fontWeight: "600" }}>
                  Checked in {formatTime(ticket.checkedInAt)}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, space } from "@/theme";
import { API_BASE_URL } from "@/api";

/**
 * Profile. Signed-out state only for now — auth arrives with checkout, since
 * guest checkout means an account is optional right up until someone wants
 * their tickets on a second device.
 */
function Row({ icon, label, hint }: { icon: keyof typeof Ionicons.glyphMap; label: string; hint?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: pressed ? theme.surface2 : theme.surface,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: space.lg,
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
      })}
    >
      <Ionicons name={icon} size={20} color={theme.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: "500" }}>{label}</Text>
        {hint ? <Text style={{ color: theme.textMuted, fontSize: 12 }}>{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }}
    >
      <View
        style={{
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 12,
          padding: space.xl,
          alignItems: "center",
          gap: space.md,
        }}
      >
        <Ionicons name="person-circle-outline" size={52} color={theme.textMuted} />
        <Text style={{ color: theme.text, fontSize: 17, fontWeight: "700" }}>Not signed in</Text>
        <Text style={{ color: theme.textMuted, fontSize: 14, textAlign: "center", lineHeight: 21 }}>
          You can buy tickets without an account. Sign in to keep them across
          devices and follow venues you like.
        </Text>
      </View>

      <View style={{ gap: space.md }}>
        <Row icon="bookmark-outline" label="Saved events" hint="Coming soon" />
        <Row icon="receipt-outline" label="Order history" hint="Coming soon" />
        <Row icon="notifications-outline" label="Notifications" hint="Coming soon" />
        <Row icon="business-outline" label="For organizers" hint="Manage your venue's events" />
      </View>

      <View style={{ gap: 4, paddingTop: space.md }}>
        <Text style={{ color: theme.textMuted, fontSize: 11 }}>DTLAHappening — development build</Text>
        <Text style={{ color: theme.textMuted, fontSize: 11 }}>API: {API_BASE_URL}</Text>
      </View>
    </ScrollView>
  );
}

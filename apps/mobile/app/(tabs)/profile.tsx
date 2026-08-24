import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { theme, space } from "@/theme";
import { API_BASE_URL } from "@/api";

/**
 * Profile. Signed-out state only for now — auth arrives with checkout, since
 * guest checkout means an account is optional right up until someone wants
 * their tickets on a second device.
 */
function Row({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
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
  const router = useRouter();
  // Clerk hooks are safe when the provider is absent — isLoaded stays false
  // and the account block simply doesn't render. Accounts are optional here.
  const { isSignedIn, signOut, isLoaded } = useAuth();
  const { user } = useUser();

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
        {isLoaded && isSignedIn ? (
          <Row
            icon="person-circle-outline"
            label={user?.primaryEmailAddress?.emailAddress ?? "Your account"}
            hint="Signed in — tickets follow this account"
            onPress={() =>
              Alert.alert("Sign out?", "Your tickets stay on this device either way.", [
                { text: "Cancel", style: "cancel" },
                { text: "Sign out", style: "destructive", onPress: () => signOut() },
              ])
            }
          />
        ) : (
          <Row
            icon="log-in-outline"
            label="Sign in or create an account"
            hint="Optional — keeps your tickets across devices"
            onPress={() => router.push("/account/sign-in")}
          />
        )}
        <Row icon="bookmark-outline" label="Saved events" hint="Coming soon" />
        <Row icon="receipt-outline" label="Order history" hint="Coming soon" />
        <Row icon="notifications-outline" label="Notifications" hint="Coming soon" />
        <Row icon="business-outline" label="For organizers" hint="Manage your venue's events" />
        {/* Staff-only. Reaching this screen grants nothing on its own — the
            device still has to be paired with a code from an organizer. */}
        <Row
          icon="scan-outline"
          label="Door scanner"
          hint="Venue staff — needs a pairing code"
          onPress={() => router.push("/door/scan")}
        />
      </View>

      <View style={{ gap: 4, paddingTop: space.md }}>
        <Text style={{ color: theme.textMuted, fontSize: 11 }}>DTLAHappening — development build</Text>
        <Text style={{ color: theme.textMuted, fontSize: 11 }}>API: {API_BASE_URL}</Text>
      </View>
    </ScrollView>
  );
}

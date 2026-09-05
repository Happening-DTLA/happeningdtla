import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme, space } from "@/theme";
import { useLikes } from "@/likes-store";
import { TICKETING_ENABLED } from "@/features";
import { API_BASE_URL } from "@/api";
import { PROFILE_COPY, PROFILE_TYPES, useProfileType } from "@/profile-type";
import { radius, type } from "@/theme";

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
  const { liked } = useLikes();
  const { profileType, setProfileType } = useProfileType();
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

      {/* Onboarding will ask this once, on the way in. Until sign-in exists
          there is no account to hold the answer, so it is asked here and kept
          on the device — and it reveals a module rather than granting
          anything, so nothing depends on it being trustworthy. */}
      <View style={{ gap: space.sm }}>
        <Text style={[type.label, { color: theme.textMuted }]}>I'm here as</Text>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {PROFILE_TYPES.map((t) => {
            const on = profileType === t;
            return (
              <Pressable
                key={t}
                onPress={() => setProfileType(t)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{
                  flex: 1,
                  backgroundColor: on ? theme.accent : "transparent",
                  borderColor: on ? theme.accent : theme.border,
                  borderWidth: 1,
                  borderRadius: radius.pill,
                  paddingVertical: 9,
                  alignItems: "center",
                }}
              >
                <Text style={[type.label, { color: on ? theme.accentInk : theme.textMuted }]}>
                  {PROFILE_COPY[t].label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: theme.textMuted, fontSize: 12 }}>{PROFILE_COPY[profileType].blurb}</Text>
      </View>

      <View style={{ gap: space.md }}>
        {profileType === "ARTIST" ? (
          <Row
            icon="color-palette-outline"
            label="Submit your work"
            hint="Apply to exhibit in the gallery network"
            onPress={() => router.push("/submit/artist")}
          />
        ) : null}
        {profileType === "VENUE" ? (
          <Row
            icon="storefront-outline"
            label="Host a space"
            hint="Coming soon"
          />
        ) : null}
        {/* Top of the list on the night, because it is the only row here that
            changes while you are out. */}
        <Row
          icon="ribbon-outline"
          label="Passport"
          hint="Stamps you've collected"
          onPress={() => router.push("/passport")}
        />
        <Row
          icon="heart-outline"
          label="Saved events"
          hint={
            liked.length === 0
              ? "Tap the heart on any event"
              : `${liked.length} saved on this device`
          }
          onPress={() => router.push("/saved")}
        />
        {TICKETING_ENABLED ? (
          <Row icon="receipt-outline" label="Order history" hint="Coming soon" />
        ) : null}
        <Row icon="notifications-outline" label="Notifications" hint="Coming soon" />
        <Row
          icon="map-outline"
          label="Visitor guide"
          hint="Getting there, and what to expect"
          onPress={() => router.push("/visitor-guide")}
        />
        <Row icon="business-outline" label="For organizers" hint="Manage your venue's events" />
        {/* Staff-only. Reaching this screen grants nothing on its own — the
            device still has to be paired with a code from an organizer. */}
        {/* Meaningless at a free event with no doors to scan. */}
        {TICKETING_ENABLED ? (
          <Row
            icon="scan-outline"
            label="Door scanner"
            hint="Venue staff — needs a pairing code"
            onPress={() => router.push("/door/scan")}
          />
        ) : null}
      </View>

      <View style={{ gap: 4, paddingTop: space.md }}>
        <Text style={{ color: theme.textMuted, fontSize: 11 }}>DTLAHappening — development build</Text>
        <Text style={{ color: theme.textMuted, fontSize: 11 }}>API: {API_BASE_URL}</Text>
      </View>
    </ScrollView>
  );
}

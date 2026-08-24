import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, ApiRequestError } from "@/api";
import { saveDoor } from "@/door-store";
import { theme, space } from "@/theme";

/**
 * Pair this phone to a door.
 *
 * Deliberately not an account screen. Door staff are often working one night,
 * and a six-character code read across a loud room beats an email invite and a
 * password reset at 9pm.
 */
export default function PairScreen() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const pair = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.door.pair(code.trim(), Platform.OS === "ios" ? "iPhone" : "Android");
      await saveDoor({
        token: result.token,
        expiresAt: result.expiresAt,
        eventId: result.event.id,
        eventTitle: result.event.title,
        venueName: result.event.venueName,
      });
      router.replace("/door/scan");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't pair. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.bg }}
    >
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl }}>
        <View style={{ gap: space.sm, alignItems: "center", paddingTop: space.xl }}>
          <Ionicons name="scan-outline" size={40} color={theme.accent} />
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: "700" }}>Pair this phone</Text>
          <Text style={{ color: theme.textMuted, fontSize: 15, textAlign: "center", lineHeight: 22, maxWidth: 300 }}>
            Ask the organizer for tonight&apos;s door code. It only works once,
            and only for one event.
          </Text>
        </View>

        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="ABC123"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          returnKeyType="go"
          onSubmitEditing={() => code.length >= 4 && pair()}
          style={{
            backgroundColor: theme.surface,
            borderColor: error ? theme.danger : theme.border,
            borderWidth: 1,
            borderRadius: 12,
            paddingVertical: 18,
            color: theme.text,
            fontSize: 30,
            fontWeight: "700",
            letterSpacing: 8,
            textAlign: "center",
          }}
        />

        {error ? (
          <Text style={{ color: theme.danger, fontSize: 14, textAlign: "center" }}>{error}</Text>
        ) : null}

        <Pressable
          disabled={code.trim().length < 4 || busy}
          onPress={pair}
          accessibilityRole="button"
          style={({ pressed }) => ({
            backgroundColor: code.trim().length < 4 || busy ? theme.surface2 : pressed ? "#a8db55" : theme.accent,
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: "center",
          })}
        >
          <Text
            style={{
              color: code.trim().length < 4 || busy ? theme.textMuted : theme.accentInk,
              fontWeight: "700",
              fontSize: 16,
            }}
          >
            {busy ? "Pairing…" : "Pair"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

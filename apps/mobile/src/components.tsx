import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { theme, space } from "./theme";

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

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: theme.textMuted,
        fontSize: 11,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        fontVariant: ["tabular-nums"],
      }}
    >
      {children}
    </Text>
  );
}

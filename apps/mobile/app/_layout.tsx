import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { theme } from "@/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.accent,
          headerTitleStyle: { color: theme.text, fontSize: 16 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "DTLAHappening" }} />
        <Stack.Screen name="e/[slug]" options={{ title: "" }} />
      </Stack>
    </>
  );
}

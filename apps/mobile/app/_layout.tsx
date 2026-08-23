import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { theme } from "@/theme";

/**
 * Root stack. The tab bar lives inside `(tabs)`; event detail is pushed on top
 * of it so the tabs stay put on the way in and the back gesture works — the
 * same shape as Eventbrite and most store apps.
 */
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="e/[slug]" options={{ title: "", headerBackTitle: "Back" }} />
      </Stack>
    </>
  );
}

import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StripeProvider } from "@stripe/stripe-react-native";
import { api } from "@/api";
import { theme } from "@/theme";

export default function RootLayout() {
  const [publishableKey, setPublishableKey] = useState<string | null>(null);

  // Fetched rather than baked into a second .env, so there is one source of
  // truth for the key and no chance of test/live drifting between them.
  useEffect(() => {
    let alive = true;
    api
      .config()
      .then((c) => alive && setPublishableKey(c.stripePublishableKey))
      .catch(() => {
        // Browsing must still work when the API is unreachable; only paying
        // needs Stripe, and that surfaces its own error.
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <StripeProvider publishableKey={publishableKey ?? ""}>
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
        {/* Presented as a sheet so the event stays visible behind it — buying
            feels like a step, not a departure. */}
        <Stack.Screen
          name="buy/[slug]"
          options={{ title: "Checkout", presentation: "modal", headerBackTitle: "Back" }}
        />
      </Stack>
    </StripeProvider>
  );
}

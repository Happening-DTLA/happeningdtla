import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StripeProvider } from "@stripe/stripe-react-native";
import { ClerkProvider } from "@clerk/clerk-expo";
import { api } from "@/api";
import { tokenCache } from "@/clerk";
import { theme } from "@/theme";

export default function RootLayout() {
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [clerkKey, setClerkKey] = useState<string | null>(null);

  // Fetched rather than baked into a second .env, so there is one source of
  // truth for the key and no chance of test/live drifting between them.
  useEffect(() => {
    let alive = true;
    api
      .config()
      .then((c) => {
        if (!alive) return;
        setPublishableKey(c.stripePublishableKey);
        setClerkKey(c.clerkPublishableKey);
      })
      .catch(() => {
        // Browsing must still work when the API is unreachable; only paying
        // needs Stripe, and that surfaces its own error.
      });
    return () => {
      alive = false;
    };
  }, []);

  const app = (
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
        <Stack.Screen name="door/pair" options={{ title: "Door access" }} />
        {/* Full screen: a scanner competing with a nav bar wastes the only
            thing a door person is looking at. */}
        <Stack.Screen name="door/scan" options={{ headerShown: false }} />
        <Stack.Screen
          name="account/sign-in"
          options={{ title: "Sign in", presentation: "modal", headerBackTitle: "Back" }}
        />
      </Stack>
    </StripeProvider>
  );

  // Accounts are optional in this app — browsing and buying work signed out —
  // so the provider only wraps once a key has actually arrived. Mounting it
  // with an empty key throws.
  return clerkKey ? (
    <ClerkProvider publishableKey={clerkKey} tokenCache={tokenCache}>
      {app}
    </ClerkProvider>
  ) : (
    app
  );
}

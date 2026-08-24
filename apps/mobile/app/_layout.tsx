import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PaymentProvider } from "@/PaymentProvider";
import { LikesProvider } from "@/likes-store";
import { theme } from "@/theme";

export default function RootLayout() {
  return (
    <LikesProvider>
      <PaymentProvider>
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
          <Stack.Screen name="n/[slug]" options={{ title: "", headerBackTitle: "Back" }} />
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
          <Stack.Screen name="saved" options={{ title: "Saved events" }} />
        </Stack>
      </PaymentProvider>
    </LikesProvider>
  );
}

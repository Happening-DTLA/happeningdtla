import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
// Imported per weight, not from the package root. The root index requires
// every file in the family, so importing from it bundles all twenty faces —
// roughly 2.5MB of italics and hairline weights this app never sets.
import { Archivo_400Regular } from "@expo-google-fonts/archivo/400Regular";
import { Archivo_500Medium } from "@expo-google-fonts/archivo/500Medium";
import { Archivo_700Bold } from "@expo-google-fonts/archivo/700Bold";
import { ArchivoBlack_400Regular } from "@expo-google-fonts/archivo-black/400Regular";
import { PaymentProvider } from "@/PaymentProvider";
import { LikesProvider } from "@/likes-store";
import { ProfileTypeProvider } from "@/profile-type";
import { Welcome } from "@/Welcome";
import { theme } from "@/theme";

// Held until the faces are ready. Without this the first frame paints in the
// system font and then reflows into Archivo, which is the kind of flicker that
// makes an app feel assembled rather than built.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* already hidden, or unsupported here — not worth failing over */
});

export default function RootLayout() {
  // Once per launch, not per navigation — this component mounts with the app.
  const [welcomed, setWelcomed] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_700Bold,
    ArchivoBlack_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // A missing face does not throw — React Native just draws the system font,
    // and the whole visual direction silently disappears. Say so loudly in
    // development rather than wondering why it looks generic again.
    if (fontError && __DEV__) {
      console.warn("[fonts] failed to load; falling back to the system face", fontError);
    }
  }, [fontError]);

  // Nothing renders until the answer is known either way. On failure the app
  // still opens — an unreadable screen is worse than an unstyled one.
  if (!fontsLoaded && !fontError) return null;

  return (
    <LikesProvider>
        <ProfileTypeProvider>
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
          <Stack.Screen name="visitor-guide" options={{ title: "Visitor guide" }} />
        </Stack>
        {/* Above the navigator so the poster is the first thing drawn, and the
            app behind it is already mounted when it clears. */}
        {!welcomed ? <Welcome onDone={() => setWelcomed(true)} /> : null}
      </PaymentProvider>
    </ProfileTypeProvider>
      </LikesProvider>
  );
}

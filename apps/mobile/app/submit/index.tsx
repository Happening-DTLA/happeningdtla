import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme, space, radius, type } from "@/theme";

/**
 * Ways to take part — the app's version of dtlaartnight.com/submissions.
 *
 * A hub rather than four rows bolted onto Profile. Two of these are gated on
 * profile type and two are open to anyone, and mixing those in one settings
 * list makes Profile read as a pile. It also mirrors the page these forms come
 * from, so somebody who has used the website already knows where they are.
 */
const WAYS = [
  {
    href: "/submit/artist",
    icon: "color-palette-outline",
    title: "Submit your art",
    blurb: "Show work in the Emerging Artist Gallery. Artists keep 100% of sales.",
    cost: "Submission fee applies",
  },
  {
    href: "/submit/vendor",
    icon: "storefront-outline",
    title: "Sell at a market",
    blurb: "A booth at the Spring Arcade market or a holiday flea. Applying is free.",
    cost: "Booth fee if approved",
  },
  {
    href: "/submit/entertainment",
    icon: "musical-notes-outline",
    title: "Perform",
    blurb: "Musicians, DJs, live painters and performers of all kinds.",
    cost: null,
  },
  {
    href: "/submit/volunteer",
    icon: "hand-left-outline",
    title: "Volunteer",
    blurb: "Help run the night. Art Night is free because people show up for it.",
    cost: null,
  },
] as const;

export default function SubmitHubScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: "Get involved" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
      >
        <View style={{ gap: space.sm }}>
          <Text style={[type.label, { color: theme.accent }]}>Art Night</Text>
          <Text style={[type.poster, { color: theme.text }]}>Get involved</Text>
          <Text style={[type.body, { color: theme.textMuted }]}>
            Four ways to be part of the first Thursday.
          </Text>
        </View>

        <View style={{ gap: space.md }}>
          {WAYS.map((w) => (
            <Pressable
              key={w.href}
              accessibilityRole="button"
              onPress={() => router.push(w.href)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? theme.surface2 : theme.surface,
                borderColor: theme.border,
                borderWidth: 1,
                borderRadius: radius.block,
                padding: space.lg,
                flexDirection: "row",
                gap: space.md,
                alignItems: "flex-start",
              })}
            >
              <Ionicons name={w.icon} size={22} color={theme.accent} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[type.title, { color: theme.text }]}>{w.title}</Text>
                <Text style={[type.meta, { color: theme.textMuted }]}>{w.blurb}</Text>
                {w.cost ? (
                  <Text style={[type.label, { color: theme.accent }]}>{w.cost}</Text>
                ) : (
                  <Text style={[type.label, { color: theme.textMuted }]}>Free</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

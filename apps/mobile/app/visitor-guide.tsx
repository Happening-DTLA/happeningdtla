import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, space, radius, type } from "@/theme";
import { Label } from "@/components";

/**
 * How to get to ArtNight and what to expect.
 *
 * Transcribed from the organisers' printed map and dtlaartnight.com. It lives
 * in the app rather than the database because none of it changes month to
 * month — the Metro lines, the trolley and the 6pm start are properties of
 * ArtNight itself, not of any one night. If a night ever needs its own
 * version, this moves to the Night row and stops being a constant.
 */
const GETTING_THERE = [
  {
    icon: "train-outline" as const,
    title: "Metro",
    detail: "A, B and D lines to Pershing Square. Puts you two blocks from the 5th Street corridor.",
  },
  {
    icon: "bus-outline" as const,
    title: "Free trolley",
    detail: "The DTLA ArtNight trolley runs the route all evening. Free to hop on.",
  },
  {
    icon: "car-outline" as const,
    title: "Parking",
    detail: "Lots throughout Downtown. The organisers list recommended ones at dtlaartnight.com.",
  },
  {
    icon: "bicycle-outline" as const,
    title: "Bike share",
    detail: "Metro Bike Share docks across Downtown, including several on the corridors.",
  },
];

const KINDS = [
  { title: "Galleries", detail: "Open regular hours, and debut new work for ArtNight." },
  { title: "Pop-ups", detail: "Local businesses that turn their space into a gallery for the night." },
  { title: "Food, drink & vendors", detail: "Where to eat, drink and buy from local makers along the way." },
];

function Row({
  icon,
  title,
  detail,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: space.md,
        borderTopColor: theme.border,
        borderTopWidth: 1,
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
      }}
    >
      {icon ? (
        <View style={{ paddingTop: 2 }}>
          <Ionicons name={icon} size={18} color={theme.accent} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[type.heading, { color: theme.text }]}>{title}</Text>
        <Text style={[type.body, { color: theme.textMuted }]}>{detail}</Text>
      </View>
    </View>
  );
}

export default function VisitorGuideScreen() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingBottom: space.xxl * 2 }}
    >
      <View style={{ padding: space.lg, gap: space.sm }}>
        <Text style={[type.label, { color: theme.accent }]}>Visitor guide</Text>
        <Text style={[type.poster, { color: theme.text }]}>Doing the walk</Text>
        <Text style={[type.body, { color: theme.textMuted }]}>
          ArtNight runs the first Thursday of every month, 6pm until late. Galleries and
          businesses across Downtown open their doors — most of it free, all of it walkable.
        </Text>
      </View>

      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm, marginTop: space.md }}>
        <Label>Getting there</Label>
      </View>
      {GETTING_THERE.map((r) => (
        <Row key={r.title} {...r} />
      ))}

      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm, marginTop: space.xl }}>
        <Label>What the stops are</Label>
      </View>
      {KINDS.map((r) => (
        <Row key={r.title} {...r} />
      ))}

      <View style={{ padding: space.lg, marginTop: space.xl, gap: space.md }}>
        <Text style={[type.body, { color: theme.textMuted }]}>
          ArtNight is organised by Happening In DTLA. Venues change every month — this app
          follows the organisers' own map, so what you see here is what is open tonight.
        </Text>
        <Pressable
          onPress={() => Linking.openURL("https://dtlaartnight.com").catch(() => {})}
          accessibilityRole="link"
          style={({ pressed }) => ({
            backgroundColor: pressed ? theme.surface2 : "transparent",
            borderColor: theme.accent,
            borderWidth: 1,
            borderRadius: radius.control,
            paddingVertical: space.md,
            alignItems: "center",
          })}
        >
          <Text style={[type.label, { color: theme.accent }]}>dtlaartnight.com</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

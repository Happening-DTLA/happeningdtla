import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/theme";
import { TICKETING_ENABLED } from "@/features";

/**
 * Art Night first, then the ways of moving around inside it.
 *
 * The first tab is the night's directory rather than an Explore feed: on an
 * app about one night, a browse surface in front of the listing was a landing
 * page for a destination one tap away.
 *
 * Map sits directly after it — a primary way to decide where to go, not a
 * detail view of a search. Buried behind a toggle it would not be found, and
 * five is the point where a tab bar starts to crowd.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTitleStyle: { color: theme.text, fontSize: 17 },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: theme.bg },
        tabBarStyle: {
          backgroundColor: theme.bg,
          borderTopColor: theme.border,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Art Night",
          // No header: the screen opens on its own poster headline, and a nav
          // bar saying "Art Night" directly above type saying "DTLA ArtNight"
          // is a label for something already labelled.
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="moon-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "Tickets",
          // `href: null` keeps the route reachable by name while removing it
          // from the bar — so nothing breaks if something still links to it.
          href: TICKETING_ENABLED ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="ticket-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

import { ScrollView, Text, View } from "react-native";
import { EmptyState, EventCard, Loading } from "@/components";
import { useLikes } from "@/likes-store";
import { theme, space, type } from "@/theme";

/**
 * Saved events, newest first.
 *
 * Renders entirely from the local store, so it works with no signal — the same
 * reasoning as offline tickets. Prices and sold-out state come from the
 * snapshot taken when the event was saved and refresh whenever its page is
 * opened, so a card here can lag reality; the event page is always the truth.
 */
export default function SavedScreen() {
  const { liked, ready } = useLikes();

  // Waiting on a disk read, not a network one. Without this the screen paints
  // the empty state for a frame and then replaces it, which reads as a bug.
  if (!ready) return <Loading />;

  if (liked.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: space.xxl }}>
        <EmptyState
          title="Nothing saved yet"
          body="Tap the heart on any event to keep it here."
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingBottom: space.xxl }}
    >
      <Text
        style={[
          type.meta,
          { color: theme.textMuted, padding: space.lg, paddingBottom: space.md },
        ]}
      >
        Saved on this device. Signing in will carry them across devices.
      </Text>
      {liked.map((l) => (
        <EventCard key={l.event.id} event={l.event} showDate />
      ))}
    </ScrollView>
  );
}

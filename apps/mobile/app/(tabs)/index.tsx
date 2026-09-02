import { useCallback } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api";
import { useAsync } from "@/useAsync";
import { theme } from "@/theme";
import { EmptyState, ErrorState, Loading } from "@/components";
import { NightDirectory } from "@/NightDirectory";

/**
 * Art Night. The home of the app, and the whole of it.
 *
 * This used to be an Explore tab: a card for the night, a summary of its
 * corridors, and a tap to reach the directory. On an app about one night that
 * middle step had nothing to say — every route out of it led to the same
 * screen, so it read as a landing page in front of the product. The tab is now
 * the directory itself, which also means the app opens on the list of doors
 * rather than on an invitation to go and find it.
 */
export default function ArtNightScreen() {
  // The tab shows no header, so nothing has reserved the status bar for us.
  const insets = useSafeAreaInsets();
  const fetcher = useCallback((s: AbortSignal) => api.upcomingNight(s), []);
  const { status, data: night, error, retry } = useAsync(fetcher);

  if (status === "loading") return <Loading />;
  if (status === "error") {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingTop: insets.top }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={retry} tintColor={theme.textMuted} />
        }
      >
        <ErrorState message={error.message} onRetry={retry} />
      </ScrollView>
    );
  }

  if (night.events.length === 0) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingTop: insets.top }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={retry} tintColor={theme.textMuted} />
        }
      >
        <EmptyState
          title="No night scheduled"
          body="Art Night runs the first Thursday of every month. Check back soon."
        />
      </ScrollView>
    );
  }

  return <NightDirectory night={night} onRetry={retry} topInset={insets.top} />;
}

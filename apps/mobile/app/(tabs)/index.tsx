import { useCallback } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { api } from "@/api";
import { useAsync } from "@/useAsync";
import { theme, space, type } from "@/theme";
import { EmptyState, ErrorState, Loading, NightCard } from "@/components";
import { countVenues, groupByCorridor } from "@/corridors";

/**
 * Explore. One night, and the way into it.
 *
 * This app is ArtNight, so the screen is not a feed. The night is the product;
 * anything else on here — an "also on in Downtown" list, a category filter
 * over events that are all the same kind of thing — was scaffolding from when
 * this was a general events app, and it made the one thing that matters
 * compete with noise for attention.
 */
export default function ExploreScreen() {
  const fetcher = useCallback((s: AbortSignal) => api.upcomingNight(s), []);
  const { status, data: night, error, retry } = useAsync(fetcher);

  if (status === "loading") return <Loading />;
  if (status === "error") {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={retry} tintColor={theme.textMuted} />}
      >
        <ErrorState message={error.message} onRetry={retry} />
      </ScrollView>
    );
  }

  const groups = groupByCorridor(night.events);
  const stops = countVenues(night.events);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2, gap: space.lg }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={retry} tintColor={theme.textMuted} />}
    >
      {night.events.length === 0 ? (
        <EmptyState
          title="No night scheduled"
          body="ArtNight runs the first Thursday of every month. Check back soon."
        />
      ) : (
        <>
          <NightCard night={night} />

          {/* The corridors, as a summary rather than a control. Tapping the
              card above opens the directory where they become navigable. */}
          <View style={{ gap: space.sm }}>
            <Text style={[type.label, { color: theme.textMuted }]}>
              {stops} stops across {groups.length} corridors
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {groups.map((g) => (
                <View
                  key={g.corridor.slug}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 7,
                    borderColor: theme.border,
                    borderWidth: 1,
                    paddingVertical: 6,
                    paddingHorizontal: 11,
                  }}
                >
                  <View
                    style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: g.corridor.color }}
                  />
                  <Text style={[type.label, { color: theme.textMuted }]}>
                    {g.corridor.name.replace(" Corridor", "")}  {g.events.length}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

import { useCallback, useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { summarise, shortNightName, formatCalendarDate } from "@dtlahappening/core";
import { api } from "@/api";
import { useAsync } from "@/useAsync";
import { usePassport } from "@/passport-store";
import { groupByCorridor } from "@/corridors";
import { theme, space, radius, type, inkOn } from "@/theme";
import { ErrorState, Loading, Reveal } from "@/components";

/**
 * The card you fill in.
 *
 * A crawl passport, and the design follows from that literally: a grid of
 * squares that start empty and get stamped, in the colour of the street the
 * door was on. Nothing here is a progress bar — a progress bar is a chore with
 * a percentage on it, and this is meant to read like something you would keep.
 *
 * Corridor completion is the headline rather than the total. Nine stamps
 * scattered across Downtown is a pleasant evening; the whole of 4th Street is
 * the thing worth telling someone about, and it is the unit the printed map is
 * organised around.
 */

function Stamp({ filled, color, label }: { filled: boolean; color: string; label: string }) {
  return (
    <View
      accessibilityLabel={`${label}${filled ? ", stamped" : ", not yet"}`}
      style={{
        width: 44,
        height: 44,
        borderWidth: filled ? 0 : 1,
        borderColor: theme.border,
        backgroundColor: filled ? color : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {filled ? <Ionicons name="checkmark-sharp" size={22} color={inkOn(color)} /> : null}
    </View>
  );
}

export default function PassportScreen() {
  const router = useRouter();
  const fetcher = useCallback((s: AbortSignal) => api.upcomingNight(s), []);
  const { status, data: night, error, retry } = useAsync(fetcher);
  const { stampedFor, ready } = usePassport();

  const stamped = useMemo(
    () => (night ? stampedFor(night.id) : new Set<string>()),
    [night, stampedFor],
  );

  const groups = useMemo(() => (night ? groupByCorridor(night.events) : []), [night]);

  const progress = useMemo(
    () =>
      summarise(
        groups.map((g) => ({
          slug: g.corridor.slug,
          name: g.corridor.name,
          color: g.corridor.color,
          venueIds: [...new Set(g.events.map((e) => e.venue.id))],
        })),
        stamped,
      ),
    [groups, stamped],
  );

  if (status === "loading" || !ready) return <Loading />;
  if (status === "error") return <ErrorState message={error.message} onRetry={retry} />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingBottom: space.xxl * 2 }}
    >
      <View style={{ padding: space.lg, gap: space.sm }}>
        <Text style={[type.label, { color: theme.accent }]}>Passport</Text>
        <Text style={[type.poster, { color: theme.text }]}>{shortNightName(night.name)}</Text>
        <Text style={[type.meta, { color: theme.textMuted }]}>
          {formatCalendarDate(night.date)}
        </Text>
      </View>

      {/* The count, set as poster numerals rather than a bar. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: space.xl,
          paddingHorizontal: space.lg,
          paddingBottom: space.lg,
        }}
      >
        <View>
          <Text style={[type.numeral, { color: theme.text, fontSize: 40 }]}>
            {progress.stamped}
            <Text style={[type.numeral, { color: theme.textMuted, fontSize: 22 }]}>
              /{progress.total}
            </Text>
          </Text>
          <Text style={[type.label, { color: theme.textMuted }]}>Doors</Text>
        </View>
        <View>
          <Text style={[type.numeral, { color: theme.text, fontSize: 40 }]}>
            {progress.corridorsComplete}
            <Text style={[type.numeral, { color: theme.textMuted, fontSize: 22 }]}>
              /{progress.corridors.length}
            </Text>
          </Text>
          <Text style={[type.label, { color: theme.textMuted }]}>Corridors done</Text>
        </View>
      </View>

      {/* One corridor left to finish is a five-minute walk and a real reward.
          Pointing at an untouched street would just be a list of what's left. */}
      {progress.nearestToComplete ? (
        <View
          style={{
            marginHorizontal: space.lg,
            marginBottom: space.lg,
            borderLeftWidth: 3,
            borderLeftColor: progress.nearestToComplete.color,
            backgroundColor: theme.surface,
            padding: space.md,
          }}
        >
          <Text style={[type.heading, { color: theme.text }]}>
            {progress.nearestToComplete.total - progress.nearestToComplete.stamped} to go on{" "}
            {progress.nearestToComplete.name.replace(" Corridor", "")}
          </Text>
          <Text style={[type.meta, { color: theme.textMuted, marginTop: 2 }]}>
            Closest street to finishing.
          </Text>
        </View>
      ) : progress.stamped === 0 ? (
        <View style={{ marginHorizontal: space.lg, marginBottom: space.lg }}>
          <Text style={[type.body, { color: theme.textMuted }]}>
            Nothing stamped yet. Open a stop and tap the stamp when you get there — it works
            without signal, so a basement gallery is fine.
          </Text>
        </View>
      ) : null}

      {groups.map((g, gi) => {
        const row = progress.corridors.find((c) => c.slug === g.corridor.slug);
        const venues = [...new Map(g.events.map((e) => [e.venue.id, e.venue])).values()];
        return (
          <Reveal key={g.corridor.slug} index={gi}>
            <View style={{ marginBottom: space.lg }}>
              <View
                style={{
                  backgroundColor: g.corridor.color,
                  marginHorizontal: space.lg,
                  paddingVertical: space.sm,
                  paddingHorizontal: space.md,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={[type.heading, { color: inkOn(g.corridor.color), flex: 1 }]}>
                  {g.corridor.name}
                </Text>
                <Text style={[type.label, { color: inkOn(g.corridor.color) }]}>
                  {row?.complete ? "Complete" : `${row?.stamped ?? 0}/${row?.total ?? 0}`}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: space.sm,
                  paddingHorizontal: space.lg,
                  paddingTop: space.md,
                }}
              >
                {venues.map((v) => (
                  <Pressable key={v.id} onPress={() => router.push(`/e/${g.events.find((e) => e.venue.id === v.id)!.slug}`)}>
                    <Stamp filled={stamped.has(v.id)} color={g.corridor.color} label={v.name} />
                  </Pressable>
                ))}
              </View>
            </View>
          </Reveal>
        );
      })}

      <Pressable
        onPress={() => router.push("/(tabs)/map")}
        accessibilityRole="button"
        style={({ pressed }) => ({
          marginHorizontal: space.lg,
          marginTop: space.sm,
          backgroundColor: pressed ? "#a8db55" : theme.accent,
          borderRadius: radius.control,
          paddingVertical: 14,
          alignItems: "center",
        })}
      >
        <Text style={[type.label, { color: theme.accentInk }]}>Find the nearest stop</Text>
      </Pressable>
    </ScrollView>
  );
}

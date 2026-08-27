import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { EventCategory } from "@dtlahappening/core";
import { EVENT_CATEGORIES } from "@dtlahappening/core";
import { api } from "@/api";
import { useAsync } from "@/useAsync";
import { theme, space, type } from "@/theme";
import { CategoryChips, EmptyState, ErrorState, EventCard, Loading } from "@/components";

export default function SearchScreen() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<EventCategory | null>(null);
  const [freeOnly, setFreeOnly] = useState(false);

  // Debounce so a four-letter word isn't four round trips. 250ms is below the
  // threshold where typing starts to feel like it's waiting on the network.
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 250);
    return () => clearTimeout(t);
  }, [input]);

  const fetcher = useCallback(
    (s: AbortSignal) =>
      api.search(
        {
          q: query || undefined,
          category: category ?? undefined,
          freeOnly: freeOnly || undefined,
        },
        s,
      ),
    [query, category, freeOnly],
  );
  const { status, data, error, retry } = useAsync(fetcher, [query, category, freeOnly]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ padding: space.lg, paddingBottom: space.sm, gap: space.md }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: space.md,
          }}
        >
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Events, venues, neighborhoods"
            placeholderTextColor={theme.textMuted}
            autoCorrect={false}
            returnKeyType="search"
            style={{ flex: 1, color: theme.text, fontSize: 16, paddingVertical: 12 }}
          />
          {input.length > 0 ? (
            <Pressable onPress={() => setInput("")} accessibilityLabel="Clear search" hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={() => setFreeOnly((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: freeOnly }}
          style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
        >
          <Ionicons
            name={freeOnly ? "checkbox" : "square-outline"}
            size={20}
            color={freeOnly ? theme.accent : theme.textMuted}
          />
          <Text style={{ color: freeOnly ? theme.text : theme.textMuted, fontSize: 14 }}>
            Free events only
          </Text>
        </Pressable>
      </View>

      <View style={{ paddingBottom: space.sm }}>
        <CategoryChips categories={EVENT_CATEGORIES} selected={category} onSelect={setCategory} />
      </View>

      {status === "loading" ? (
        <Loading />
      ) : status === "error" ? (
        <ErrorState message={error.message} onRetry={retry} />
      ) : data.events.length === 0 ? (
        <EmptyState
          title="No events match"
          body="Try a different word, or clear the category and price filters."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingTop: space.sm, paddingBottom: space.xxl * 2 }}
          keyboardDismissMode="on-drag"
        >
          <Text
            style={[type.label, { color: theme.textMuted, paddingHorizontal: space.lg, paddingBottom: space.sm }]}
          >
            {data.total} {data.total === 1 ? "event" : "events"}
          </Text>
          {data.events.map((e, i) => (
            <EventCard key={e.id} event={e} showDate index={i} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

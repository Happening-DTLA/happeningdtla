import { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { api } from "@/api";
import { useAsync } from "@/useAsync";
import { ErrorState, Loading } from "@/components";
import { NightDirectory } from "@/NightDirectory";

/**
 * A specific night, by slug.
 *
 * Where a shared link lands, and where a past or future night can be read.
 * The current night has its own tab, so this renders the same directory
 * without duplicating it.
 */
export default function NightScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const fetcher = useCallback((s: AbortSignal) => api.night(slug, s), [slug]);
  const { status, data: night, error, retry } = useAsync(fetcher, [slug]);

  if (status === "loading") return <Loading />;
  if (status === "error") return <ErrorState message={error.message} onRetry={retry} />;
  return <NightDirectory night={night} onRetry={retry} />;
}

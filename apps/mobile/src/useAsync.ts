import { useCallback, useEffect, useState } from "react";

type State<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: T; error: null }
  | { status: "error"; data: null; error: Error };

/**
 * Minimal data-fetching hook. Deliberately not React Query yet — one dependency
 * fewer to reason about until we actually need caching and background refetch.
 * Aborts in flight requests on unmount so a fast back-navigation doesn't set
 * state on a gone component.
 */
export function useAsync<T>(fn: (signal: AbortSignal) => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<State<T>>({ status: "loading", data: null, error: null });
  const [nonce, setNonce] = useState(0);

  const retry = useCallback(() => {
    setState({ status: "loading", data: null, error: null });
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fn(controller.signal)
      .then((data) => active && setState({ status: "ready", data, error: null }))
      .catch((error: Error) => {
        if (!active || controller.signal.aborted) return;
        setState({ status: "error", data: null, error });
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { ...state, retry };
}

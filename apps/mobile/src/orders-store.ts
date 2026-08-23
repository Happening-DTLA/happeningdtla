import * as SecureStore from "expo-secure-store";

/**
 * Which orders this device owns.
 *
 * Guest checkout means there is no account to hang purchase history on, so the
 * device remembers what it bought. Each entry pairs an order id with its
 * access token — the token is the only thing that authorises reading the
 * ticket codes back, so it belongs in SecureStore (Keychain) rather than
 * AsyncStorage.
 *
 * When accounts arrive, these get claimed onto the signed-in user; until then
 * losing the device means losing the wallet, which is why the confirmation
 * email matters.
 */
const KEY = "dtlahappening.orders.v1";

export interface StoredOrder {
  orderId: string;
  accessToken: string;
  savedAt: string;
}

export async function loadOrders(): Promise<StoredOrder[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredOrder[]) : [];
  } catch {
    // A corrupt store should not brick the wallet — start over rather than throw.
    return [];
  }
}

export async function saveOrder(order: { orderId: string; accessToken: string }): Promise<void> {
  const existing = await loadOrders();
  if (existing.some((o) => o.orderId === order.orderId)) return;
  const next: StoredOrder[] = [
    { ...order, savedAt: new Date().toISOString() },
    ...existing,
  ].slice(0, 100);
  await SecureStore.setItemAsync(KEY, JSON.stringify(next));
}

export async function forgetOrder(orderId: string): Promise<void> {
  const next = (await loadOrders()).filter((o) => o.orderId !== orderId);
  await SecureStore.setItemAsync(KEY, JSON.stringify(next));
}

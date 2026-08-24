import * as SecureStore from "expo-secure-store";
import type { TokenCache } from "@clerk/clerk-expo";

/**
 * Where Clerk keeps the session token on this device.
 *
 * The Keychain, not AsyncStorage — it is a live session credential, and a
 * stolen phone should not hand over an account along with the hardware.
 *
 * Failures are swallowed rather than thrown: a device that can't reach the
 * Keychain should degrade to "signed out", not crash the app on launch.
 */
export const tokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      /* non-fatal */
    }
  },
  async clearToken(key: string) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      /* non-fatal */
    }
  },
};

/**
 * Fetched from the API rather than duplicated into a second .env, the same way
 * the Stripe publishable key is — one source of truth, no chance of a test key
 * in one place and a live one in the other.
 */
export async function fetchClerkKey(baseUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}/api/config`);
    if (!res.ok) return null;
    const body = (await res.json()) as { clerkPublishableKey?: string | null };
    return body.clerkPublishableKey ?? null;
  } catch {
    return null;
  }
}

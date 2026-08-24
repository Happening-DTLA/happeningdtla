import * as SecureStore from "expo-secure-store";

/**
 * This device's door credential.
 *
 * The token authorises marking tickets as used, so it belongs in the Keychain,
 * not AsyncStorage. Scoped to one event and expiring after the night, but a
 * stolen phone mid-shift is still a real scenario — hence secure storage and a
 * visible way to unpair.
 */
const KEY = "dtlahappening.door.v1";

export interface DoorCredential {
  token: string;
  expiresAt: string;
  eventId: string;
  eventTitle: string;
  venueName: string;
}

export async function loadDoor(): Promise<DoorCredential | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const cred = JSON.parse(raw) as DoorCredential;
    // Expired is the same as absent — don't let staff discover it at a door.
    if (new Date(cred.expiresAt) < new Date()) {
      await SecureStore.deleteItemAsync(KEY);
      return null;
    }
    return cred;
  } catch {
    return null;
  }
}

export const saveDoor = (cred: DoorCredential) =>
  SecureStore.setItemAsync(KEY, JSON.stringify(cred));

export const clearDoor = () => SecureStore.deleteItemAsync(KEY);

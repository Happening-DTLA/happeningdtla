import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { normalizeScannedCode } from "@dtlahappening/core";

/**
 * Everything needed to run a door with no network.
 *
 * Three pieces of state:
 *   manifest  — hashes of every valid ticket, downloaded before doors
 *   admitted  — hashes this device has let in, so it can catch its own repeats
 *   queue     — scans waiting to reach the server
 *
 * Stored in AsyncStorage rather than SecureStore because a manifest for a
 * thousand tickets is far past SecureStore's per-item limit, and hashes are
 * not secret — that is the whole point of shipping hashes instead of codes.
 */
const MANIFEST_KEY = "dtlahappening.door.manifest.v1";
const ADMITTED_KEY = "dtlahappening.door.admitted.v1";
const QUEUE_KEY = "dtlahappening.door.queue.v1";

export interface DoorManifest {
  eventId: string;
  generatedAt: string;
  valid: string[];
  alreadyCheckedIn: string[];
}

export interface QueuedScan {
  code: string;
  scannedAt: string;
}

export const hashCode = (code: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalizeScannedCode(code));

// ---- manifest ---------------------------------------------------------------

export async function saveManifest(m: DoorManifest) {
  await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(m));
  // Seed the local admitted set with whatever other doors already scanned, so
  // a device joining late doesn't wave through people who are already inside.
  await AsyncStorage.setItem(ADMITTED_KEY, JSON.stringify(m.alreadyCheckedIn));
}

export async function loadManifest(): Promise<DoorManifest | null> {
  const raw = await AsyncStorage.getItem(MANIFEST_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DoorManifest;
  } catch {
    return null;
  }
}

// ---- local admissions -------------------------------------------------------

async function loadAdmitted(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(ADMITTED_KEY);
  try {
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

async function markAdmitted(hash: string) {
  const set = await loadAdmitted();
  set.add(hash);
  await AsyncStorage.setItem(ADMITTED_KEY, JSON.stringify([...set]));
}

// ---- queue ------------------------------------------------------------------

export async function loadQueue(): Promise<QueuedScan[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  try {
    return raw ? (JSON.parse(raw) as QueuedScan[]) : [];
  } catch {
    return [];
  }
}

export async function enqueue(scan: QueuedScan) {
  const q = await loadQueue();
  q.push(scan);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export async function dequeue(count: number) {
  const q = await loadQueue();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(count)));
}

export async function clearOfflineState() {
  await AsyncStorage.multiRemove([MANIFEST_KEY, ADMITTED_KEY, QUEUE_KEY]);
}

// ---- the offline decision ---------------------------------------------------

export type OfflineVerdict = "ADMITTED" | "DUPLICATE" | "INVALID_CODE" | "NO_MANIFEST";

/**
 * Decides admission with no server.
 *
 * Honest about its limits: it can catch a repeat THIS device has seen, and a
 * repeat any door had seen when the manifest was downloaded. It cannot see a
 * scan another device made in the last five minutes. That gap is unavoidable
 * without a network and is why the sync step reports conflicts afterwards.
 */
export async function decideOffline(rawCode: string): Promise<OfflineVerdict> {
  const manifest = await loadManifest();
  if (!manifest) return "NO_MANIFEST";

  const hash = await hashCode(rawCode);
  if (!manifest.valid.includes(hash)) return "INVALID_CODE";

  const admitted = await loadAdmitted();
  if (admitted.has(hash)) return "DUPLICATE";

  await markAdmitted(hash);
  return "ADMITTED";
}

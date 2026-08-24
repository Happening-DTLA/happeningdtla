import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ApiScanResponse } from "@dtlahappening/core";
import { TICKET_CODE_LENGTH, formatTicketCode, normalizeScannedCode } from "@dtlahappening/core";
import { api, ApiRequestError } from "@/api";
import { clearDoor, loadDoor, type DoorCredential } from "@/door-store";
import {
  clearOfflineState,
  decideOffline,
  enqueue,
  dequeue,
  loadManifest,
  loadQueue,
  saveManifest,
} from "@/door-offline";
import { theme, space } from "@/theme";
import { Loading } from "@/components";

/** Colour is the whole message. A door person reads this at arm's length,
 *  in the dark, while someone talks at them. */
const VERDICT: Record<string, { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap; title: string }> = {
  ADMITTED: { bg: "#16a34a", fg: "#ffffff", icon: "checkmark-circle", title: "LET THEM IN" },
  DUPLICATE: { bg: "#d97706", fg: "#ffffff", icon: "alert-circle", title: "ALREADY USED" },
  INVALID_CODE: { bg: "#dc2626", fg: "#ffffff", icon: "close-circle", title: "NOT VALID" },
  WRONG_EVENT: { bg: "#dc2626", fg: "#ffffff", icon: "close-circle", title: "WRONG EVENT" },
  REFUNDED_TICKET: { bg: "#dc2626", fg: "#ffffff", icon: "close-circle", title: "REFUNDED" },
  NOT_YET_VALID: { bg: "#d97706", fg: "#ffffff", icon: "time", title: "NOT YET VALID" },
  ERROR: { bg: "#525252", fg: "#ffffff", icon: "cloud-offline", title: "TRY AGAIN" },
  NO_MANIFEST: { bg: "#525252", fg: "#ffffff", icon: "cloud-offline", title: "NO OFFLINE DATA" },
};

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [door, setDoor] = useState<DoorCredential | null | undefined>(undefined);
  const [verdict, setVerdict] = useState<(ApiScanResponse & { key: number }) | null>(null);
  const [manual, setManual] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [stats, setStats] = useState<{ sold: number; admitted: number } | null>(null);
  const [queued, setQueued] = useState(0);
  const [manifestAt, setManifestAt] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const busy = useRef(false);
  const router = useRouter();

  useEffect(() => {
    loadDoor().then(setDoor);
  }, []);

  const refreshStats = useCallback(
    async (token: string) => {
      try {
        const s = await api.door.stats(token);
        setStats(s.stats);
      } catch {
        // Counts are a nicety; never block the door on them.
      }
    },
    [],
  );

  useEffect(() => {
    if (door) refreshStats(door.token);
  }, [door, refreshStats]);

  const refreshQueueCount = useCallback(async () => {
    setQueued((await loadQueue()).length);
  }, []);

  useEffect(() => {
    loadManifest().then((m) => setManifestAt(m?.generatedAt ?? null));
    refreshQueueCount();
  }, [refreshQueueCount]);

  const downloadManifest = useCallback(async () => {
    if (!door) return;
    try {
      const m = await api.door.manifest(door.token);
      await saveManifest(m);
      setManifestAt(m.generatedAt);
      Alert.alert("Ready for offline", `${m.valid.length} tickets cached on this phone.`);
    } catch (err) {
      Alert.alert("Couldn't download", err instanceof ApiRequestError ? err.message : "Try again.");
    }
  }, [door]);

  /** Pushes queued scans whenever the network comes back. */
  const syncQueue = useCallback(async () => {
    if (!door) return;
    const q = await loadQueue();
    if (q.length === 0) return;
    try {
      const { results } = await api.door.sync(door.token, q);
      await dequeue(q.length);
      await refreshQueueCount();
      setOfflineMode(false);

      // Another door may have admitted the same person while we were offline.
      // Surface it rather than hiding it — staff can decide what to do.
      const conflicts = results.filter((r) => r.result === "DUPLICATE");
      if (conflicts.length > 0) {
        Alert.alert(
          "Synced with conflicts",
          `${conflicts.length} of ${results.length} were already scanned elsewhere while this phone was offline.`,
        );
      }
    } catch {
      // Still offline. The queue survives; try again on the next tick.
    }
  }, [door, refreshQueueCount]);

  useEffect(() => {
    if (!door) return;
    const t = setInterval(syncQueue, 15_000);
    return () => clearInterval(t);
  }, [door, syncQueue]);

  const submit = useCallback(
    async (raw: string) => {
      // A camera fires continuously; one scan at a time or the same ticket
      // gets posted a dozen times before the first reply lands.
      if (busy.current || !door) return;
      busy.current = true;
      try {
        const result = await api.door.scan(door.token, raw);
        setVerdict({ ...result, key: Date.now() });
        refreshStats(door.token);
      } catch (err) {
        // An expired or revoked device is a real answer, not a network problem.
        if (err instanceof ApiRequestError && err.code === "door_session_invalid") {
          await clearDoor();
          router.replace("/door/pair");
          return;
        }

        // Couldn't reach the server. Decide locally rather than stalling a
        // queue of people, and queue the scan to reconcile later.
        setOfflineMode(true);
        const verdictOffline = await decideOffline(raw);
        if (verdictOffline !== "NO_MANIFEST") {
          await enqueue({ code: raw, scannedAt: new Date().toISOString() });
          await refreshQueueCount();
        }
        setVerdict({
          result: verdictOffline === "NO_MANIFEST" ? "INVALID_CODE" : verdictOffline,
          message:
            verdictOffline === "NO_MANIFEST"
              ? "No signal and no offline data. Tap Prepare offline while you have service."
              : verdictOffline === "ADMITTED"
                ? "Offline — will sync"
                : verdictOffline === "DUPLICATE"
                  ? "Already scanned on this phone"
                  : "Not a valid ticket",
          key: Date.now(),
        });
      } finally {
        // Long enough to read the verdict, short enough not to hold a queue.
        setTimeout(() => {
          busy.current = false;
        }, 1200);
      }
    },
    [door, refreshStats, router],
  );

  // Reformat as they type so what's on screen matches what's printed under
  // the QR, dash for dash. Comparing two differently-shaped strings by eye is
  // how a character goes missing.
  const setManualFormatted = (text: string) => {
    const clean = normalizeScannedCode(text).slice(0, TICKET_CODE_LENGTH);
    setManual(formatTicketCode(clean));
  };
  const manualLength = normalizeScannedCode(manual).length;
  const manualComplete = manualLength === TICKET_CODE_LENGTH;
  const runManual = () => {
    if (manualLength === 0) return;
    submit(manual);
    setManual("");
  };

  if (door === undefined) return <Loading />;
  if (door === null) {
    router.replace("/door/pair");
    return <Loading />;
  }

  if (!permission?.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: "center", padding: space.xl, gap: space.lg }}>
        <Ionicons name="camera-outline" size={40} color={theme.textMuted} style={{ alignSelf: "center" }} />
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: "700", textAlign: "center" }}>
          Camera access needed
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 15, textAlign: "center", lineHeight: 22 }}>
          The scanner reads ticket QR codes. You can also type codes by hand if
          you&apos;d rather not allow the camera.
        </Text>
        <Pressable
          onPress={requestPermission}
          style={{ backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 15, alignItems: "center" }}
        >
          <Text style={{ color: theme.accentInk, fontWeight: "700", fontSize: 16 }}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={() => setShowManual(true)} style={{ alignItems: "center", paddingVertical: space.md }}>
          <Text style={{ color: theme.accent, fontSize: 15 }}>Type codes instead</Text>
        </Pressable>
      </View>
    );
  }

  const v = verdict ? (VERDICT[verdict.result] ?? VERDICT.ERROR) : null;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }: { data: string }) => submit(data)}
      />

      <View style={{ position: "absolute", top: 0, left: 0, right: 0, padding: space.lg, paddingTop: space.xxl, backgroundColor: "rgba(0,0,0,0.6)" }}>
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }} numberOfLines={1}>
          {door.eventTitle}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
          {door.venueName}
          {stats ? ` · ${stats.admitted} of ${stats.sold} in` : ""}
        </Text>
        {offlineMode || queued > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            <Ionicons name="cloud-offline" size={14} color="#fbbf24" />
            <Text style={{ color: "#fbbf24", fontSize: 13, fontWeight: "600" }}>
              {queued > 0 ? `Offline · ${queued} waiting to sync` : "Offline"}
            </Text>
          </View>
        ) : null}
      </View>

      {v && verdict ? (
        <View
          key={verdict.key}
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: v.bg,
            alignItems: "center",
            justifyContent: "center",
            gap: space.md,
            padding: space.xl,
          }}
        >
          <Ionicons name={v.icon} size={96} color={v.fg} />
          <Text style={{ color: v.fg, fontSize: 34, fontWeight: "900", textAlign: "center", letterSpacing: 1 }}>
            {v.title}
          </Text>
          <Text style={{ color: v.fg, fontSize: 17, textAlign: "center", opacity: 0.95 }}>
            {verdict.message}
          </Text>
          {verdict.ticket ? (
            <Text style={{ color: v.fg, fontSize: 15, opacity: 0.9 }}>
              {verdict.ticket.tierName}
              {verdict.ticket.holderName ? ` · ${verdict.ticket.holderName}` : ""}
            </Text>
          ) : null}
          {verdict.firstScannedAt ? (
            <Text style={{ color: v.fg, fontSize: 15, opacity: 0.9 }}>
              First scanned {new Date(verdict.firstScannedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </Text>
          ) : null}
          <Pressable
            onPress={() => setVerdict(null)}
            style={{ marginTop: space.lg, borderColor: v.fg, borderWidth: 2, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 32 }}
          >
            <Text style={{ color: v.fg, fontWeight: "700", fontSize: 16 }}>Next</Text>
          </Pressable>
        </View>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}
      >
      <View style={{ padding: space.lg, paddingBottom: space.xxl, backgroundColor: "rgba(0,0,0,0.85)", gap: space.md }}>
        {showManual ? (
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <TextInput
                value={manual}
                onChangeText={setManualFormatted}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                placeholderTextColor="rgba(255,255,255,0.4)"
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                keyboardAppearance="dark"
                returnKeyType="go"
                onSubmitEditing={runManual}
                style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, paddingHorizontal: space.md, paddingVertical: 14, color: "#fff", fontSize: 18, letterSpacing: 1.5 }}
              />
              <Pressable
                onPress={runManual}
                disabled={manualLength === 0}
                style={{ backgroundColor: manualComplete ? theme.accent : "rgba(255,255,255,0.15)", borderRadius: 10, paddingHorizontal: 20, justifyContent: "center" }}
              >
                <Text style={{ color: manualComplete ? theme.accentInk : "rgba(255,255,255,0.6)", fontWeight: "700" }}>Check</Text>
              </Pressable>
            </View>
            {/* Says exactly how far off you are. A disabled button with no
                explanation is useless in a dark doorway — a dropped character
                looks identical to a broken app. */}
            <Text style={{ color: manualComplete ? theme.accent : "rgba(255,255,255,0.55)", fontSize: 13 }}>
              {manualLength === 0
                ? `${TICKET_CODE_LENGTH} characters — dashes optional`
                : manualComplete
                  ? "Ready"
                  : `${manualLength} of ${TICKET_CODE_LENGTH} characters`}
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {/* Typing a code is the fallback for a cracked or dim screen, which
              happens more often than anyone expects at a door. */}
          <Pressable onPress={() => setShowManual((s) => !s)} hitSlop={10}>
            <Text style={{ color: theme.accent, fontSize: 15 }}>
              {showManual ? "Hide keypad" : "Enter code by hand"}
            </Text>
          </Pressable>
          {/* Do this before doors, while there's still signal. */}
          <Pressable onPress={downloadManifest} hitSlop={10}>
            <Text style={{ color: manifestAt ? "rgba(255,255,255,0.6)" : "#fbbf24", fontSize: 15 }}>
              {manifestAt ? "Refresh offline" : "Prepare offline"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              Alert.alert("Unpair this phone?", "You'll need a new code to scan again.", [
                { text: "Cancel", style: "cancel" },
                { text: "Unpair", style: "destructive", onPress: async () => { await clearDoor(); await clearOfflineState(); router.replace("/door/pair"); } },
              ])
            }
            hitSlop={10}
          >
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 15 }}>Unpair</Text>
          </Pressable>
        </View>
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ApiScanResponse } from "@dtlahappening/core";
import { formatTicketCode, looksLikeTicketCode } from "@dtlahappening/core";
import { api, ApiRequestError } from "@/api";
import { clearDoor, loadDoor, type DoorCredential } from "@/door-store";
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
};

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [door, setDoor] = useState<DoorCredential | null | undefined>(undefined);
  const [verdict, setVerdict] = useState<(ApiScanResponse & { key: number }) | null>(null);
  const [manual, setManual] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [stats, setStats] = useState<{ sold: number; admitted: number } | null>(null);
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
        const message = err instanceof ApiRequestError ? err.message : "Couldn't reach the server.";
        setVerdict({ result: "INVALID_CODE", message, key: Date.now() });
        if (err instanceof ApiRequestError && err.code === "door_session_invalid") {
          await clearDoor();
          router.replace("/door/pair");
        }
      } finally {
        // Long enough to read the verdict, short enough not to hold a queue.
        setTimeout(() => {
          busy.current = false;
        }, 1200);
      }
    },
    [door, refreshStats, router],
  );

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

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: space.lg, paddingBottom: space.xxl, backgroundColor: "rgba(0,0,0,0.6)", gap: space.md }}>
        {showManual ? (
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <TextInput
              value={manual}
              onChangeText={(t) => setManual(t.toUpperCase())}
              placeholder="Type the code"
              placeholderTextColor="rgba(255,255,255,0.5)"
              autoCapitalize="characters"
              autoCorrect={false}
              style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, paddingHorizontal: space.md, paddingVertical: 12, color: "#fff", fontSize: 16, letterSpacing: 1 }}
            />
            <Pressable
              onPress={() => { submit(manual); setManual(""); }}
              disabled={!looksLikeTicketCode(manual)}
              style={{ backgroundColor: looksLikeTicketCode(manual) ? theme.accent : "rgba(255,255,255,0.15)", borderRadius: 10, paddingHorizontal: 20, justifyContent: "center" }}
            >
              <Text style={{ color: looksLikeTicketCode(manual) ? theme.accentInk : "rgba(255,255,255,0.5)", fontWeight: "700" }}>Check</Text>
            </Pressable>
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
          <Pressable
            onPress={() =>
              Alert.alert("Unpair this phone?", "You'll need a new code to scan again.", [
                { text: "Cancel", style: "cancel" },
                { text: "Unpair", style: "destructive", onPress: async () => { await clearDoor(); router.replace("/door/pair"); } },
              ])
            }
            hitSlop={10}
          >
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 15 }}>Unpair</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, Text, TextInput, View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  ART_MEDIA, CUSTOM_QUOTE_LIMITS, MAX_ARTWORKS, MAX_PORTFOLIO_IMAGES, needsCustomQuote,
} from "@dtlahappening/core";
import { API_BASE_URL } from "@/api";
import { pickImages, uploadImage } from "@/uploads";
import { theme, space, radius, type } from "@/theme";

/**
 * The artist application.
 *
 * The organisers' own form, rebuilt for a phone. Their questions in their
 * order, so an artist who has filled one in recognises the other — with the
 * artwork list as real fields rather than a folder of files named
 * "Lastname_Title_Size_Price.jpg", which their page admits delays review.
 *
 * Long forms are abandoned, so the work is front-loaded: pieces first, while
 * enthusiasm is high, and the address at the end when someone is already
 * committed. Images upload as they are chosen rather than all at once on
 * submit — a two-minute wait at the end with no feedback is where people close
 * the app, and an upload that fails should fail next to the picture it failed
 * on.
 */

function Field({
  label, value, onChange, placeholder, keyboardType, hint, autoCapitalize, multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad" | "numeric";
  hint?: string;
  autoCapitalize?: "none" | "words" | "sentences";
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[type.label, { color: theme.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.border}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
        multiline={multiline}
        style={{
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: radius.control,
          paddingHorizontal: space.md,
          paddingVertical: 11,
          color: theme.text,
          fontSize: 15,
          minHeight: multiline ? 76 : undefined,
        }}
      />
      {hint ? <Text style={[type.meta, { color: theme.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

type Artwork = {
  key: string;
  title: string;
  medium: string;
  heightIn: string;
  widthIn: string;
  depthIn: string;
  weightLb: string;
  price: string;
  imageUrl: string | null;
  uploading: boolean;
};

const blankArtwork = (): Artwork => ({
  key: `${Date.now()}-${Math.random()}`,
  title: "", medium: "", heightIn: "", widthIn: "", depthIn: "", weightLb: "",
  price: "", imageUrl: null, uploading: false,
});

const num = (s: string): number | null => {
  const n = Number.parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function ArtistSubmissionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("CA");
  const [zip, setZip] = useState("");
  const [socials, setSocials] = useState("");
  const [website, setWebsite] = useState("");
  const [media, setMedia] = useState<string[]>([]);
  const [portfolio, setPortfolio] = useState<string[]>([]);
  const [portfolioBusy, setPortfolioBusy] = useState(false);
  const [artworks, setArtworks] = useState<Artwork[]>([blankArtwork()]);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const patch = useCallback((key: string, changes: Partial<Artwork>) => {
    setArtworks((prev) => prev.map((a) => (a.key === key ? { ...a, ...changes } : a)));
  }, []);

  const addPortfolio = useCallback(async () => {
    try {
      const picked = await pickImages(MAX_PORTFOLIO_IMAGES - portfolio.length);
      if (!picked.length) return;
      setPortfolioBusy(true);
      const urls = await Promise.all(picked.map((p) => uploadImage(p, "portfolio")));
      setPortfolio((prev) => [...prev, ...urls].slice(0, MAX_PORTFOLIO_IMAGES));
    } catch (e) {
      Alert.alert("Could not attach", e instanceof Error ? e.message : "Try again.");
    } finally {
      setPortfolioBusy(false);
    }
  }, [portfolio.length]);

  const addArtworkImage = useCallback(async (key: string) => {
    try {
      const [picked] = await pickImages(1);
      if (!picked) return;
      patch(key, { uploading: true });
      const url = await uploadImage(picked, "artwork");
      patch(key, { imageUrl: url, uploading: false });
    } catch (e) {
      patch(key, { uploading: false });
      Alert.alert("Could not attach", e instanceof Error ? e.message : "Try again.");
    }
  }, [patch]);

  const ready = useMemo(() => {
    const filled = [firstName, lastName, email, phone, address1, city, stateCode, zip, socials, website];
    return (
      filled.every((v) => v.trim().length > 0) &&
      media.length > 0 &&
      consent &&
      artworks.length > 0 &&
      artworks.every((a) => a.title.trim() && a.imageUrl && a.price.trim())
    );
  }, [firstName, lastName, email, phone, address1, city, stateCode, zip, socials, website, media, consent, artworks]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/artist`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName, lastName, email, phone,
          address1, address2: address2 || null, city, state: stateCode, zip,
          socials, website, media,
          portfolioImages: portfolio,
          artworks: artworks.map((a) => ({
            title: a.title.trim(),
            medium: a.medium.trim() || null,
            heightIn: num(a.heightIn), widthIn: num(a.widthIn),
            depthIn: num(a.depthIn), weightLb: num(a.weightLb),
            // Entered in dollars, stored in cents, like everything else here.
            priceCents: Math.round((Number.parseFloat(a.price.replace(/[^0-9.]/g, "")) || 0) * 100),
            imageUrl: a.imageUrl!,
          })),
          consent,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Submission failed.");

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        "Submitted",
        "The curatorial team will review your work and email you. If it isn't selected you can resubmit new work within five days at no extra charge.",
        [{ text: "Done", onPress: () => router.back() }],
      );
    } catch (e) {
      Alert.alert("Could not submit", e instanceof Error ? e.message : "Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [firstName, lastName, email, phone, address1, address2, city, stateCode, zip, socials, website, media, portfolio, artworks, consent, router]);

  const oversized = artworks.filter((a) =>
    needsCustomQuote({ heightIn: num(a.heightIn), widthIn: num(a.widthIn), weightLb: num(a.weightLb) }),
  ).length;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + 120, gap: space.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: space.sm }}>
          <Text style={[type.label, { color: theme.accent }]}>Gallery network</Text>
          <Text style={[type.poster, { color: theme.text }]}>Submit your work</Text>
          <Text style={[type.body, { color: theme.textMuted }]}>
            For placement across the Historic Core galleries. Submit only the pieces you want to
            exhibit — the placement proposal is based on every piece submitted. Artists keep 100% of
            sales.
          </Text>
        </View>

        {/* Pieces first: this is the part an artist came to do, and asking for
            a postal address before anything interesting is how a form gets
            abandoned on the second field. */}
        <View style={{ gap: space.md }}>
          <Text style={[type.title, { color: theme.text }]}>The work</Text>
          {artworks.map((a, i) => (
            <View
              key={a.key}
              style={{
                borderColor: theme.border, borderWidth: 1,
                padding: space.md, gap: space.md, backgroundColor: theme.surface,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={[type.label, { color: theme.textMuted }]}>Piece {i + 1}</Text>
                {artworks.length > 1 ? (
                  <Pressable
                    onPress={() => setArtworks((p) => p.filter((x) => x.key !== a.key))}
                    accessibilityLabel={`Remove piece ${i + 1}`}
                    hitSlop={10}
                  >
                    <Ionicons name="close" size={18} color={theme.textMuted} />
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                onPress={() => addArtworkImage(a.key)}
                accessibilityRole="button"
                accessibilityLabel={a.imageUrl ? "Replace this photo" : "Add a photo of this piece"}
                style={{
                  height: 168, borderColor: theme.border, borderWidth: 1,
                  alignItems: "center", justifyContent: "center", backgroundColor: theme.bg,
                }}
              >
                {a.uploading ? (
                  <ActivityIndicator color={theme.accent} />
                ) : a.imageUrl ? (
                  <Image source={a.imageUrl} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : (
                  <View style={{ alignItems: "center", gap: 6 }}>
                    <Ionicons name="image-outline" size={22} color={theme.textMuted} />
                    <Text style={[type.label, { color: theme.textMuted }]}>Add a photo</Text>
                  </View>
                )}
              </Pressable>

              <Field label="Title" value={a.title} onChange={(v) => patch(a.key, { title: v })} />
              <Field label="Medium" value={a.medium} onChange={(v) => patch(a.key, { medium: v })} placeholder="Oil on canvas" />

              <View style={{ flexDirection: "row", gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Field label="Height in" value={a.heightIn} onChange={(v) => patch(a.key, { heightIn: v })} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Width in" value={a.widthIn} onChange={(v) => patch(a.key, { widthIn: v })} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Depth in" value={a.depthIn} onChange={(v) => patch(a.key, { depthIn: v })} keyboardType="numeric" />
                </View>
              </View>
              <Text style={[type.meta, { color: theme.textMuted, marginTop: -6 }]}>
                Including the frame — that's what has to fit the wall.
              </Text>

              <View style={{ flexDirection: "row", gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Field label="Weight lb" value={a.weightLb} onChange={(v) => patch(a.key, { weightLb: v })} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Price USD" value={a.price} onChange={(v) => patch(a.key, { price: v })} keyboardType="numeric" hint="0 for not for sale" />
                </View>
              </View>

              {/* Said here, not in a follow-up email a week later. */}
              {needsCustomQuote({ heightIn: num(a.heightIn), widthIn: num(a.widthIn), weightLb: num(a.weightLb) }) ? (
                <Text style={[type.meta, { color: theme.accent }]}>
                  Over {CUSTOM_QUOTE_LIMITS.heightIn}in tall, {CUSTOM_QUOTE_LIMITS.widthIn}in wide or{" "}
                  {CUSTOM_QUOTE_LIMITS.weightLb}lb — installation is quoted separately for this piece.
                </Text>
              ) : null}
            </View>
          ))}

          {artworks.length < MAX_ARTWORKS ? (
            <Pressable
              onPress={() => setArtworks((p) => [...p, blankArtwork()])}
              accessibilityRole="button"
              style={{
                borderColor: theme.border, borderWidth: 1, borderStyle: "dashed",
                paddingVertical: space.md, alignItems: "center",
              }}
            >
              <Text style={[type.label, { color: theme.text }]}>Add another piece</Text>
            </Pressable>
          ) : null}

          {oversized > 0 ? (
            <Text style={[type.meta, { color: theme.textMuted }]}>
              {oversized} of {artworks.length} will be quoted for installation separately.
            </Text>
          ) : null}
        </View>

        <View style={{ gap: space.md }}>
          <Text style={[type.title, { color: theme.text }]}>Your practice</Text>
          <Text style={[type.meta, { color: theme.textMuted, marginTop: -8 }]}>
            Portfolio images are for review context — your body of work, not the pieces above.
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {portfolio.map((url) => (
              <Image key={url} source={url} style={{ width: 76, height: 76, backgroundColor: theme.surface }} contentFit="cover" />
            ))}
            {portfolio.length < MAX_PORTFOLIO_IMAGES ? (
              <Pressable
                onPress={addPortfolio}
                accessibilityRole="button"
                accessibilityLabel="Add portfolio images"
                style={{
                  width: 76, height: 76, borderColor: theme.border, borderWidth: 1,
                  alignItems: "center", justifyContent: "center",
                }}
              >
                {portfolioBusy ? <ActivityIndicator color={theme.accent} /> : <Ionicons name="add" size={22} color={theme.textMuted} />}
              </Pressable>
            ) : null}
          </View>

          <Text style={[type.label, { color: theme.textMuted }]}>What you make</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {ART_MEDIA.map((m) => {
              const on = media.includes(m);
              return (
                <Pressable
                  key={m}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setMedia((prev) => (on ? prev.filter((x) => x !== m) : [...prev, m]));
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{
                    backgroundColor: on ? theme.accent : "transparent",
                    borderColor: on ? theme.accent : theme.border,
                    borderWidth: 1, borderRadius: radius.pill,
                    paddingVertical: 7, paddingHorizontal: 14,
                  }}
                >
                  <Text style={[type.label, { color: on ? theme.accentInk : theme.textMuted }]}>{m}</Text>
                </Pressable>
              );
            })}
          </View>

          <Field label="Social media" value={socials} onChange={setSocials} autoCapitalize="none" hint="Write NA if you don't have any." />
          <Field label="Website" value={website} onChange={setWebsite} autoCapitalize="none" hint="Write NA if you don't have one." />
        </View>

        <View style={{ gap: space.md }}>
          <Text style={[type.title, { color: theme.text }]}>How to reach you</Text>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ flex: 1 }}><Field label="First name" value={firstName} onChange={setFirstName} autoCapitalize="words" /></View>
            <View style={{ flex: 1 }}><Field label="Last name" value={lastName} onChange={setLastName} autoCapitalize="words" /></View>
          </View>
          <Field label="Email" value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <Field label="Phone" value={phone} onChange={setPhone} keyboardType="phone-pad" />
          <Field label="Address" value={address1} onChange={setAddress1} />
          <Field label="Address line 2" value={address2} onChange={setAddress2} placeholder="Optional" />
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ flex: 2 }}><Field label="City" value={city} onChange={setCity} /></View>
            <View style={{ flex: 1 }}><Field label="State" value={stateCode} onChange={setStateCode} autoCapitalize="none" /></View>
            <View style={{ flex: 1 }}><Field label="Zip" value={zip} onChange={setZip} keyboardType="numeric" /></View>
          </View>
        </View>

        <Pressable
          onPress={() => { Haptics.selectionAsync().catch(() => {}); setConsent((c) => !c); }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}
        >
          <View
            style={{
              width: 22, height: 22, borderWidth: 1,
              borderColor: consent ? theme.accent : theme.border,
              backgroundColor: consent ? theme.accent : "transparent",
              alignItems: "center", justifyContent: "center", marginTop: 1,
            }}
          >
            {consent ? <Ionicons name="checkmark" size={15} color={theme.accentInk} /> : null}
          </View>
          <Text style={[type.meta, { color: theme.textMuted, flex: 1 }]}>
            I agree to receive updates, event details and notifications by email and SMS. You can
            unsubscribe at any time.
          </Text>
        </Pressable>

        <Pressable
          onPress={submit}
          disabled={!ready || submitting}
          accessibilityRole="button"
          style={{
            backgroundColor: ready && !submitting ? theme.accent : theme.surface2,
            borderRadius: radius.control, paddingVertical: 15, alignItems: "center",
          }}
        >
          {submitting ? (
            <ActivityIndicator color={theme.accentInk} />
          ) : (
            <Text style={[type.label, { color: ready ? theme.accentInk : theme.textMuted }]}>
              Submit {artworks.length} {artworks.length === 1 ? "piece" : "pieces"}
            </Text>
          )}
        </Pressable>

        {/* What is missing, rather than a dead button and no explanation. */}
        {!ready ? (
          <Text style={[type.meta, { color: theme.textMuted, textAlign: "center", marginTop: -space.md }]}>
            {artworks.some((a) => !a.imageUrl)
              ? "Every piece needs a photo."
              : artworks.some((a) => !a.title.trim() || !a.price.trim())
                ? "Every piece needs a title and a price."
                : media.length === 0
                  ? "Pick at least one medium."
                  : !consent
                    ? "Tick the consent box to submit."
                    : "Fill in the contact fields."}
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

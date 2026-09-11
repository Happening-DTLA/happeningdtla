import { useCallback, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import {
  ENTERTAINER_FEE_PREFERENCES,
  type EntertainerFeePreference,
} from "@dtlahappening/core";
import { API_BASE_URL } from "@/api";
import { pickImages, uploadImage } from "@/uploads";
import { theme, space, radius, type } from "@/theme";
import { Choice, Consent, Field, Section, SubmitButton } from "@/form";

/**
 * Entertainment submission.
 *
 * Their form asks the fee question up front rather than in a follow-up, which
 * is the right way round: the organisers need to know whether an act costs
 * money before they shortlist it, and an act that would happily play for free
 * should not be filtered out by an awkward silence.
 */
export default function EntertainmentSubmitScreen() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [actName, setActName] = useState("");
  const [performanceType, setPerformanceType] = useState("");
  const [links, setLinks] = useState("");
  const [fee, setFee] = useState<EntertainerFeePreference | null>(null);
  const [feeNote, setFeeNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const attach = useCallback(async () => {
    setUploading(true);
    try {
      const [picked] = await pickImages(1);
      if (!picked) return;
      setPhoto(await uploadImage(picked, "portfolio"));
    } catch (e) {
      Alert.alert("Could not attach", e instanceof Error ? e.message : "Try again.");
    } finally {
      setUploading(false);
    }
  }, []);

  const ready =
    firstName.trim() &&
    lastName.trim() &&
    email.includes("@") &&
    phone.trim().length >= 7 &&
    actName.trim() &&
    links.trim() &&
    fee &&
    photo &&
    consent;

  const submit = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/entertainment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          actName: actName.trim(),
          performanceType: performanceType.trim() || null,
          links: links.trim(),
          promoImageUrl: photo,
          feePreference: fee,
          // Only sent when it means something; the server drops it anyway.
          feeNote: fee === "OTHER" ? feeNote.trim() || null : null,
          consent,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Submission failed.");

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("Submitted", "The team will listen and get back to you by email.", [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert("Could not submit", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }, [firstName, lastName, email, phone, actName, performanceType, links, photo, fee, feeNote, consent, router]);

  return (
    <>
      <Stack.Screen options={{ title: "Perform at Art Night" }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.bg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: space.xxl * 2 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: space.sm }}>
            <Text style={[type.label, { color: theme.accent }]}>Entertainment</Text>
            <Text style={[type.poster, { color: theme.text }]}>Perform at Art Night</Text>
            <Text style={[type.body, { color: theme.textMuted }]}>
              Musicians, DJs, live painters and performers of all kinds. Play to a Downtown crowd
              on the first Thursday of the month.
            </Text>
          </View>

          <Section title="You">
            <Field label="First name" value={firstName} onChange={setFirstName} autoCapitalize="words" />
            <Field label="Last name" value={lastName} onChange={setLastName} autoCapitalize="words" />
            <Field label="Email" value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Phone" value={phone} onChange={setPhone} keyboardType="phone-pad" />
          </Section>

          <Section title="Your act">
            <Field label="Band or artist name" value={actName} onChange={setActName} placeholder="Nightshift" />
            <Field
              label="What do you perform?"
              value={performanceType}
              onChange={setPerformanceType}
              placeholder="House and disco DJ set"
              hint="Optional."
            />
            <Field
              label="Instagram, YouTube or other"
              value={links}
              onChange={setLinks}
              autoCapitalize="none"
              placeholder="@nightshiftdj"
              hint="A handle is fine — it doesn't have to be a link."
            />
          </Section>

          <Section title="Promotional photo">
            <Text style={[type.meta, { color: theme.textMuted }]}>
              Used in event marketing if you're booked.
            </Text>
            {photo ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                <Image
                  source={{ uri: photo }}
                  style={{ width: 76, height: 76, borderRadius: radius.block }}
                />
                <Pressable onPress={attach} accessibilityRole="button">
                  <Text style={[type.meta, { color: theme.accent }]}>Choose a different photo</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={attach}
                disabled={uploading}
                accessibilityRole="button"
                style={{
                  borderColor: theme.border,
                  borderWidth: 1,
                  borderRadius: radius.block,
                  paddingVertical: space.xl,
                  alignItems: "center",
                  gap: space.sm,
                  opacity: uploading ? 0.5 : 1,
                }}
              >
                <Ionicons name="image-outline" size={22} color={theme.textMuted} />
                <Text style={[type.meta, { color: theme.textMuted }]}>
                  {uploading ? "Uploading…" : "Add a photo"}
                </Text>
              </Pressable>
            )}
          </Section>

          <Section title="Fee">
            <Choice
              label="What works for you?"
              options={ENTERTAINER_FEE_PREFERENCES}
              value={fee}
              onChange={setFee}
            />
            {fee === "OTHER" ? (
              <Field
                label="Tell them more"
                value={feeNote}
                onChange={setFeeNote}
                multiline
                placeholder="Happy to trade for a booth, or split the door…"
              />
            ) : null}
          </Section>

          <Consent checked={consent} onToggle={() => setConsent((c) => !c)}>
            <Text style={[type.meta, { color: theme.text }]}>
              I agree to be contacted by email about this submission.
            </Text>
          </Consent>

          <SubmitButton label="Submit" onPress={submit} disabled={!ready} busy={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

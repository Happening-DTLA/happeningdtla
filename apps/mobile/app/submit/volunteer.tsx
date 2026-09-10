import { useCallback, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  VOLUNTEER_ID_NOTE,
  VOLUNTEER_MIN_AGE,
  VOLUNTEER_ROLES,
  type VolunteerRole,
} from "@dtlahappening/core";
import { API_BASE_URL } from "@/api";
import { theme, space, type } from "@/theme";
import { Checks, Consent, Field, Section, SubmitButton } from "@/form";

/**
 * Volunteer sign-up.
 *
 * Their web form requires a photo of a California/US ID to check age. This
 * asks you to confirm you are 18 instead — see VOLUNTEER_ID_NOTE. Identity
 * documents need private storage, signed reads and a privacy policy that says
 * so, and the bucket these uploads go to is public. Age is checked in person
 * on the night, which is when it actually matters.
 */
export default function VolunteerSubmitScreen() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bestTime, setBestTime] = useState("");
  const [roles, setRoles] = useState<VolunteerRole[]>([]);
  const [isAdult, setIsAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const ready =
    firstName.trim() &&
    lastName.trim() &&
    email.includes("@") &&
    phone.trim().length >= 7 &&
    bestTime.trim() &&
    roles.length > 0 &&
    isAdult &&
    consent;

  const submit = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/volunteer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          bestTimeToReach: bestTime.trim(),
          roles,
          isAdult,
          consent,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Sign-up failed.");

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        "Thanks",
        "The team will be in touch about roles and times. Bring photo ID on the night.",
        [{ text: "Done", onPress: () => router.back() }],
      );
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert("Could not sign up", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }, [firstName, lastName, email, phone, bestTime, roles, isAdult, consent, router]);

  return (
    <>
      <Stack.Screen options={{ title: "Volunteer" }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.bg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: space.xxl * 2 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: space.sm }}>
            <Text style={[type.label, { color: theme.accent }]}>Volunteer sign-up</Text>
            <Text style={[type.poster, { color: theme.text }]}>Join the team</Text>
            <Text style={[type.body, { color: theme.textMuted }]}>
              Art Night is free, and it stays free because people help run it. Volunteers get a
              hands-on evening with the arts community Downtown.
            </Text>
          </View>

          <Section title="You">
            <Field label="First name" value={firstName} onChange={setFirstName} autoCapitalize="words" />
            <Field label="Last name" value={lastName} onChange={setLastName} autoCapitalize="words" />
            <Field label="Email" value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Phone" value={phone} onChange={setPhone} keyboardType="phone-pad" />
            <Field
              label="Best time to reach you"
              value={bestTime}
              onChange={setBestTime}
              placeholder="After 4pm on weekdays"
            />
          </Section>

          <Section title="Where you'd like to help">
            <Checks
              label="Pick any"
              options={VOLUNTEER_ROLES}
              values={roles}
              onToggle={(r) =>
                setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))
              }
            />
          </Section>

          <Section title="One last thing">
            <Consent checked={isAdult} onToggle={() => setIsAdult((v) => !v)}>
              <Text style={[type.meta, { color: theme.text }]}>
                I'm {VOLUNTEER_MIN_AGE} or over.
              </Text>
              <Text style={[type.meta, { color: theme.textMuted }]}>{VOLUNTEER_ID_NOTE}</Text>
            </Consent>
            <Consent checked={consent} onToggle={() => setConsent((c) => !c)}>
              <Text style={[type.meta, { color: theme.text }]}>
                I agree to be contacted by email about volunteering.
              </Text>
            </Consent>
          </Section>

          <SubmitButton label="Sign up" onPress={submit} disabled={!ready} busy={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

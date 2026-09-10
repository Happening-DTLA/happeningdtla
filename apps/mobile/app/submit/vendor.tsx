import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  formatCents,
  vendorMarketBlockedReason,
  VENDOR_ACKNOWLEDGEMENTS,
  VENDOR_CATEGORIES,
  VENDOR_PRODUCTS_NOT_WANTED,
  VENDOR_PRODUCTS_WANTED,
  VENDOR_REVIEW_DAYS,
  type ApiVendorMarket,
  type VendorCategory,
} from "@dtlahappening/core";
import { API_BASE_URL } from "@/api";
import { theme, space, type } from "@/theme";
import { Acknowledgements, Checks, Choice, Consent, Field, Section, SubmitButton } from "@/form";

/**
 * Vendor application.
 *
 * Their form, in their order, with one difference that is deliberate: the
 * markets come with prices attached and the price shown is the one on
 * dtlaartnight.com, not a figure this app computed. A booth must not cost more
 * because somebody applied on a phone.
 *
 * No money changes hands here. Applying is free; an approval is what creates a
 * bill, and it arrives by email with 72 hours to pay it.
 */
export default function VendorSubmitScreen() {
  const router = useRouter();

  const [markets, setMarkets] = useState<ApiVendorMarket[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [socials, setSocials] = useState("");
  const [website, setWebsite] = useState("");
  const [category, setCategory] = useState<VendorCategory | null>(null);
  const [merchandise, setMerchandise] = useState("");
  const [presentation, setPresentation] = useState("");
  const [standout, setStandout] = useState("");
  const [marketIds, setMarketIds] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [sms, setSms] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`${API_BASE_URL}/api/vendor-markets`)
      .then((r) => r.json())
      .then((rows) => live && setMarkets(rows as ApiVendorMarket[]))
      .catch(() => live && setLoadError("Couldn't load the markets. Check your connection."));
    return () => {
      live = false;
    };
  }, []);

  /**
   * Food is a gate, not just a category. Selecting it can invalidate markets
   * already picked, so those are dropped rather than left silently attached to
   * a request the server will refuse.
   */
  const pickCategory = useCallback(
    (next: VendorCategory) => {
      setCategory(next);
      setMarketIds((ids) =>
        ids.filter((id) => {
          const m = markets?.find((x) => x.id === id);
          return m ? !vendorMarketBlockedReason(m, next) : false;
        }),
      );
    },
    [markets],
  );

  const blockedReason = useCallback(
    (id: string) => {
      const m = markets?.find((x) => x.id === id);
      if (!m) return null;
      if (!category) return "Pick a category first";
      return vendorMarketBlockedReason(m, category);
    },
    [markets, category],
  );

  const marketOptions = useMemo(
    () =>
      (markets ?? []).map((m) => ({
        value: m.id,
        label: `${m.name} — ${formatCents(m.totalCents)}`,
        sublabel: [
          new Date(`${m.date}T00:00:00.000Z`).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            // A calendar date. In Pacific the first Thursday renders as a
            // Wednesday — see src/lib/datetime.ts.
            timeZone: "UTC",
          }),
          m.venueName,
          m.hours,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    [markets],
  );

  const ready =
    businessName.trim() &&
    firstName.trim() &&
    lastName.trim() &&
    email.includes("@") &&
    phone.trim().length >= 7 &&
    socials.trim() &&
    website.trim() &&
    category &&
    merchandise.trim().length >= 10 &&
    presentation.trim().length >= 10 &&
    standout.trim().length >= 10 &&
    marketIds.length > 0 &&
    consent;

  const submit = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/vendor`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          socials: socials.trim(),
          website: website.trim(),
          category,
          merchandise: merchandise.trim(),
          presentation: presentation.trim(),
          standout: standout.trim(),
          photos: [],
          marketIds,
          emailConsent: consent,
          smsConsent: sms,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Submission failed.");

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        "Application sent",
        `The team reviews applications in ${VENDOR_REVIEW_DAYS}. If you're approved they'll email you with how to pay — your space is held once that payment arrives.`,
        [{ text: "Done", onPress: () => router.back() }],
      );
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert("Could not submit", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }, [
    businessName, firstName, lastName, email, phone, socials, website, category,
    merchandise, presentation, standout, marketIds, consent, sms, router,
  ]);

  return (
    <>
      <Stack.Screen options={{ title: "Vendor application" }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.bg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: space.xxl * 2 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: space.sm }}>
            <Text style={[type.label, { color: theme.accent }]}>Vendor markets</Text>
            <Text style={[type.poster, { color: theme.text }]}>Sell at Art Night</Text>
            <Text style={[type.body, { color: theme.textMuted }]}>
              Unique brands that show the quality and creativity of the LA community. Applying is
              free — if you're approved you'll be told how to pay.
            </Text>
          </View>

          <View style={{ gap: space.sm }}>
            <Text style={[type.meta, { color: theme.text }]}>
              <Text style={{ color: theme.accent }}>Looking for: </Text>
              {VENDOR_PRODUCTS_WANTED}
            </Text>
            <Text style={[type.meta, { color: theme.textMuted }]}>
              <Text style={{ color: theme.danger }}>Not accepted: </Text>
              {VENDOR_PRODUCTS_NOT_WANTED}
            </Text>
          </View>

          <Section title="Your business">
            <Field label="Business name" value={businessName} onChange={setBusinessName} placeholder="Ada Ceramics" />
            <Field label="First name" value={firstName} onChange={setFirstName} autoCapitalize="words" />
            <Field label="Last name" value={lastName} onChange={setLastName} autoCapitalize="words" />
            <Field label="Email" value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Phone" value={phone} onChange={setPhone} keyboardType="phone-pad" />
            <Field
              label="Social media"
              value={socials}
              onChange={setSocials}
              autoCapitalize="none"
              placeholder="@yourshop"
              hint="Type NA if you don't have any."
            />
            <Field
              label="Website"
              value={website}
              onChange={setWebsite}
              autoCapitalize="none"
              placeholder="yourshop.com"
              hint="Type NA if you don't have one."
            />
          </Section>

          <Section title="What you sell">
            <Choice
              label="Category"
              options={VENDOR_CATEGORIES}
              value={category}
              onChange={pickCategory}
            />
            <Field
              label="Describe your merchandise"
              value={merchandise}
              onChange={setMerchandise}
              multiline
              placeholder="Hand-thrown stoneware, made in my studio…"
            />
            <Field
              label="How you present it"
              value={presentation}
              onChange={setPresentation}
              multiline
              placeholder="A six-foot table with risers and warm lighting…"
            />
            <Field
              label="What makes you stand out"
              value={standout}
              onChange={setStandout}
              multiline
              placeholder="Everything is one-off; I never repeat a glaze…"
            />
          </Section>

          <Section title="Which markets">
            {loadError ? (
              <Text style={[type.body, { color: theme.danger }]}>{loadError}</Text>
            ) : markets === null ? (
              <ActivityIndicator color={theme.accent} />
            ) : markets.length === 0 ? (
              <Text style={[type.body, { color: theme.textMuted }]}>
                No markets are open for applications right now.
              </Text>
            ) : (
              <Checks
                label="Pick any"
                options={marketOptions}
                values={marketIds}
                disabledReason={blockedReason}
                onToggle={(id) =>
                  setMarketIds((ids) =>
                    ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
                  )
                }
              />
            )}
          </Section>

          <Section title="Before you submit">
            <Acknowledgements items={VENDOR_ACKNOWLEDGEMENTS} />
            <Consent checked={consent} onToggle={() => setConsent((c) => !c)}>
              <Text style={[type.meta, { color: theme.text }]}>
                I agree to these guidelines and to receive emails about my application.
              </Text>
            </Consent>
            <Consent checked={sms} onToggle={() => setSms((s) => !s)}>
              <Text style={[type.meta, { color: theme.textMuted }]}>
                Optional — text me about upcoming markets. Up to 10 messages a month, message and
                data rates may apply, reply STOP to cancel. Not required to apply.
              </Text>
            </Consent>
          </Section>

          <SubmitButton
            label="Submit application"
            onPress={submit}
            disabled={!ready}
            busy={busy}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

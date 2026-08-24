import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSignIn, useSignUp } from "@clerk/clerk-expo";
import { theme, space } from "@/theme";

/**
 * Email + one-time code, deliberately.
 *
 * No password to invent, forget, or reset, and no OAuth redirect to survive —
 * which matters because this runs in Expo Go today and a native build later.
 *
 * Sign-in and sign-up are one screen: someone typing their email does not know
 * or care whether they already have an account, and making them pick the wrong
 * tab first is a pointless way to lose them.
 */
export default function SignInScreen() {
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = signInLoaded && signUpLoaded;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const sendCode = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      // Try signing in first; if there's no such account, fall through to
      // creating one. The person never has to know which happened.
      try {
        const attempt = await signIn!.create({ identifier: email.trim() });
        const factor = attempt.supportedFirstFactors?.find((f) => f.strategy === "email_code");
        if (!factor) throw new Error("no_email_code");
        await signIn!.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: (factor as { emailAddressId: string }).emailAddressId,
        });
        setMode("in");
      } catch {
        await signUp!.create({ emailAddress: email.trim() });
        await signUp!.prepareEmailAddressVerification({ strategy: "email_code" });
        setMode("up");
      }
      setStage("code");
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "in") {
        const result = await signIn!.attemptFirstFactor({ strategy: "email_code", code: code.trim() });
        if (result.status === "complete") {
          await setSignInActive!({ session: result.createdSessionId });
          router.back();
          return;
        }
      } else {
        const result = await signUp!.attemptEmailAddressVerification({ code: code.trim() });
        if (result.status === "complete") {
          await setSignUpActive!({ session: result.createdSessionId });
          router.back();
          return;
        }
      }
      setError("That code didn't work. Check it and try again.");
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.bg }}
    >
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View style={{ gap: space.sm }}>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: "700" }}>
            {stage === "email" ? "Sign in" : "Check your email"}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 15, lineHeight: 22 }}>
            {stage === "email"
              ? "We'll email you a code. No password needed — and you don't need an account to buy tickets."
              : `We sent a code to ${email.trim()}.`}
          </Text>
        </View>

        {stage === "email" ? (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={theme.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoFocus
              onSubmitEditing={() => emailValid && sendCode()}
              style={inputStyle}
            />
            <Pressable
              onPress={sendCode}
              disabled={!emailValid || busy || !ready}
              style={({ pressed }) => buttonStyle(!emailValid || busy || !ready, pressed)}
            >
              <Text style={buttonTextStyle(!emailValid || busy || !ready)}>
                {busy ? "Sending…" : "Email me a code"}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoFocus
              maxLength={8}
              onSubmitEditing={verify}
              style={{ ...inputStyle, fontSize: 26, letterSpacing: 8, textAlign: "center" }}
            />
            <Pressable
              onPress={verify}
              disabled={code.trim().length < 4 || busy}
              style={({ pressed }) => buttonStyle(code.trim().length < 4 || busy, pressed)}
            >
              <Text style={buttonTextStyle(code.trim().length < 4 || busy)}>
                {busy ? "Checking…" : "Continue"}
              </Text>
            </Pressable>
            <Pressable onPress={() => { setStage("email"); setCode(""); setError(null); }}>
              <Text style={{ color: theme.accent, textAlign: "center", fontSize: 15 }}>
                Use a different email
              </Text>
            </Pressable>
          </>
        )}

        {error ? <Text style={{ color: theme.danger, fontSize: 14 }}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  backgroundColor: theme.surface,
  borderColor: theme.border,
  borderWidth: 1,
  borderRadius: 10,
  paddingHorizontal: space.md,
  paddingVertical: 14,
  color: theme.text,
  fontSize: 17,
} as const;

const buttonStyle = (disabled: boolean, pressed: boolean) => ({
  backgroundColor: disabled ? theme.surface2 : pressed ? "#a8db55" : theme.accent,
  borderRadius: 12,
  paddingVertical: 15,
  alignItems: "center" as const,
});

const buttonTextStyle = (disabled: boolean) => ({
  color: disabled ? theme.textMuted : theme.accentInk,
  fontWeight: "700" as const,
  fontSize: 16,
});

/** Clerk's raw errors are for developers; these are for people. */
function readableError(err: unknown): string {
  const message = (err as { errors?: { message?: string; longMessage?: string }[] })?.errors?.[0];
  return message?.longMessage ?? message?.message ?? "Something went wrong. Try again.";
}

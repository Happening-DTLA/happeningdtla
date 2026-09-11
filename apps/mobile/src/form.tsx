import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { theme, space, radius, type } from "@/theme";

/**
 * Form parts, shared by the four submission screens.
 *
 * Extracted rather than copied because there are now four of these forms and a
 * fifth is likely. The alternative — a `Field` living inside whichever screen
 * was written first — is how a design system drifts: the fourth copy gets a
 * slightly different border and nobody notices until the screens sit side by
 * side in a review.
 *
 * Everything here obeys the tokens. Inputs and buttons are `radius.control`,
 * blocks are square, and the only round things are chips, which is the one
 * deliberate exception the theme documents.
 */

export function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  hint,
  autoCapitalize,
  multiline,
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

/** A section heading, so a long form reads as parts rather than a wall. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.md }}>
      <Text style={[type.label, { color: theme.accent }]}>{title}</Text>
      {children}
    </View>
  );
}

/**
 * Pick one. Chips, because the options are short and a native picker hides the
 * choices behind a tap — on a form this long, seeing all three fee options at
 * once is the difference between answering and abandoning.
 */
export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[type.label, { color: theme.textMuted }]}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {options.map((o) => {
          const on = value === o.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onChange(o.value);
              }}
              style={{
                backgroundColor: on ? theme.accent : "transparent",
                borderColor: on ? theme.accent : theme.border,
                borderWidth: 1,
                borderRadius: radius.pill,
                paddingVertical: 8,
                paddingHorizontal: 14,
              }}
            >
              <Text style={[type.meta, { color: on ? theme.accentInk : theme.text }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Pick any. Rows rather than chips, because these labels are sentences. */
export function Checks<T extends string>({
  label,
  options,
  values,
  onToggle,
  disabledReason,
}: {
  label: string;
  options: readonly { value: T; label: string; sublabel?: string }[];
  values: T[];
  onToggle: (v: T) => void;
  /** Why an option cannot be picked. Shown rather than hidden — an option that
   *  silently vanishes reads as a bug, one that explains itself reads as a rule. */
  disabledReason?: (v: T) => string | null;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[type.label, { color: theme.textMuted }]}>{label}</Text>
      <View style={{ gap: space.sm }}>
        {options.map((o) => {
          const blocked = disabledReason?.(o.value) ?? null;
          const on = values.includes(o.value);
          return (
            <Pressable
              key={o.value}
              disabled={Boolean(blocked)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: Boolean(blocked) }}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onToggle(o.value);
              }}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: space.md,
                backgroundColor: theme.surface,
                borderColor: on ? theme.accent : theme.border,
                borderWidth: 1,
                borderRadius: radius.block,
                padding: space.md,
                opacity: blocked ? 0.5 : 1,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: radius.control,
                  borderWidth: 1,
                  borderColor: on ? theme.accent : theme.border,
                  backgroundColor: on ? theme.accent : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 1,
                }}
              >
                {on ? <Ionicons name="checkmark" size={14} color={theme.accentInk} /> : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: theme.text, fontSize: 15, fontWeight: "500" }}>{o.label}</Text>
                {o.sublabel ? (
                  <Text style={[type.meta, { color: theme.textMuted }]}>{o.sublabel}</Text>
                ) : null}
                {blocked ? (
                  <Text style={[type.meta, { color: theme.danger }]}>{blocked}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A single agreement tick. Square box, because it is not a chip. */
export function Consent({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onToggle();
      }}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: radius.control,
          borderWidth: 1,
          borderColor: checked ? theme.accent : theme.border,
          backgroundColor: checked ? theme.accent : "transparent",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
        }}
      >
        {checked ? <Ionicons name="checkmark" size={15} color={theme.accentInk} /> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

/** The rules an applicant is agreeing to. Shown, not linked. */
export function Acknowledgements({ items }: { items: readonly string[] }) {
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: radius.block,
        padding: space.lg,
        gap: space.sm,
      }}
    >
      {items.map((line) => (
        <View key={line} style={{ flexDirection: "row", gap: space.sm }}>
          <Text style={{ color: theme.accent }}>·</Text>
          <Text style={[type.meta, { color: theme.textMuted, flex: 1 }]}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

export function SubmitButton({
  label,
  onPress,
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const off = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(off) }}
      style={({ pressed }) => ({
        backgroundColor: off ? theme.surface2 : pressed ? theme.accentPressed : theme.accent,
        borderRadius: radius.control,
        paddingVertical: 15,
        alignItems: "center",
      })}
    >
      <Text
        style={[
          type.label,
          { color: off ? theme.textMuted : theme.accentInk, letterSpacing: 1.2 },
        ]}
      >
        {busy ? "Sending…" : label}
      </Text>
    </Pressable>
  );
}

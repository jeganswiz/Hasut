import { apiErrorMessage, hasutErrorCode } from "@hasut/api-client";
import { DEFAULT_THEME_TOKENS } from "@hasut/config";
import type { AuthVerifyResult, OtpChallengeReceipt, ThemeTokens } from "@hasut/types";
import { isEmail } from "@hasut/utils";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from "react-native";
import { createMobileApiClient } from "./api";
import { mobileTokenStorage } from "./token-storage";

type Status = "idle" | "loading" | "error" | "success";
type Method = "password" | "code";
type Stage = "signIn" | "twoFactor" | "forgotSend" | "forgotVerify" | "forgotReset" | "done";

interface Feedback {
  status: Status;
  message: string;
}

const IDLE: Feedback = { status: "idle", message: "" };

/** Mirrors the web wording so both surfaces explain failures the same way. */
function describe(error: unknown, fallback: string): Feedback {
  const code = hasutErrorCode(error);
  if (code === "RATE_LIMITED") {
    return { status: "error", message: "Too many attempts. Wait a few minutes and try again." };
  }
  if (code === "OTP_RESEND_COOLDOWN") {
    return { status: "error", message: "A code was just sent. Wait before asking for another." };
  }
  if (code === "OTP_INVALID") {
    return { status: "error", message: "That code is not right. Check it and try again." };
  }
  if (code === "OTP_EXPIRED") {
    return { status: "error", message: "That code expired. Send a new one." };
  }
  return { status: "error", message: apiErrorMessage(error, fallback) };
}

function destinationFor(identifier: string): { phone?: string; email?: string } {
  const value = identifier.trim();
  return isEmail(value) ? { email: value } : { phone: value };
}

/** Native six-box code field: typing advances, backspace steps back. */
function OtpBoxes({
  value,
  onChange,
  onComplete,
  length,
  disabled,
  invalid,
  tokens,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete: (next: string) => void;
  length: number;
  disabled: boolean;
  invalid: boolean;
  tokens: ThemeTokens;
}) {
  const refs = useRef<Array<TextInput | null>>([]);
  const digits = value.replace(/\D/g, "").slice(0, length).split("");

  function focus(index: number): void {
    refs.current[Math.max(0, Math.min(index, length - 1))]?.focus();
  }

  function commit(next: string, focusIndex: number): void {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    focus(focusIndex);
    if (clean.length === length) {
      onComplete(clean);
    }
  }

  function handleChange(index: number, raw: string): void {
    const typed = raw.replace(/\D/g, "");
    if (typed.length === 0) {
      return;
    }
    // Android SMS autofill can deliver the whole code into one box.
    if (typed.length > 1) {
      commit(digits.slice(0, index).join("") + typed, index + typed.length);
      return;
    }
    const next = [...digits];
    next[index] = typed;
    commit(next.join(""), index + 1);
  }

  function handleKeyPress(
    index: number,
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ): void {
    if (event.nativeEvent.key !== "Backspace") {
      return;
    }
    const next = [...digits];
    if (next[index] === undefined || next[index] === "") {
      next[index - 1] = "";
      commit(next.join(""), index - 1);
      return;
    }
    next[index] = "";
    commit(next.join(""), index);
  }

  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {Array.from({ length }, (_, index) => (
        <TextInput
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          value={digits[index] ?? ""}
          onChangeText={(raw) => handleChange(index, raw)}
          onKeyPress={(event) => handleKeyPress(index, event)}
          editable={!disabled}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={length}
          accessibilityLabel={`Verification code digit ${index + 1}`}
          style={{
            flex: 1,
            height: 56,
            textAlign: "center",
            fontSize: 22,
            fontWeight: "700",
            color: tokens.text,
            backgroundColor: tokens.surface,
            borderWidth: 1.5,
            borderColor: invalid
              ? tokens.danger
              : (digits[index] ?? "") !== ""
                ? tokens.primary
                : tokens.border,
            borderRadius: 12,
          }}
        />
      ))}
    </View>
  );
}

export function LoginScreen() {
  const tokens = DEFAULT_THEME_TOKENS;
  const styles = makeStyles(tokens);

  const [stage, setStage] = useState<Stage>("signIn");
  const [method, setMethod] = useState<Method>("password");
  const [feedback, setFeedback] = useState<Feedback>(IDLE);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<OtpChallengeReceipt | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);
  const [minLength, setMinLength] = useState(10);

  const busy = feedback.status === "loading";

  useEffect(() => {
    let cancelled = false;
    void createMobileApiClient()
      .authConfig()
      .then((config) => {
        if (!cancelled) {
          setMinLength(config.passwordMinLength);
        }
      })
      .catch(() => {
        /* Sign-in still works on the contract defaults. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function finish(result: AuthVerifyResult): Promise<void> {
    await mobileTokenStorage.setSession(result.tokens);
    setFeedback({
      status: "success",
      message: "Signed in. Your phone number is never shown to other members.",
    });
  }

  async function submitPassword(): Promise<void> {
    if (!isEmail(email)) {
      setFeedback({ status: "error", message: "Enter a valid email address." });
      return;
    }
    if (password.length === 0) {
      setFeedback({ status: "error", message: "Enter your password." });
      return;
    }
    setFeedback({ status: "loading", message: "Checking your details…" });
    try {
      const result = await createMobileApiClient().loginWithPassword({ email, password });
      if (result.status === "TWO_FACTOR_REQUIRED") {
        setChallenge(result.challenge);
        setCode("");
        setStage("twoFactor");
        setFeedback({
          status: "success",
          message: `We sent a code to ${result.challenge.destinationHint}.`,
        });
        return;
      }
      await finish(result);
    } catch (error) {
      setFeedback(describe(error, "Unable to sign in."));
    }
  }

  async function sendLoginCode(resend = false): Promise<void> {
    if (identifier.trim().length === 0) {
      setFeedback({ status: "error", message: "Enter your phone number or email." });
      return;
    }
    setFeedback({ status: "loading", message: "Sending your code…" });
    try {
      const client = createMobileApiClient();
      const body = { ...destinationFor(identifier), purpose: "LOGIN" as const };
      const receipt = resend ? await client.resendOtp(body) : await client.requestOtp(body);
      setChallenge(receipt);
      setCode("");
      setFeedback({
        status: "success",
        message: `Enter the ${receipt.codeLength}-digit code sent to ${receipt.destinationHint}.`,
      });
    } catch (error) {
      setFeedback(describe(error, "Unable to send a code."));
    }
  }

  async function verifyLoginCode(entered: string): Promise<void> {
    setFeedback({ status: "loading", message: "Verifying your code…" });
    try {
      const client = createMobileApiClient();
      const result =
        stage === "twoFactor" && challenge !== null
          ? await client.verifyTwoFactor({ challengeId: challenge.challengeId, code: entered })
          : await client.verifyOtp({
              ...destinationFor(identifier),
              code: entered,
              purpose: "LOGIN",
            });
      await finish(result);
    } catch (error) {
      setCode("");
      setFeedback(describe(error, "Unable to verify that code."));
    }
  }

  async function sendResetCode(): Promise<void> {
    if (identifier.trim().length === 0) {
      setFeedback({ status: "error", message: "Enter your phone number or email." });
      return;
    }
    setFeedback({ status: "loading", message: "Sending your reset code…" });
    try {
      const receipt = await createMobileApiClient().forgotPassword(destinationFor(identifier));
      setChallenge(receipt);
      setCode("");
      setStage("forgotVerify");
      setFeedback({
        status: "success",
        message: `If that account exists, a code is on its way to ${receipt.destinationHint}.`,
      });
    } catch (error) {
      setFeedback(describe(error, "Unable to send a reset code."));
    }
  }

  async function verifyResetCode(entered: string): Promise<void> {
    if (challenge === null) {
      return;
    }
    setFeedback({ status: "loading", message: "Checking your code…" });
    try {
      const result = await createMobileApiClient().verifyPasswordReset({
        challengeId: challenge.challengeId,
        code: entered,
      });
      setTicket(result.ticket);
      setStage("forgotReset");
      setFeedback({ status: "success", message: "Code confirmed. Choose a new password." });
    } catch (error) {
      setCode("");
      setFeedback(describe(error, "Unable to verify that code."));
    }
  }

  async function submitNewPassword(): Promise<void> {
    if (ticket === null) {
      return;
    }
    if (password.length < minLength) {
      setFeedback({ status: "error", message: `Use at least ${minLength} characters.` });
      return;
    }
    setFeedback({ status: "loading", message: "Saving your new password…" });
    try {
      await createMobileApiClient().resetPassword({ ticket, password });
      setStage("done");
      setPassword("");
      setFeedback({
        status: "success",
        message: "Password updated. Every signed-in device was signed out.",
      });
    } catch (error) {
      setFeedback(describe(error, "Unable to set your new password."));
    }
  }

  function reset(): void {
    setStage("signIn");
    setChallenge(null);
    setTicket(null);
    setCode("");
    setPassword("");
    setFeedback(IDLE);
  }

  const note = (
    <View style={styles.note}>
      {busy ? <ActivityIndicator size="small" color={tokens.primary} /> : null}
      <Text
        accessibilityLiveRegion="polite"
        style={[
          styles.status,
          feedback.status === "error" ? { color: tokens.danger } : null,
          feedback.status === "success" ? { color: tokens.success } : null,
        ]}
      >
        {feedback.message}
      </Text>
    </View>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.pad}>
      <Text style={styles.title}>
        {stage === "signIn" || stage === "twoFactor" ? "Sign in" : "Reset password"}
      </Text>

      {stage === "signIn" ? (
        <>
          <View style={styles.tabs}>
            {(["password", "code"] as const).map((id) => (
              <Pressable
                key={id}
                onPress={() => {
                  setMethod(id);
                  setChallenge(null);
                  setFeedback(IDLE);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: method === id }}
                style={[styles.tab, method === id ? styles.tabActive : null]}
              >
                <Text style={method === id ? styles.tabTextActive : styles.tabText}>
                  {id === "password" ? "Password" : "One-time code"}
                </Text>
              </Pressable>
            ))}
          </View>

          {method === "password" ? (
            <>
              <TextInput
                style={styles.field}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={tokens.mutedText}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                editable={!busy}
              />
              <TextInput
                style={styles.field}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={tokens.mutedText}
                secureTextEntry
                autoCapitalize="none"
                textContentType="password"
                editable={!busy}
              />
              {note}
              <Pressable
                style={styles.primary}
                onPress={() => void submitPassword()}
                disabled={busy}
              >
                <Text style={styles.primaryText}>{busy ? "Signing in…" : "Sign in"}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setStage("forgotSend");
                  setFeedback(IDLE);
                }}
              >
                <Text style={styles.link}>Forgot password?</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                style={styles.field}
                value={identifier}
                onChangeText={(next) => {
                  setIdentifier(next);
                  setChallenge(null);
                }}
                placeholder="7010358490 or you@example.com"
                placeholderTextColor={tokens.mutedText}
                autoCapitalize="none"
                editable={!busy}
              />
              {challenge === null ? null : (
                <OtpBoxes
                  value={code}
                  onChange={setCode}
                  onComplete={(entered) => void verifyLoginCode(entered)}
                  length={challenge.codeLength}
                  disabled={busy}
                  invalid={feedback.status === "error"}
                  tokens={tokens}
                />
              )}
              {note}
              {challenge?.debugCode === undefined ? null : (
                <Text style={styles.status}>Development code: {challenge.debugCode}</Text>
              )}
              <Pressable
                style={styles.primary}
                onPress={() => void (challenge === null ? sendLoginCode() : verifyLoginCode(code))}
                disabled={busy}
              >
                <Text style={styles.primaryText}>
                  {challenge === null ? "Send code" : "Verify and sign in"}
                </Text>
              </Pressable>
              {challenge === null ? null : (
                <Pressable onPress={() => void sendLoginCode(true)} disabled={busy}>
                  <Text style={styles.link}>Send a new code</Text>
                </Pressable>
              )}
            </>
          )}
        </>
      ) : null}

      {stage === "twoFactor" && challenge !== null ? (
        <>
          <Text style={styles.status}>
            Two-step verification is on for this account. Enter the code sent to{" "}
            {challenge.destinationHint}.
          </Text>
          <OtpBoxes
            value={code}
            onChange={setCode}
            onComplete={(entered) => void verifyLoginCode(entered)}
            length={challenge.codeLength}
            disabled={busy}
            invalid={feedback.status === "error"}
            tokens={tokens}
          />
          {note}
          {challenge.debugCode === undefined ? null : (
            <Text style={styles.status}>Development code: {challenge.debugCode}</Text>
          )}
          <Pressable
            style={styles.primary}
            onPress={() => void verifyLoginCode(code)}
            disabled={busy}
          >
            <Text style={styles.primaryText}>Verify and sign in</Text>
          </Pressable>
          <Pressable onPress={reset}>
            <Text style={styles.link}>Use a different account</Text>
          </Pressable>
        </>
      ) : null}

      {stage === "forgotSend" ? (
        <>
          <Text style={styles.status}>
            Enter the phone number or email on your account and we will send a one-time code.
          </Text>
          <TextInput
            style={styles.field}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="7010358490 or you@example.com"
            placeholderTextColor={tokens.mutedText}
            autoCapitalize="none"
            editable={!busy}
          />
          {note}
          <Pressable style={styles.primary} onPress={() => void sendResetCode()} disabled={busy}>
            <Text style={styles.primaryText}>Send reset code</Text>
          </Pressable>
          <Pressable onPress={reset}>
            <Text style={styles.link}>Back to sign in</Text>
          </Pressable>
        </>
      ) : null}

      {stage === "forgotVerify" && challenge !== null ? (
        <>
          <Text style={styles.status}>
            Enter the {challenge.codeLength}-digit code sent to {challenge.destinationHint}.
          </Text>
          <OtpBoxes
            value={code}
            onChange={setCode}
            onComplete={(entered) => void verifyResetCode(entered)}
            length={challenge.codeLength}
            disabled={busy}
            invalid={feedback.status === "error"}
            tokens={tokens}
          />
          {note}
          {challenge.debugCode === undefined ? null : (
            <Text style={styles.status}>Development code: {challenge.debugCode}</Text>
          )}
          <Pressable
            style={styles.primary}
            onPress={() => void verifyResetCode(code)}
            disabled={busy}
          >
            <Text style={styles.primaryText}>Continue</Text>
          </Pressable>
        </>
      ) : null}

      {stage === "forgotReset" ? (
        <>
          <TextInput
            style={styles.field}
            value={password}
            onChangeText={setPassword}
            placeholder={`New password (min ${minLength} characters)`}
            placeholderTextColor={tokens.mutedText}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            editable={!busy}
          />
          {note}
          <Pressable
            style={styles.primary}
            onPress={() => void submitNewPassword()}
            disabled={busy}
          >
            <Text style={styles.primaryText}>Set new password</Text>
          </Pressable>
        </>
      ) : null}

      {stage === "done" ? (
        <>
          {note}
          <Pressable style={styles.primary} onPress={reset}>
            <Text style={styles.primaryText}>Back to sign in</Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: tokens.background },
    pad: { padding: 16, gap: 12 },
    title: { fontWeight: "700", fontSize: 24, color: tokens.text },
    status: { color: tokens.mutedText, flexShrink: 1 },
    note: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 22 },
    tabs: {
      flexDirection: "row",
      gap: 4,
      padding: 4,
      borderWidth: 1,
      borderColor: tokens.border,
      borderRadius: 12,
    },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
    tabActive: { backgroundColor: tokens.primary },
    tabText: { color: tokens.mutedText, fontWeight: "500" },
    tabTextActive: { color: tokens.textOnPrimary, fontWeight: "700" },
    field: {
      borderWidth: 1.5,
      borderColor: tokens.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 14,
      fontSize: 16,
      color: tokens.text,
      backgroundColor: tokens.surface,
    },
    primary: {
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      backgroundColor: tokens.primary,
    },
    primaryText: { color: tokens.textOnPrimary, fontWeight: "700", fontSize: 16 },
    link: { color: tokens.primary, fontWeight: "600", paddingVertical: 6 },
  });
}

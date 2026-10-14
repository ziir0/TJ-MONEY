import React, { FormEvent, useCallback, useState } from "react";
import { useLocation } from "wouter";
import AuthCaptcha from "@/components/AuthCaptcha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

type AuthMode = "signin" | "signup" | "forgot";

const MIN_PASSWORD_LENGTH = 12;

function authErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("captcha")) return "Security verification failed. Please try again.";
  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Too many attempts. Please wait a few minutes before trying again.";
  }
  if (normalized.includes("password") && (normalized.includes("weak") || normalized.includes("characters"))) {
    return `Choose a stronger password with at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (normalized.includes("email not confirmed")) {
    return "Please confirm your email address before signing in. You can request a new confirmation email below.";
  }
  return "We could not complete that request. Check your details and try again.";
}

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<AuthMode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("confirmed")) return "Email confirmed. You can now sign in.";
    if (params.has("password-updated")) return "Password updated. Sign in with your new password.";
    return null;
  });
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const onCaptchaToken = useCallback((token: string | null) => setCaptchaToken(token), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "signup" && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!captchaToken) {
      setError("Complete the security verification before continuing.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error: requestError } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: `${window.location.origin}/reset-password`,
            captchaToken,
          },
        );
        if (requestError) throw requestError;
        setNotice("If an account exists for that address, a password reset link has been sent.");
        return;
      }

      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login?confirmed=1`,
            captchaToken,
          },
        });
        if (signUpError) throw signUpError;

        if (!data.session) {
          setConfirmationPending(true);
          setMode("signin");
          setNotice(`Check ${email.trim()} for a confirmation link. You may need to check your spam folder.`);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
          options: { captchaToken },
        });
        if (signInError) throw signInError;
      }

      setLocation("/");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "";
      if (message.toLowerCase().includes("email not confirmed")) {
        setConfirmationPending(true);
        setNotice("Please confirm your email address before signing in. You can request a new confirmation link below.");
      } else {
        setError(authErrorMessage(message));
      }
    } finally {
      setLoading(false);
      setCaptchaToken(null);
      setCaptchaResetKey((key) => key + 1);
    }
  }

  async function resendConfirmation() {
    setError(null);
    setNotice(null);
    if (!captchaToken) {
      setError("Complete the security verification before continuing.");
      return;
    }

    setLoading(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/login?confirmed=1`,
          captchaToken,
        },
      });
      if (resendError) throw resendError;
      setNotice(`If ${email.trim()} has a pending account, a new confirmation link has been sent.`);
    } catch (requestError) {
      setError(authErrorMessage(requestError instanceof Error ? requestError.message : ""));
    } finally {
      setLoading(false);
      setCaptchaToken(null);
      setCaptchaResetKey((key) => key + 1);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setError(null);
    setNotice(null);
    setConfirmationPending(false);
    setConfirmPassword("");
    setCaptchaToken(null);
    setCaptchaResetKey((key) => key + 1);
    setMode(nextMode);
  }

  const isPasswordFlow = mode === "signin" || mode === "signup";

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-md flex-col gap-6 rounded-lg border bg-card p-8 shadow-sm"
      >
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}
          </h1>
          <p className="text-sm text-muted-foreground">Access your trading journal.</p>
        </div>

        {confirmationPending ? (
          <div className="space-y-4">
            <p role="status" className="text-sm text-muted-foreground">{notice}</p>
            <AuthCaptcha onToken={onCaptchaToken} resetKey={captchaResetKey} />
            <Button type="button" disabled={loading || !captchaToken} onClick={() => void resendConfirmation()} className="w-full">
              {loading ? "Sending..." : "Resend confirmation email"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => changeMode("signin")} className="w-full">
              Back to sign in
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              {mode === "signup" ? (
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </div>
              ) : null}

              {isPasswordFlow ? (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  {mode === "signup" ? (
                    <p className="text-xs text-muted-foreground">Use at least {MIN_PASSWORD_LENGTH} characters.</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <AuthCaptcha onToken={onCaptchaToken} resetKey={captchaResetKey} />

            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}

            <Button type="submit" disabled={loading || !captchaToken} className="w-full">
              {loading
                ? mode === "signin" ? "Signing in..." : mode === "signup" ? "Creating account..." : "Sending..."
                : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </Button>

            {mode === "signin" ? (
              <>
                <Button type="button" variant="ghost" onClick={() => changeMode("forgot")} disabled={loading}>
                  Forgot password?
                </Button>
                <Button type="button" variant="ghost" onClick={() => changeMode("signup")} disabled={loading}>
                  Need an account? Sign up
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" onClick={() => changeMode("signin")} disabled={loading}>
                Back to sign in
              </Button>
            )}
          </>
        )}
      </form>
    </div>
  );
}

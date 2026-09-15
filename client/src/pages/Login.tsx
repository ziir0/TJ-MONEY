import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    console.info("[TJ Auth] Authentication submitted", {
      mode,
      emailProvided: Boolean(email.trim()),
      passwordProvided: Boolean(password),
      passwordLength: password.length,
    });

    if (mode === "signup" && password !== confirmPassword) {
      setLoading(false);
      setError("Passwords do not match.");
      return;
    }

    const result =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (result.error) {
      console.error("[TJ Auth] Authentication failed", {
        mode,
        message: result.error.message,
        name: result.error.name,
        status: result.error.status ?? null,
      });
      setError(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      console.info("[TJ Auth] Sign-up accepted; email confirmation required");
      setError("Account created. Check your email to confirm your account before signing in.");
      return;
    }

    console.info("[TJ Auth] Authentication accepted by Supabase", { mode });
    setLocation("/");
  }

  function toggleMode() {
    setError(null);
    setConfirmPassword("");
    setMode(current => (current === "signin" ? "signup" : "signin"));
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-md flex-col gap-6 rounded-lg border bg-card p-8 shadow-sm"
      >
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Access your trading journal.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
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
                onChange={event => setConfirmPassword(event.target.value)}
                required
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              required
            />
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={loading} className="w-full">
          {loading
            ? mode === "signin"
              ? "Signing in..."
              : "Creating account..."
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </Button>
        <Button type="button" variant="ghost" onClick={toggleMode} disabled={loading}>
          {mode === "signin"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </Button>
      </form>
    </div>
  );
}

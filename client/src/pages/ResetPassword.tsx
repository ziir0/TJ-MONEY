import React, { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

const MIN_PASSWORD_LENGTH = 12;

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const verifyRecoverySession = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const isRecovery = window.sessionStorage.getItem("tj-password-recovery") === "true";
      if (!active) return;
      setReady(Boolean(data.session && !sessionError && isRecovery));
      setLoading(false);
    };

    void verifyRecoverySession();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") {
        window.sessionStorage.setItem("tj-password-recovery", "true");
        setReady(Boolean(session));
        setLoading(false);
      } else if (!session) {
        setReady(false);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(
          updateError.message.toLowerCase().includes("password")
            ? `Choose a stronger password with at least ${MIN_PASSWORD_LENGTH} characters.`
            : "The reset link may have expired. Request a new one and try again.",
        );
        setLoading(false);
        return;
      }

      window.sessionStorage.removeItem("tj-password-recovery");
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError("Password updated, but we could not end this session. Please sign out and sign in again.");
        setLoading(false);
        return;
      }
      setLocation("/login?password-updated=1");
    } catch {
      setError("The password could not be updated. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-6 rounded-lg border bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
          <p className="text-sm text-muted-foreground">Choose a strong password with at least {MIN_PASSWORD_LENGTH} characters.</p>
        </div>
        {loading && !ready ? (
          <p role="status" className="text-center text-sm text-muted-foreground">Verifying your reset link...</p>
        ) : !ready ? (
          <div className="space-y-4">
            <p role="alert" className="text-sm text-destructive">This password reset link is invalid or has expired.</p>
            <Button type="button" className="w-full" onClick={() => setLocation("/login")}>Request a new reset link</Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm new password</Label>
              <Input id="confirm-new-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            </div>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={loading} className="w-full">Update password</Button>
          </>
        )}
      </form>
    </div>
  );
}

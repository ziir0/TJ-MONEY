// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Login from "./Login";

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  setLocation: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: mocks.signUp,
      signInWithPassword: mocks.signInWithPassword,
      resend: mocks.resend,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
    },
  },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/login", mocks.setLocation],
}));

vi.mock("@/components/AuthCaptcha", () => ({
  default: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken("turnstile-token")}>Complete mock verification</button>
  ),
}));

describe("Login authentication flows", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("requires a 12-character password for signup", async () => {
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: "Need an account? Sign up" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "trader@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Complete mock verification" }));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect((await screen.findByRole("alert")).textContent).toContain("at least 12 characters");
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("signs up with CAPTCHA and offers a confirmation resend", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    mocks.resend.mockResolvedValue({ error: null });
    render(<Login />);

    fireEvent.click(screen.getByRole("button", { name: "Need an account? Sign up" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "trader@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a-strong-passphrase" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "a-strong-passphrase" } });
    fireEvent.click(screen.getByRole("button", { name: "Complete mock verification" }));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect((await screen.findByRole("status")).textContent).toContain("Check trader@example.com");
    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "trader@example.com",
      password: "a-strong-passphrase",
      options: expect.objectContaining({
        captchaToken: "turnstile-token",
        emailRedirectTo: expect.stringContaining("/login?confirmed=1"),
      }),
    }));

    fireEvent.click(screen.getByRole("button", { name: "Complete mock verification" }));
    fireEvent.click(screen.getByRole("button", { name: "Resend confirmation email" }));
    await waitFor(() => expect(mocks.resend).toHaveBeenCalledWith(expect.objectContaining({
      type: "signup",
      email: "trader@example.com",
      options: expect.objectContaining({ captchaToken: "turnstile-token" }),
    })));
  });

  it("sends a CAPTCHA-protected password reset with a generic confirmation", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "trader@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Complete mock verification" }));
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    const notice = await screen.findByRole("status");
    expect(notice.textContent).toContain("If an account exists");
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "trader@example.com",
      expect.objectContaining({
        captchaToken: "turnstile-token",
        redirectTo: expect.stringContaining("/reset-password"),
      }),
    );
  });

  it("offers confirmation resend after an unconfirmed email sign-in", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: new Error("Email not confirmed"),
    });
    render(<Login />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "trader@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a-strong-passphrase" } });
    fireEvent.click(screen.getByRole("button", { name: "Complete mock verification" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect((await screen.findByRole("status")).textContent).toContain("confirm your email");
    expect(screen.getByRole("button", { name: "Resend confirmation email" })).toBeTruthy();
  });
});

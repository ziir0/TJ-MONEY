// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ResetPassword from "./ResetPassword";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  setLocation: vi.fn(),
  authStateChange: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      updateUser: mocks.updateUser,
      signOut: mocks.signOut,
      onAuthStateChange: mocks.authStateChange,
    },
  },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/reset-password", mocks.setLocation],
}));

describe("Reset password flow", () => {
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("updates the password only with a valid recovery session", async () => {
    window.sessionStorage.setItem("tj-password-recovery", "true");
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } }, error: null });
    mocks.authStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    mocks.updateUser.mockResolvedValue({ error: null });
    mocks.signOut.mockResolvedValue({ error: null });

    render(<ResetPassword />);
    await screen.findByLabelText("New password");

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "a-new-secure-passphrase" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "a-new-secure-passphrase" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith({ password: "a-new-secure-passphrase" }));
    expect(mocks.signOut).toHaveBeenCalled();
    expect(mocks.setLocation).toHaveBeenCalledWith("/login?password-updated=1");
  });

  it("does not allow updating a password without a recovery session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.authStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });

    render(<ResetPassword />);
    expect((await screen.findByRole("alert")).textContent).toContain("invalid or has expired");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});

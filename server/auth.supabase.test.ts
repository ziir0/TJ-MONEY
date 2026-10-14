import { describe, expect, it } from "vitest";
import { isSupabaseEmailConfirmed } from "./_core/supabase";

describe("Supabase email confirmation", () => {
  it("allows only auth users with a confirmation timestamp", () => {
    expect(isSupabaseEmailConfirmed({ email_confirmed_at: "2026-10-14T12:00:00.000Z" })).toBe(true);
    expect(isSupabaseEmailConfirmed({ email_confirmed_at: null })).toBe(false);
    expect(isSupabaseEmailConfirmed({})).toBe(false);
  });
});

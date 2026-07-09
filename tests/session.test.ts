import { beforeEach, describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/session";

describe("session tokens", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret-at-least-32-chars-long!!";
  });

  it("round-trips a valid token", async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token.slice(0, -2) + "xx")).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken();
    process.env.SESSION_SECRET = "another-secret-entirely-32-chars!!!";
    expect(await verifySessionToken(token)).toBe(false);
  });

  it("rejects garbage", async () => {
    expect(await verifySessionToken("not-a-jwt")).toBe(false);
  });
});

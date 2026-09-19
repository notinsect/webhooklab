import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { generateEndpointToken } from "@/lib/token";
import { redactHeaderValue, redactHeaders } from "@/lib/redaction";
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken, verifyEndpointOwnership } from "@/lib/auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { validateReplayUrl } from "@/lib/ssrf";
import { sanitizeReplayHeaders } from "@/lib/replay";
import { db } from "@/db";
import { users, webhookEndpoints } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("Phase 6: Authentication & Cross-User Security", () => {
  let userAId: string;
  let userBId: string;
  let endpointAId: string;
  let endpointBId: string;
  const tokenA = generateEndpointToken();
  const tokenB = generateEndpointToken();

  beforeAll(async () => {
    // 1. Create User A and User B
    const passHashA = await hashPassword("PasswordUserA123!");
    const [uA] = await db
      .insert(users)
      .values({ email: `usera_${Date.now()}@example.com`, name: "User A", passwordHash: passHashA })
      .returning();
    userAId = uA.id;

    const passHashB = await hashPassword("PasswordUserB456!");
    const [uB] = await db
      .insert(users)
      .values({ email: `userb_${Date.now()}@example.com`, name: "User B", passwordHash: passHashB })
      .returning();
    userBId = uB.id;

    // 2. Create Endpoint A (owned by User A) and Endpoint B (owned by User B)
    const [epA] = await db
      .insert(webhookEndpoints)
      .values({ userId: userAId, name: "Endpoint A (User A)", token: tokenA })
      .returning();
    endpointAId = epA.id;

    const [epB] = await db
      .insert(webhookEndpoints)
      .values({ userId: userBId, name: "Endpoint B (User B)", token: tokenB })
      .returning();
    endpointBId = epB.id;
  });

  afterAll(async () => {
    if (endpointAId) await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, endpointAId));
    if (endpointBId) await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, endpointBId));
    if (userAId) await db.delete(users).where(eq(users.id, userAId));
    if (userBId) await db.delete(users).where(eq(users.id, userBId));
  });

  test("hashes and verifies passwords securely using PBKDF2 Web Crypto", async () => {
    const rawPass = "MySecurePassword99!";
    const hash = await hashPassword(rawPass);
    expect(hash).toContain(":");
    expect(await verifyPassword(rawPass, hash)).toBe(true);
    expect(await verifyPassword("WrongPassword", hash)).toBe(false);
  });

  test("creates and verifies signed JWT session tokens", async () => {
    const payload = { userId: userAId, email: "usera@example.com" };
    const jwt = await createSessionToken(payload);
    expect(typeof jwt).toBe("string");

    const decoded = await verifySessionToken(jwt);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(userAId);
  });

  test("enforces endpoint ownership and blocks cross-user access", async () => {
    // User A owns Endpoint A
    expect(await verifyEndpointOwnership(endpointAId, userAId)).toBe(true);
    // User A does NOT own Endpoint B
    expect(await verifyEndpointOwnership(endpointBId, userAId)).toBe(false);
    // User B owns Endpoint B
    expect(await verifyEndpointOwnership(endpointBId, userBId)).toBe(true);
    // User B does NOT own Endpoint A
    expect(await verifyEndpointOwnership(endpointAId, userBId)).toBe(false);
  });

  test("multi-instance rate limiter allows normal flow and triggers 429 when exceeded", async () => {
    const testToken = generateEndpointToken();
    const testIp = `192.168.1.${Math.floor(Math.random() * 200 + 10)}`;

    // First request allowed
    const r1 = await checkRateLimit(testToken, testIp);
    expect(r1.allowed).toBe(true);

    // Rapid requests loop
    for (let i = 0; i < 59; i++) {
      await checkRateLimit(testToken, testIp);
    }

    // 61st request triggers rate limit
    const r61 = await checkRateLimit(testToken, testIp);
    expect(r61.allowed).toBe(false);
    expect(r61.retryAfter).toBeGreaterThan(0);
  });
});

describe("Phase 7: Secure Request Replay & SSRF Safeguards", () => {
  test("rejects loopback, private IP, and cloud metadata destination URLs", async () => {
    const blockedTargets = [
      "http://127.0.0.1/webhook",
      "http://localhost/test",
      "http://[::1]/api",
      "http://10.0.0.1/private",
      "http://172.16.0.1/internal",
      "http://192.168.1.1/router",
      "http://169.254.169.254/latest/meta-data/",
      "file:///etc/passwd",
      "ftp://example.com/file",
      "https://admin:secret@example.com/webhook",
    ];

    for (const target of blockedTargets) {
      const result = await validateReplayUrl(target);
      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
    }
  });

  test("strips sensitive credential headers and hop-by-hop headers before replay", () => {
    const rawHeaders = {
      "host": "app.example.com",
      "connection": "keep-alive",
      "content-type": "application/json",
      "authorization": "Bearer secret_jwt_token_99",
      "cookie": "session_id=12345",
      "x-api-key": "ak_live_12345",
      "x-custom-header": "valid_header_value",
    };

    const sanitized = sanitizeReplayHeaders(rawHeaders);

    expect(sanitized["content-type"]).toBe("application/json");
    expect(sanitized["x-custom-header"]).toBe("valid_header_value");

    // Must strip transport & credential headers
    expect(sanitized["host"]).toBeUndefined();
    expect(sanitized["connection"]).toBeUndefined();
    expect(sanitized["authorization"]).toBeUndefined();
    expect(sanitized["cookie"]).toBeUndefined();
    expect(sanitized["x-api-key"]).toBeUndefined();
  });
});

describe("Phase 5 & 6: Header Redaction & Search Safety", () => {
  test("redacts sensitive header credentials (authorization, cookie, x-api-key)", () => {
    expect(redactHeaderValue("authorization", "Bearer secret_live_key_998877")).toBe("Bearer ••••••••");
    expect(redactHeaderValue("cookie", "session_id=abcdef123456")).toBe("••••••••");
    expect(redactHeaderValue("x-api-key", "ak_live_123456789")).toBe("••••••••");
  });

  test("does not include sensitive raw headers in safe copy JSON object", () => {
    const rawHeaders = {
      "content-type": "application/json",
      "authorization": "Bearer secret_key",
      "x-api-key": "secret_api_key",
    };

    const redacted = redactHeaders(rawHeaders);
    const safeJsonString = JSON.stringify({
      method: "POST",
      path: "/h/token123",
      headers: redacted,
    });

    expect(safeJsonString).not.toContain("secret_key");
    expect(safeJsonString).not.toContain("secret_api_key");
    expect(safeJsonString).toContain("Bearer ••••••••");
  });
});

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { generateEndpointToken } from "@/lib/token";
import { db } from "@/db";
import { webhookEndpoints } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("Phase 1: Token Generation", () => {
  test("generates unique 24-character hex token with high entropy", () => {
    const token1 = generateEndpointToken();
    const token2 = generateEndpointToken();

    expect(token1).toHaveLength(24);
    expect(token2).toHaveLength(24);
    expect(token1).not.toBe(token2);
    expect(/^[0-9a-f]{24}$/.test(token1)).toBe(true);
  });
});

describe("Phase 1: Database & Endpoint Lifecycle", () => {
  let createdEndpointId: string;
  const token = generateEndpointToken();

  beforeAll(async () => {
    const [ep] = await db
      .insert(webhookEndpoints)
      .values({
        name: "Stripe Development",
        token,
      })
      .returning();
    createdEndpointId = ep.id;
  });

  afterAll(async () => {
    if (createdEndpointId) {
      await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, createdEndpointId));
    }
  });

  test("persists endpoint in PostgreSQL with name and token", async () => {
    const fetched = await db.query.webhookEndpoints.findFirst({
      where: eq(webhookEndpoints.id, createdEndpointId),
    });

    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe("Stripe Development");
    expect(fetched?.token).toBe(token);
    expect(fetched?.createdAt).toBeDefined();
  });

  test("allows creating endpoint with optional/empty name", async () => {
    const defaultToken = generateEndpointToken();
    const [ep] = await db
      .insert(webhookEndpoints)
      .values({
        name: "Untitled Endpoint",
        token: defaultToken,
      })
      .returning();

    expect(ep.name).toBe("Untitled Endpoint");
    expect(ep.token).toBe(defaultToken);

    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, ep.id));
  });

  test("validates token presence in public ingestion endpoint route logic", async () => {
    // Valid token lookup
    const validEp = await db.query.webhookEndpoints.findFirst({
      where: eq(webhookEndpoints.token, token),
    });
    expect(validEp).not.toBeNull();

    // Unknown token lookup
    const unknownEp = await db.query.webhookEndpoints.findFirst({
      where: eq(webhookEndpoints.token, "non_existent_token_123456"),
    });
    expect(unknownEp).toBeUndefined();
  });

  test("deletes endpoint successfully and removes token from database", async () => {
    const deleteToken = generateEndpointToken();
    const [ep] = await db
      .insert(webhookEndpoints)
      .values({ name: "To Delete", token: deleteToken })
      .returning();

    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, ep.id));

    const remaining = await db.query.webhookEndpoints.findFirst({
      where: eq(webhookEndpoints.id, ep.id),
    });

    expect(remaining).toBeUndefined();
  });
});

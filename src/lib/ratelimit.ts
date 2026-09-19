import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { eq } from "drizzle-orm";

interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

const TOKEN_WINDOW_SECONDS = 60;
const MAX_REQUESTS_PER_TOKEN = 60; // 60 req/min per endpoint token

const IP_WINDOW_SECONDS = 60;
const MAX_REQUESTS_PER_IP = 120; // 120 req/min per IP address

/**
 * Multi-instance safe rate limiter backed by PostgreSQL.
 */
export async function checkRateLimit(
  token: string,
  ipAddress: string
): Promise<RateLimitResult> {
  const now = new Date();

  // 1. Check endpoint token limit
  const tokenKey = `token:${token}`;
  const tokenLimit = await evaluateKeyLimit(
    tokenKey,
    MAX_REQUESTS_PER_TOKEN,
    TOKEN_WINDOW_SECONDS,
    now
  );

  if (!tokenLimit.allowed) {
    return tokenLimit;
  }

  // 2. Check IP limit
  const ipKey = `ip:${ipAddress}`;
  const ipLimit = await evaluateKeyLimit(
    ipKey,
    MAX_REQUESTS_PER_IP,
    IP_WINDOW_SECONDS,
    now
  );

  if (!ipLimit.allowed) {
    return ipLimit;
  }

  return { allowed: true, retryAfter: 0 };
}

async function evaluateKeyLimit(
  key: string,
  maxCount: number,
  windowSeconds: number,
  now: Date
): Promise<RateLimitResult> {
  const [existing] = await db
    .select()
    .from(rateLimits)
    .where(eq(rateLimits.key, key))
    .limit(1);

  if (!existing || now > existing.resetAt) {
    const newResetAt = new Date(now.getTime() + windowSeconds * 1000);
    await db
      .insert(rateLimits)
      .values({
        key,
        count: 1,
        resetAt: newResetAt,
      })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: 1,
          resetAt: newResetAt,
        },
      });

    return { allowed: true, retryAfter: 0 };
  }

  if (existing.count >= maxCount) {
    const retryAfter = Math.max(
      1,
      Math.ceil((existing.resetAt.getTime() - now.getTime()) / 1000)
    );
    return { allowed: false, retryAfter };
  }

  await db
    .update(rateLimits)
    .set({ count: existing.count + 1 })
    .where(eq(rateLimits.key, key));

  return { allowed: true, retryAfter: 0 };
}

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { db } from "@/db";
import { webhookEndpoints } from "@/db/schema";
import { eq } from "drizzle-orm";

const COOKIE_NAME = "webhooklab_session";
const SECRET_KEY = new TextEncoder().encode(env.AUTH_SECRET);
const TOKEN_EXPIRY = "7d";

export interface SessionPayload {
  userId: string;
  email: string;
}

/**
 * Hashes a plaintext password using Web Crypto PBKDF2 with SHA-256.
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    passwordKey,
    256
  );

  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const hashHex = Array.from(new Uint8Array(derivedKey))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${saltHex}:${hashHex}`;
}

/**
 * Verifies a plaintext password against a stored PBKDF2 salt:hash string.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    const [saltHex, originalHashHex] = storedHash.split(":");
    if (!saltHex || !originalHashHex) return false;

    const salt = new Uint8Array(
      saltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );

    const derivedKey = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      passwordKey,
      256
    );

    const derivedHashHex = Array.from(new Uint8Array(derivedKey))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return derivedHashHex === originalHashHex;
  } catch {
    return false;
  }
}

/**
 * Signs a JWT token containing user identity payload.
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(SECRET_KEY);
}

/**
 * Verifies and decodes a JWT session token.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    if (!payload.userId || typeof payload.userId !== "string") {
      return null;
    }
    return {
      userId: payload.userId as string,
      email: (payload.email as string) || "",
    };
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the current session user from request cookies or Next.js headers.
 */
export async function getSessionUser(req?: Request | NextRequest): Promise<SessionPayload | null> {
  let token: string | undefined;

  if (req) {
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
      if (match) token = match[1];
    }
    // Also check Authorization: Bearer token for API testing flexibility
    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }
  }

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(COOKIE_NAME)?.value;
    } catch {
      // In non-RSC contexts where cookies() is unavailable
    }
  }

  if (!token) return null;
  return await verifySessionToken(token);
}

/**
 * Verifies whether an endpoint exists AND belongs to the given user ID.
 * Prevents cross-user access.
 */
export async function verifyEndpointOwnership(
  endpointId: string,
  userId: string
): Promise<boolean> {
  if (!endpointId || !userId) return false;
  const [endpoint] = await db
    .select({ id: webhookEndpoints.id, userId: webhookEndpoints.userId })
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, endpointId))
    .limit(1);

  return Boolean(endpoint && endpoint.userId === userId);
}

export { COOKIE_NAME };

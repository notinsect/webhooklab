/**
 * Environment variable loader and validator for WebhookLab.
 */

export const env = {
  DATABASE_URL:
    process.env.DATABASE_URL || "postgres://127.0.0.1:5432/webhooklab",
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  AUTH_SECRET:
    process.env.AUTH_SECRET ||
    "webhooklab_default_fallback_development_jwt_secret_key_32_bytes",
};

export function validateEnv() {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
      throw new Error(
        "FATAL: AUTH_SECRET environment variable must be at least 32 characters in production."
      );
    }
    if (!process.env.DATABASE_URL) {
      throw new Error("FATAL: DATABASE_URL environment variable is required in production.");
    }
  }
}

import { randomBytes } from "crypto";

/**
 * Generates a secure high-entropy token for public webhook URLs (/h/<token>).
 * Length: 24 hex characters (96 bits of randomness).
 */
export function generateEndpointToken(): string {
  return randomBytes(12).toString("hex");
}

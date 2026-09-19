export const SENSITIVE_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "api-key",
  "bearer",
]);

/**
 * Mask sensitive header values.
 */
export function redactHeaderValue(name: string, value: string): string {
  const lowerName = name.toLowerCase();
  if (!SENSITIVE_HEADERS.has(lowerName)) {
    return value;
  }

  if (lowerName === "authorization" || lowerName === "proxy-authorization") {
    const spaceIndex = value.indexOf(" ");
    if (spaceIndex !== -1) {
      const scheme = value.slice(0, spaceIndex);
      return `${scheme} ••••••••`;
    }
  }

  return "••••••••";
}

/**
 * Returns a new headers object with sensitive values redacted.
 */
export function redactHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(headers)) {
    result[key] = redactHeaderValue(key, val);
  }
  return result;
}

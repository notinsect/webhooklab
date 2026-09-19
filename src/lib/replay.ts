import { SENSITIVE_HEADERS } from "./redaction";
import { WebhookRequest } from "@/db/schema";

export interface ReplayExecutionResult {
  status: number | null;
  statusText: string | null;
  headers: Record<string, string>;
  body: string | null;
  bodySize: number;
  durationMs: number;
  error: string | null;
}

const HOP_BY_HOP_HEADERS = new Set([
  "host",
  "content-length",
  "connection",
  "transfer-encoding",
  "keep-alive",
  "accept-encoding",
]);

const MAX_RESPONSE_SIZE = 1024 * 1024; // 1 MB limit
const REPLAY_TIMEOUT_MS = 10000; // 10s timeout

/**
 * Filter captured headers to remove hop-by-hop transport headers and sensitive credentials.
 */
export function sanitizeReplayHeaders(
  headers: Record<string, string> | null | undefined
): Record<string, string> {
  if (!headers) return {};

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lowerKey) && !SENSITIVE_HEADERS.has(lowerKey)) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Executes a controlled outbound webhook replay.
 */
export async function executeReplay(
  capturedRequest: WebhookRequest,
  destinationUrl: string,
  customHeaders?: Record<string, string>
): Promise<ReplayExecutionResult> {
  const startTime = performance.now();

  const outboundHeaders = {
    "user-agent": "WebhookLab-Replay/0.1",
    ...sanitizeReplayHeaders((capturedRequest.headers as Record<string, string>) || {}),
    ...(customHeaders || {}),
  };

  let outboundBody: string | undefined = undefined;
  if (
    capturedRequest.method !== "GET" &&
    capturedRequest.method !== "HEAD" &&
    capturedRequest.rawBody
  ) {
    outboundBody = capturedRequest.rawBody;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REPLAY_TIMEOUT_MS);

  try {
    const response = await fetch(destinationUrl, {
      method: capturedRequest.method,
      headers: outboundHeaders,
      body: outboundBody,
      redirect: "manual",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const durationMs = Math.round(performance.now() - startTime);

    const responseHeadersObj: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      responseHeadersObj[key.toLowerCase()] = val;
    });

    // Handle 3xx manual redirects
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      return {
        status: response.status,
        statusText: response.statusText || "Redirect",
        headers: responseHeadersObj,
        body: location ? `[Redirect location: ${location}]` : "[Redirect response]",
        bodySize: 0,
        durationMs,
        error: null,
      };
    }

    // Read response body up to 1MB ceiling
    const arrayBuffer = await response.arrayBuffer();
    let bodySize = arrayBuffer.byteLength;
    let bodyText = "";

    if (bodySize > MAX_RESPONSE_SIZE) {
      const slicedBuffer = arrayBuffer.slice(0, MAX_RESPONSE_SIZE);
      const decoder = new TextDecoder("utf-8");
      bodyText = decoder.decode(slicedBuffer) + "\n\n[Response truncated: Exceeded 1MB limit]";
      bodySize = MAX_RESPONSE_SIZE;
    } else if (bodySize > 0) {
      const decoder = new TextDecoder("utf-8");
      bodyText = decoder.decode(arrayBuffer);
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeadersObj,
      body: bodyText || null,
      bodySize,
      durationMs,
      error: null,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const durationMs = Math.round(performance.now() - startTime);
    const errorMsg = (err as Error).name === "AbortError"
      ? "Replay timed out after 10 seconds."
      : `Unable to connect to destination: ${(err as Error).message || "Network error"}`;

    return {
      status: null,
      statusText: null,
      headers: {},
      body: null,
      bodySize: 0,
      durationMs,
      error: errorMsg,
    };
  }
}

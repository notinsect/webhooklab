# WebhookLab Security Architecture & Guidelines

WebhookLab is designed with defense-in-depth security principles for public deployment. This document outlines the security controls, boundary models, and operational tradeoffs implemented in WebhookLab v0.1.

---

## 🔒 1. Public Endpoint & Token Security
- **Token Format**: 24-character hexadecimal tokens generated via `crypto.getRandomValues` (96-bit cryptographic entropy).
- **Entropy & Uniqueness**: Tokens are URL-safe, globally unique, and not derived from user IDs, timestamps, or database incrementing IDs.
- **Access Model**: The public ingestion route `/h/[token]` is unauthenticated to allow external third-party services (Stripe, GitHub, Shopify, Postman, curl) to post webhooks without authentication overhead.
- **Token Tradeoffs**: For v0.1, token strings are stored directly in `webhook_endpoints.token` to allow direct URL lookup.

---

## 🔑 2. Authentication & User Ownership
- **Session Management**: Authenticated dashboard routes use HTTP-only, `SameSite=Lax` cookies (`webhooklab_session`) storing HS256 JWT session tokens signed with `AUTH_SECRET`.
- **User Ownership**: Every `webhook_endpoint` table record requires a `user_id` foreign key pointing to `users.id`.
- **Password Security**: Passwords are hashed using Web Crypto PBKDF2 with 100,000 iterations of SHA-256 and a 16-byte random salt (`salt:hash`).
- **Middleware Boundary**: Next.js `middleware.ts` intercepts `/dashboard` and `/dashboard/*`, enforcing authentication before route handlers are invoked.

---

## 🛡️ 3. Cross-User Isolation Guarantees
- **Server-Side Enforcement**: All endpoint retrieval, request listing, single deletion, history clearing, and SSE streaming handlers explicitly check database ownership:
  ```ts
  endpoint.userId === session.userId
  ```
- **Zero Cross-User Access**: User A cannot view, fetch, subscribe to, or modify Endpoint B or its captured requests, even if User A guesses Endpoint B's UUID. Attempted unauthorized access returns HTTP `404 Not Found` to prevent resource enumeration.

---

## ⚡ 4. Rate Limiting & Abuse Safeguards
- **Multi-Instance Safety**: Rate limiting is backed by PostgreSQL (`rate_limits` table), ensuring strict state synchronization across clustered Node processes or serverless environments.
- **Thresholds**:
  - **Per Endpoint Token**: 60 requests / 60 seconds.
  - **Per Source IP**: 120 requests / 60 seconds.
- **Response**: Returns HTTP `429 Too Many Requests` with `{ "error": "rate_limit_exceeded" }` and a `Retry-After` header. Rejected payloads are dropped immediately and not persisted.

---

## 📦 5. Payload & Input Protections
- **Payload Size Limit**: Strict 1MB (`1,048,576 bytes`) limit enforced before array buffer decoding or database allocation. Excess payloads receive HTTP `413 Payload Too Large`.
- **Header Limits**: Maximum 100 headers per request; maximum 8KB per header value to prevent header flooding.
- **Query Limits**: Maximum 50 query parameters per request; maximum 2KB per parameter key/value.

---

## 👁️ 6. Sensitive Header Redaction & XSS Safety
- **Header Redaction**: Sensitive credentials (`authorization`, `proxy-authorization`, `cookie`, `set-cookie`, `x-api-key`, `api-key`, `bearer`) are masked both in the UI display and safe copy JSON actions.
- **Server Log Protection**: Raw bodies and sensitive credential headers are excluded from application stdout logs.
- **XSS Immunity**: Captured webhooks are treated as untrusted data. Payloads containing HTML, `<script>`, or SVG tags are rendered as inert text using React text nodes and `JsonInspector`. `dangerouslySetInnerHTML` is never used.

---

## 🔄 7. Realtime SSE Stream & Retention
- **SSE Ownership Verification**: The stream route `/api/endpoints/[id]/stream` verifies user ownership before opening a connection. Unauthenticated or unauthorized connections are rejected with 401/404.
- **Single-Instance Event Bus**: The current SSE transport uses an in-memory `EventEmitter`. For horizontal scaling across multiple instances, event pub/sub should be backed by Postgres `LISTEN/NOTIFY` or Redis pub/sub.
- **Retention Limit**: 100 requests max per endpoint using SQL subquery offset pruning on every insert.

---

## 🚫 8. Outbound Request Replay Status
> [!IMPORTANT]
> Outbound Request Replay (`/api/requests/[requestId]/replay`) is intentionally **disabled** in Phase 6. Replay introduces Server-Side Request Forgery (SSRF) risks and will be implemented in a dedicated security phase with strict private subnet filtering (RFC1918, localhost, and cloud metadata 169.254.169.254).

---

## 📋 9. Summary of Security Limits
| Metric | Limit | Status Code |
| :--- | :--- | :--- |
| Payload Size | 1 MB (1,048,576 bytes) | HTTP 413 |
| Rate Limit (Token) | 60 req / min | HTTP 429 |
| Rate Limit (IP) | 120 req / min | HTTP 429 |
| Endpoint Retention | 100 requests | Bounded Pruning |
| Max Headers | 100 headers (8KB max value) | Truncated |
| Max Query Params | 50 params (2KB max value) | Truncated |

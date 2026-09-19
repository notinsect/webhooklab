# WebhookLab

> Webhook debugging without the guesswork.

WebhookLab is a production-quality developer-focused webhook debugging platform. It gives developers temporary public HTTP endpoints, captures incoming requests in real time, stores them safely in PostgreSQL, streams them live to an interactive dashboard, and enables deep payload inspection & controlled request replay.

---

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Database & ORM**: PostgreSQL + Drizzle ORM
- **Authentication**: JWT Cookie Sessions (`jose`) + Web Crypto PBKDF2 Password Hashing
- **Realtime**: HTTP Server-Sent Events (SSE) + Event Bus
- **UI Components**: Tailwind CSS v4, shadcn/ui, Lucide Icons, Varnus (`JsonInspector`, `RequestResponseViewer`), `next-themes`
- **Runtime & Testing**: Bun, `bun test`

---

## ✨ Features (Phase 1 – Phase 7)

- **Authenticated Dashboard & User Ownership**: Create an account, sign in securely, and manage endpoints scoped exclusively to your user identity.
- **Public Ingestion Endpoint (`/h/[token]`)**: High-entropy 96-bit hexadecimal public token URLs (`http://localhost:3000/h/<24-hex-token>`) supporting GET, POST, PUT, PATCH, DELETE webhooks without logging in.
- **Realtime SSE Request Streaming**: Instant live update badge (`● Live`) streaming newly arrived webhooks directly to your open browser tab without manual refresh.
- **Payload Capture & Safe Storage**: Stores HTTP method, full request path, query parameters, request headers, parsed JSON/form bodies, raw text, body size, IP address, and timestamps.
- **Varnus-Powered Inspection Experience**: 2-column debugging view with expandable JSON node trees, raw text previews, and sensitive credential redaction (`authorization`, `cookie`, `x-api-key`, etc.).
- **Instant Search & Method Filtering**: ~300ms debounced search over path, query params, and body content; method chips (`ALL`, `GET`, `POST`, `PUT`, `PATCH`, `DELETE`); `/` keyboard shortcut.
- **Request Management & Bounded Retention**: Pagination (25 requests/page), single request deletion, bulk `Clear History`, and automated 100-request retention pruning per endpoint.
- **Secure Webhook Request Replay**: Safely replay captured webhook payloads to approved public HTTP(S) destinations with strict SSRF controls, DNS resolution filtering, sensitive credential exclusion (`Authorization`, `Cookie`), and response rendering using Varnus `RequestResponseViewer`.
- **Multi-Instance Rate Limiting**: PostgreSQL-backed rate limiting (`60 req/min endpoint ingestion`, `120 req/min IP ingestion`, `10 replays/min user`), returning HTTP `429 Too Many Requests` when limits are exceeded.
- **Payload & Abuse Protections**: Strict 1MB payload ceiling (`413 Payload Too Large`), max 100 headers count, and max 8KB per header value.

---

## 🔒 Security

For detailed security guidelines, token entropy analysis, cross-user isolation models, SSRF protections, and abuse controls, see [docs/security.md](docs/security.md).

---

## 🚀 Local Setup Guide

### 1. Prerequisites
Ensure PostgreSQL is running locally:
```bash
brew services start postgresql@17
```

### 2. Install Dependencies
```bash
bun install
```

### 3. Environment Setup
Create a `.env.local` file:
```env
DATABASE_URL="postgres://127.0.0.1:5432/webhooklab"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
AUTH_SECRET="webhooklab_super_secret_development_jwt_key_32_bytes_min!"
```

### 4. Database Setup & Migration
Apply schema migrations:
```bash
bun src/db/migrate.ts
```

### 5. Run Development Server
```bash
bun run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

Run automated test suite covering Auth, Ownership, Cross-User Access Denial, SSRF Replay Protections, Rate Limiting, Payload Limits, and Header Redaction:
```bash
bun test
```

Run code quality and production build checks:
```bash
bun run lint
bun run build
```

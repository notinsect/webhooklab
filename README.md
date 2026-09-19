# WebhookLab (Phase 1)

> Webhook debugging without the guesswork.

WebhookLab is a developer-focused webhook debugging platform. In Phase 1, WebhookLab enables developers to create, manage, copy, and delete secure public HTTP webhook endpoints.

---

## 🛠 Tech Stack (Phase 1)

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Database & ORM**: PostgreSQL + Drizzle ORM
- **Styling**: Tailwind CSS v4, shadcn/ui, Lucide Icons, next-themes (Dark & Light Mode)
- **Runtime**: Bun, `bun test`

---

## ✨ Features (Phase 1)

- **Create Webhook Endpoints**: Generates cryptographically secure 96-bit random tokens (`/h/<24-hex-token>`).
- **Endpoint Dashboard (`/dashboard`)**: List endpoints, copy public webhook URLs, view creation timestamps, and delete endpoints with confirmation.
- **Endpoint Detail View (`/dashboard/endpoints/[id]`)**: Displays endpoint metadata and onboarding `curl` instructions.
- **Public Route Placeholder (`/h/[token]`)**: Validates token existence; returns 404 for unknown/deleted endpoints, and an active status message for valid endpoints.

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
```bash
cp .env.example .env.local
```

Ensure `.env.local` contains:
```env
DATABASE_URL="postgres://127.0.0.1:5432/webhooklab"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Database Setup & Migration
Create the database and push the Drizzle schema:
```bash
psql -h 127.0.0.1 -d postgres -c "CREATE DATABASE webhooklab;"
bunx drizzle-kit push
```

### 5. Run Development Server
```bash
bun run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Phase 1 Validation & Testing

Run the automated Phase 1 test suite:
```bash
bun test
```

Run linter & build checks:
```bash
bun run lint
bun run build
```

---

## 🔮 Upcoming in Phase 2

- Webhook request ingestion engine (`/h/[token]` full payload capture)
- PostgreSQL request persistence
- Server-Sent Events (SSE) live updates
- Request inspector & payload viewer

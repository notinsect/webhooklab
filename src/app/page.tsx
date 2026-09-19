import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Terminal, Zap, Shield, ArrowRight } from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background font-sans antialiased">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 text-center max-w-4xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-mono text-muted-foreground">
            <Zap className="size-3.5 text-amber-500" />
            <span>Realtime Webhook Debugging Platform</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-foreground">
            Webhook debugging without the guesswork.
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Create a temporary HTTP endpoint, copy the URL into Stripe, GitHub, or curl, and inspect captured payloads in real time with high precision.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              <span>Create Webhook Endpoint</span>
              <ArrowRight className="size-4" />
            </Link>

            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-lg border bg-background px-6 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <GithubIcon className="size-4" />
              <span>View GitHub</span>
            </a>
          </div>
        </section>

        {/* 3-Step Demo Visual */}
        <section className="container mx-auto px-4 py-12 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="rounded-xl border bg-card p-6 space-y-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background font-mono font-bold text-sm">
                01
              </div>
              <h3 className="font-semibold text-foreground">1. Create Endpoint</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Instantly generate a high-entropy public token URL shape without authentication hurdles.
              </p>
              <div className="font-mono text-[11px] rounded bg-muted/60 p-2 text-foreground truncate border">
                https://app.com/h/8fx21a9c4b7e
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl border bg-card p-6 space-y-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background font-mono font-bold text-sm">
                02
              </div>
              <h3 className="font-semibold text-foreground">2. Send Webhook</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Paste the generated endpoint URL into Stripe, GitHub, Postman, or send a quick curl.
              </p>
              <div className="font-mono text-[11px] rounded bg-muted/60 p-2 text-emerald-600 dark:text-emerald-400 truncate border">
                curl -X POST /h/8fx21a9c4b7e
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl border bg-card p-6 space-y-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background font-mono font-bold text-sm">
                03
              </div>
              <h3 className="font-semibold text-foreground">3. Inspect Payload</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Watch captured HTTP requests stream live in your browser with interactive JSON body inspection.
              </p>
              <div className="font-mono text-[11px] rounded bg-muted/60 p-2 text-blue-600 dark:text-blue-400 truncate border">
                POST 200 OK • 24ms
              </div>
            </div>
          </div>
        </section>

        {/* Feature Highlights */}
        <section className="container mx-auto px-4 py-12 max-w-4xl border-t">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Terminal className="size-4 text-emerald-500" />
                <span>Developer-First Interface</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Clean, dense UI inspired by Linear & Vercel. Monospace values, automatic header redaction, and instant copy buttons.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Shield className="size-4 text-blue-500" />
                <span>SSRF Protection & Replay</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Safely replay captured webhooks to external destination URLs with strict private IP and metadata subnet filtering.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-xs text-muted-foreground font-mono">
        WebhookLab v0.1 • Production-Grade Developer Tool
      </footer>
    </div>
  );
}

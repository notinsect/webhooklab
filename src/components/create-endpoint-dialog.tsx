"use client";

import { useState } from "react";
import { Plus, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function CreateEndpointDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.endpoint) {
        onClose();
        setName("");
        router.push(`/dashboard/endpoints/${data.endpoint.id}`);
      }
    } catch (err) {
      console.error("Failed to create endpoint:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in-0">
      <div className="w-full max-w-md overflow-hidden rounded-xl border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="font-semibold text-foreground">Create Webhook Endpoint</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Endpoint Name (Optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Stripe development, GitHub events"
              className="w-full h-9 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              A secure 96-bit entropy token URL shape will be generated (`/h/&lt;secure-token&gt;`).
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-md border bg-background px-4 text-xs font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-4 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              <span>Create Endpoint</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

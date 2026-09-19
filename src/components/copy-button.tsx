"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyButton({
  text,
  label = "Copy",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      console.error("Failed to copy");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className
      )}
      title={label}
      aria-label={label}
    >
      {copied ? (
        <>
          <Check className="size-3.5 text-emerald-500" />
          <span className="text-emerald-500 font-medium">Copied</span>
        </>
      ) : (
        <>
          <Copy className="size-3.5" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

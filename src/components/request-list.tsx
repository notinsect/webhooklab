"use client";

import { WebhookRequest } from "@/db/schema";
import { MethodBadge } from "./method-badge";
import { Search, Trash2, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const HTTP_METHODS = ["ALL", "GET", "POST", "PUT", "PATCH", "DELETE"];

export function RequestList({
  requests,
  selectedRequestId,
  onSelectRequest,
  onClearAll,
  onDeleteRequest,
  searchQuery,
  onSearchChange,
  methodFilter,
  onMethodFilterChange,
}: {
  requests: WebhookRequest[];
  selectedRequestId?: string;
  onSelectRequest: (id: string) => void;
  onClearAll: () => void;
  onDeleteRequest: (id: string, e: React.MouseEvent) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  methodFilter: string;
  onMethodFilterChange: (method: string) => void;
}) {
  function formatRelativeTime(dateStr: string | Date) {
    const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 5) return "just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function getPayloadHint(req: WebhookRequest): string {
    if (req.body && typeof req.body === "object") {
      try {
        const keys = Object.keys(req.body);
        if (keys.length > 0) return `{ ${keys.slice(0, 2).join(", ")}${keys.length > 2 ? "..." : ""} }`;
      } catch {
        // Fallback
      }
    }
    if (req.rawBody) {
      const trimmed = req.rawBody.trim();
      return trimmed.length > 30 ? trimmed.slice(0, 30) + "..." : trimmed;
    }
    return "";
  }

  return (
    <div className="flex flex-col h-full border-r bg-card/50">
      {/* Search & Filter Bar */}
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search requests..."
              className="w-full h-8 pl-8 pr-3 text-xs rounded-md border bg-background font-mono outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {requests.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-red-500/10 hover:text-red-600 transition-colors"
              title="Clear all requests"
              aria-label="Clear all requests"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>

        {/* Method Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-mono scrollbar-none">
          <Filter className="size-3 text-muted-foreground shrink-0 ml-1 mr-0.5" />
          {HTTP_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => onMethodFilterChange(method)}
              className={cn(
                "rounded px-2 py-0.5 font-medium transition-colors shrink-0",
                methodFilter === method
                  ? "bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {method}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Header Count */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20 text-[11px] font-mono text-muted-foreground">
        <span>REQUESTS ({requests.length})</span>
        <span>NEWEST FIRST</span>
      </div>

      {/* Request List Items */}
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {requests.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No matching requests.
          </div>
        ) : (
          requests.map((req) => {
            const isSelected = req.id === selectedRequestId;
            const hint = getPayloadHint(req);

            return (
              <div
                key={req.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectRequest(req.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onSelectRequest(req.id);
                  }
                }}
                className={cn(
                  "group relative flex flex-col gap-1 p-3 text-left transition-colors cursor-pointer outline-none focus-visible:bg-muted/60",
                  isSelected
                    ? "bg-muted/80 border-l-2 border-l-foreground"
                    : "hover:bg-muted/40"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <MethodBadge method={req.method} />
                    <span className="font-mono text-xs font-medium text-foreground truncate">
                      {req.path}
                    </span>
                  </div>

                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                    {formatRelativeTime(req.receivedAt)}
                  </span>
                </div>

                {hint && (
                  <div className="font-mono text-[11px] text-muted-foreground truncate pl-0.5">
                    {hint}
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => onDeleteRequest(req.id, e)}
                  className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-opacity"
                  title="Delete request"
                  aria-label="Delete request"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

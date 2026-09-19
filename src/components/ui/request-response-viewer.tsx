"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

import { JsonInspector } from "@/components/ui/json-inspector";
import { cn } from "@/lib/utils";

export type HttpMessage = {
  method?: string;
  url?: string;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  duration?: number;
};

export type RequestResponseViewerProps = {
  request?: HttpMessage;
  response?: HttpMessage;
  defaultTab?: "request" | "response";
};

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "api-key",
]);

function redactHeaderValue(name: string, value: string): string {
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

function safeSerializeForCopy(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return `${value}n`;
  if (value === undefined) return "undefined";
  if (typeof value === "function") return value.toString();

  const seen = new WeakSet();
  try {
    return JSON.stringify(
      value,
      (_key, val) => {
        if (typeof val === "bigint") return `${val}n`;
        if (typeof val === "object" && val !== null) {
          if (seen.has(val)) return "[Circular]";
          seen.add(val);
        }
        return val;
      },
      2,
    );
  } catch {
    return String(value);
  }
}

function formatDuration(ms?: number): string | null {
  if (ms === undefined || ms === null) return null;
  if (ms >= 1000) {
    const sec = ms / 1000;
    return `${Number(sec.toFixed(2))} s`;
  }
  return `${ms} ms`;
}

function getMethodBadgeClass(method?: string): string {
  const m = (method || "").toUpperCase();
  switch (m) {
    case "GET":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30";
    case "POST":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "PUT":
    case "PATCH":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "DELETE":
      return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function getStatusBadgeClass(status?: number): string {
  if (status === undefined || status === null) {
    return "bg-muted text-muted-foreground border-border";
  }
  if (status >= 100 && status < 200) {
    return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30";
  }
  if (status >= 200 && status < 300) {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  }
  if (status >= 300 && status < 400) {
    return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30";
  }
  if (status >= 400 && status < 500) {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
  }
  if (status >= 500 && status < 600) {
    return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30";
  }
  return "bg-muted text-muted-foreground border-border";
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      if (!navigator?.clipboard?.writeText) {
        return;
      }
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Graceful error handling without throwing or changing copied state
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-500" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}

function SectionHeader({
  title,
  copyValue,
  copyLabel,
}: {
  title: string;
  copyValue?: string;
  copyLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b pb-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>

      {copyValue !== undefined && copyLabel && (
        <CopyButton value={copyValue} label={copyLabel} />
      )}
    </div>
  );
}

function KeyValueTable({ entries }: { entries: [string, string][] }) {
  return (
    <div className="overflow-x-auto rounded-md border bg-muted/20">
      <table className="w-full text-left font-mono text-sm">
        <tbody className="divide-y divide-border">
          {entries.map(([key, val]) => (
            <tr key={key} className="hover:bg-muted/40">
              <td className="w-1/3 px-3 py-1.5 font-medium text-foreground whitespace-nowrap break-all">
                {key}
              </td>

              <td className="px-3 py-1.5 text-muted-foreground whitespace-pre-wrap break-all">
                {val}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessageView({
  message,
  type,
}: {
  message: HttpMessage;
  type: "request" | "response";
}) {
  const queryEntries = useMemo(() => {
    if (!message.query) return [];
    return Object.entries(message.query).map(([k, v]) => [
      k,
      v === undefined
        ? "undefined"
        : v === null
          ? "null"
          : String(v),
    ] as [string, string]);
  }, [message.query]);

  const rawHeaderEntries = useMemo(() => {
    if (!message.headers) return [];
    return Object.entries(message.headers);
  }, [message.headers]);

  const redactedHeaderEntries = useMemo(() => {
    return rawHeaderEntries.map(
      ([k, v]) => [k, redactHeaderValue(k, v)] as [string, string],
    );
  }, [rawHeaderEntries]);

  const headersCopyValue = useMemo(() => {
    if (rawHeaderEntries.length === 0) return undefined;
    const obj: Record<string, string> = {};
    redactedHeaderEntries.forEach(([k, v]) => {
      obj[k] = v;
    });
    return JSON.stringify(obj, null, 2);
  }, [rawHeaderEntries.length, redactedHeaderEntries]);

  const bodyData = useMemo(() => {
    if (message.body === undefined) return undefined;
    const b = message.body;

    if (typeof b === "string") {
      const trimmed = b.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed);
          return {
            isJson: true,
            parsed,
            copyValue: safeSerializeForCopy(parsed),
          };
        } catch {
          // Fallback to raw text string if JSON.parse fails
        }
      }
      return { isJson: false, rawString: b, copyValue: b };
    }

    return {
      isJson: true,
      parsed: b,
      copyValue: safeSerializeForCopy(b),
    };
  }, [message.body]);

  const durationLabel = useMemo(
    () => formatDuration(message.duration),
    [message.duration],
  );

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Summary Header */}
      {type === "request" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
            {message.method && (
              <span
                className={cn(
                  "rounded-md border px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider shrink-0",
                  getMethodBadgeClass(message.method),
                )}
              >
                {message.method.toUpperCase()}
              </span>
            )}

            {message.url ? (
              <span className="font-mono text-sm text-foreground break-all">
                {message.url}
              </span>
            ) : (
              <span className="italic text-muted-foreground text-sm">
                No URL specified
              </span>
            )}
          </div>

          {message.url && (
            <CopyButton value={message.url} label="Copy URL" />
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-3">
            {message.status !== undefined && (
              <span
                className={cn(
                  "rounded-md border px-2 py-0.5 font-mono text-xs font-semibold",
                  getStatusBadgeClass(message.status),
                )}
              >
                {message.status}
                {message.statusText ? ` ${message.statusText}` : ""}
              </span>
            )}

            {durationLabel !== null && (
              <span className="font-mono text-xs text-muted-foreground">
                {durationLabel}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Query Parameters Section */}
      {type === "request" && queryEntries.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionHeader title="Query Parameters" />

          <KeyValueTable entries={queryEntries} />
        </div>
      )}

      {/* Headers Section */}
      {redactedHeaderEntries.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionHeader
            title="Headers"
            copyValue={headersCopyValue}
            copyLabel="Copy headers"
          />

          <KeyValueTable entries={redactedHeaderEntries} />
        </div>
      )}

      {/* Body Section */}
      {bodyData !== undefined && (
        <div className="flex flex-col gap-2">
          <SectionHeader
            title="Body"
            copyValue={bodyData.copyValue}
            copyLabel="Copy body"
          />

          {bodyData.isJson ? (
            <div className="rounded-md border p-3">
              <JsonInspector
                data={bodyData.parsed}
                searchable={false}
                defaultExpandedDepth={3}
              />
            </div>
          ) : (
            <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 font-mono text-sm leading-6 whitespace-pre-wrap break-all">
              <code>{bodyData.rawString}</code>
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function RequestResponseViewer({
  request,
  response,
  defaultTab,
}: RequestResponseViewerProps) {
  const availableTabs = useMemo(() => {
    const list: ("request" | "response")[] = [];
    if (request) list.push("request");
    if (response) list.push("response");
    return list;
  }, [request, response]);

  const initialTab = useMemo(() => {
    if (defaultTab === "request" && request) return "request";
    if (defaultTab === "response" && response) return "response";
    if (request) return "request";
    if (response) return "response";
    return "request";
  }, [defaultTab, request, response]);

  const [activeTab, setActiveTab] = useState<"request" | "response">(initialTab);

  const currentTab = useMemo(() => {
    if (activeTab === "request" && !request && response) return "response";
    if (activeTab === "response" && !response && request) return "request";
    return activeTab;
  }, [activeTab, request, response]);

  if (!request && !response) {
    return (
      <div className="rounded-lg border bg-background p-6 text-center text-sm text-muted-foreground">
        No request or response data.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      {/* Header Tabs */}
      {availableTabs.length > 1 ? (
        <div className="flex items-center border-b bg-muted/40 px-3 pt-2">
          <div role="tablist" className="flex items-center gap-1">
            {request && (
              <button
                type="button"
                role="tab"
                aria-selected={currentTab === "request"}
                onClick={() => setActiveTab("request")}
                className={cn(
                  "rounded-t-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2",
                  currentTab === "request"
                    ? "border-foreground text-foreground bg-background"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                Request
              </button>
            )}

            {response && (
              <button
                type="button"
                role="tab"
                aria-selected={currentTab === "response"}
                onClick={() => setActiveTab("response")}
                className={cn(
                  "rounded-t-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2",
                  currentTab === "response"
                    ? "border-foreground text-foreground bg-background"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                Response
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {request ? "Request" : "Response"}
        </div>
      )}

      {/* Tab Content */}
      {currentTab === "request" && request && (
        <MessageView message={request} type="request" />
      )}

      {currentTab === "response" && response && (
        <MessageView message={response} type="response" />
      )}
    </div>
  );
}

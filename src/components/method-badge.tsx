import { cn } from "@/lib/utils";

export function getMethodBadgeClass(method: string): string {
  const m = method.toUpperCase();
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

export function MethodBadge({ method, className }: { method: string; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider shrink-0",
        getMethodBadgeClass(method),
        className
      )}
    >
      {method.toUpperCase()}
    </span>
  );
}

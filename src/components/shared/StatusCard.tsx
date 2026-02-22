import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusValue = "queued" | "running" | "succeeded" | "failed";

interface StatusCardProps {
  title: string;
  subtitle?: string;
  imageUrl: string;
  status: StatusValue;
  progressPct?: number;
  flagLabel?: string;
  flagTone?: "default" | "warning";
  footerLabel?: string;
  onClick?: () => void;
}

const statusLabelMap: Record<StatusValue, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Done",
  failed: "Failed",
};

export function StatusCard({
  title,
  subtitle,
  imageUrl,
  status,
  progressPct,
  flagLabel,
  flagTone = "default",
  footerLabel,
  onClick,
}: StatusCardProps) {
  const isClickable = typeof onClick === "function" && status === "succeeded";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-[var(--color-bg-elevated)] text-left",
        "transition-all",
        isClickable
          ? "cursor-pointer border-[var(--color-success)]/40 hover:border-[var(--color-success)]"
          : "cursor-default border-[var(--color-border)]",
        status === "failed" && "border-[var(--color-error)]/50"
      )}
    >
      <div className="aspect-square">
        <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
      </div>

      <div className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-1 backdrop-blur-sm">
        <p className="text-xs font-medium text-white">{statusLabelMap[status]}</p>
      </div>

      {flagLabel ? (
        <div
          className={cn(
            "absolute right-2 top-2 rounded-md px-2 py-1 backdrop-blur-sm",
            flagTone === "warning" ? "bg-amber-500/90" : "bg-black/60"
          )}
        >
          <p className="text-xs font-medium text-white">{flagLabel}</p>
        </div>
      ) : null}

      <div className="absolute inset-0 flex items-center justify-center bg-black/25">
        {status === "running" ? (
          <div className="flex flex-col items-center gap-1">
            <Loader2 className="h-7 w-7 animate-spin text-[var(--color-accent)]" />
            <p className="text-xs font-medium text-white">{progressPct ?? 0}%</p>
          </div>
        ) : null}
        {status === "queued" ? (
          <Clock className="h-7 w-7 text-white/90" />
        ) : null}
        {status === "succeeded" ? (
          <CheckCircle2 className="h-7 w-7 text-[var(--color-success)]" />
        ) : null}
        {status === "failed" ? <XCircle className="h-7 w-7 text-[var(--color-error)]" /> : null}
      </div>

      <div className="space-y-1 border-t border-[var(--color-border)] p-3">
        <p className="truncate text-sm font-semibold text-[var(--color-text)]">{title}</p>
        {subtitle ? <p className="truncate text-xs text-[var(--color-text-muted)]">{subtitle}</p> : null}
        {footerLabel ? (
          <p className="truncate text-xs text-[var(--color-text-subtle)]">{footerLabel}</p>
        ) : null}
      </div>
    </button>
  );
}

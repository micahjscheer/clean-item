import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
  label: string;
  className?: string;
}

export function LoadingOverlay({ label, className }: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/45 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-2">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent)]" />
        <p className="text-sm text-[var(--color-text)]">{label}</p>
      </div>
    </div>
  );
}

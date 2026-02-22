import { cn } from "@/lib/utils";

interface ProgressBarProps {
  label: string;
  value: number;
  total: number;
  className?: string;
}

export function ProgressBar({ label, value, total, className }: ProgressBarProps) {
  const ratio = total === 0 ? 0 : Math.min(100, Math.round((value / total) * 100));
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--color-text)]">{label}</p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {value}/{total} ({ratio}%)
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
        <div
          className="h-full bg-gradient-to-r from-[var(--color-accent)] to-cyan-500 transition-all duration-300"
          style={{ width: `${ratio}%` }}
        />
      </div>
    </div>
  );
}

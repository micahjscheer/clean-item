import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface SelectorOption<TValue extends string> {
  value: TValue;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface OptionSelectorProps<TValue extends string> {
  label: string;
  value: TValue;
  onChange: (value: TValue) => void;
  options: SelectorOption<TValue>[];
  columnsClassName?: string;
}

export function OptionSelector<TValue extends string>({
  label,
  value,
  onChange,
  options,
  columnsClassName = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
}: OptionSelectorProps<TValue>) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--color-text)]">{label}</h3>
      <div className={cn("grid gap-3", columnsClassName)}>
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "relative min-h-24 rounded-xl border p-4 text-left transition-all",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]",
                isSelected
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-text)]"
                  : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-hover)]"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                    {option.description}
                  </p>
                </div>
                <Icon className="h-5 w-5 shrink-0" />
              </div>
              <div
                className={cn(
                  "absolute right-3 top-3 h-3 w-3 rounded-full border",
                  isSelected
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                    : "border-[var(--color-border)] bg-transparent"
                )}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}

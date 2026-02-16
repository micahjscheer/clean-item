import {
  AlertTriangle,
  BadgeCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ItemCondition } from "@/lib/workflowSchemas";

interface ResearchOptionsPanelProps {
  condition: ItemCondition;
  setCondition: (condition: ItemCondition) => void;
  onStart: () => void;
  imageCount: number;
  showStart?: boolean;
  startLabel?: string;
}

const conditionOptions: {
  value: ItemCondition;
  label: string;
  description: string;
  icon: typeof BadgeCheck;
}[] = [
  {
    value: "new",
    label: "New",
    description: "Unused, sealed",
    icon: BadgeCheck,
  },
  {
    value: "like_new",
    label: "Like New",
    description: "Excellent, minimal wear",
    icon: Sparkles,
  },
  {
    value: "good",
    label: "Good",
    description: "Normal wear",
    icon: ThumbsUp,
  },
  {
    value: "fair",
    label: "Fair",
    description: "Noticeable wear",
    icon: ThumbsDown,
  },
  {
    value: "poor",
    label: "Poor",
    description: "Heavy wear or damage",
    icon: AlertTriangle,
  },
];

export function ResearchOptionsPanel({
  condition,
  setCondition,
  onStart,
  imageCount,
  showStart = true,
  startLabel,
}: ResearchOptionsPanelProps) {
  return (
    <div className="space-y-6 p-6 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
      <div className="space-y-3">
        <label className="text-sm font-medium text-[var(--color-text)]">
          Item Condition
        </label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {conditionOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = condition === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setCondition(option.value)}
                className={cn(
                  "relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200",
                  isSelected
                    ? "bg-[var(--color-accent-muted)] border-[var(--color-accent)] text-[var(--color-accent)]"
                    : "bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-hover)]"
                )}
              >
                <Icon className="w-5 h-5" />
                <div className="text-center">
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="text-[10px] opacity-70">
                    {option.description}
                  </p>
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-[var(--color-text-subtle)]">
        Runs Gemini 2.5 Flash classification first, then Gemini + OpenAI
        research with reasoning mode for pricing and listing copy.
      </div>

      {showStart && (
        <button
          onClick={onStart}
          className={cn(
            "w-full py-4 px-6 rounded-xl font-semibold text-base transition-all duration-300",
            "bg-gradient-to-r from-[var(--color-accent)] to-cyan-500",
            "text-[var(--color-bg)] shadow-lg shadow-cyan-500/20",
            "hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-[1.01]",
            "active:scale-[0.99]"
          )}
        >
          {startLabel ??
            `Start Research ${imageCount} ${
              imageCount === 1 ? "Item" : "Items"
            }`}
        </button>
      )}
    </div>
  );
}

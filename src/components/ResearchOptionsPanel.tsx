import {
  AlertTriangle,
  BadgeCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { OptionSelector } from "@/components/shared/OptionSelector";
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
      <OptionSelector
        label="Item Condition"
        value={condition}
        onChange={setCondition}
        options={conditionOptions}
        columnsClassName="grid-cols-1 sm:grid-cols-2 xl:grid-cols-5"
      />

      <div className="text-sm text-[var(--color-text-subtle)]">
        Runs Gemini 2.5 Flash classification first, then Gemini + OpenAI
        research with reasoning mode for pricing and listing copy.
      </div>

      {showStart && (
        <button
          type="button"
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

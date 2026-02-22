import {
  BadgeCheck,
  Flame,
  Maximize,
  Maximize2,
  Monitor,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  WandSparkles,
  Zap,
} from "lucide-react";
import { OptionSelector } from "@/components/shared/OptionSelector";
import { cn } from "@/lib/utils";
import type {
  CleanlinessLevel,
  ItemCondition,
  ProcessingMode,
  TargetOutput,
} from "@/lib/workflowSchemas";

interface ConfigureStepProps {
  mode: ProcessingMode;
  cleanlinessLevel: CleanlinessLevel;
  targetOutput: TargetOutput;
  condition: ItemCondition;
  imageCount: number;
  isStarting: boolean;
  onModeChange: (value: ProcessingMode) => void;
  onCleanlinessChange: (value: CleanlinessLevel) => void;
  onTargetOutputChange: (value: TargetOutput) => void;
  onConditionChange: (value: ItemCondition) => void;
  onBack: () => void;
  onStart: () => void;
}

const workflowOptions: Array<{
  value: ProcessingMode;
  label: string;
  description: string;
}> = [
  {
    value: "listing",
    label: "Listing Workflow",
    description: "Clean photos and generate pricing + listing copy.",
  },
  {
    value: "clean",
    label: "Photo Cleaning",
    description: "Only clean your photos and download final images.",
  },
  {
    value: "research",
    label: "Product Research",
    description: "Only identify, price, and generate listing details.",
  },
];

const cleanlinessOptions = [
  { value: "light", label: "Light", description: "Surface dust only", icon: Sparkles },
  { value: "standard", label: "Standard", description: "Balanced cleaning", icon: Zap },
  { value: "deep", label: "Deep", description: "More aggressive cleanup", icon: Flame },
] as const;

const outputOptions = [
  { value: "match", label: "Match", description: "Keep original size", icon: Monitor },
  { value: "2k", label: "2K", description: "Around 2048px output", icon: Maximize },
  { value: "4k", label: "4K", description: "Around 3840px output", icon: Maximize2 },
] as const;

const conditionOptions = [
  { value: "new", label: "New", description: "Unused or sealed", icon: BadgeCheck },
  { value: "like_new", label: "Like New", description: "Minimal signs of wear", icon: Sparkles },
  { value: "good", label: "Good", description: "Normal wear", icon: ThumbsUp },
  { value: "fair", label: "Fair", description: "Noticeable wear", icon: ThumbsDown },
  { value: "poor", label: "Poor", description: "Heavy wear or damage", icon: WandSparkles },
] as const;

export function ConfigureStep({
  mode,
  cleanlinessLevel,
  targetOutput,
  condition,
  imageCount,
  isStarting,
  onModeChange,
  onCleanlinessChange,
  onTargetOutputChange,
  onConditionChange,
  onBack,
  onStart,
}: ConfigureStepProps) {
  const startLabelMap: Record<ProcessingMode, string> = {
    clean: "Start Cleaning",
    research: "Start Research",
    listing: "Start Listing Workflow",
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Workflow</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {workflowOptions.map((option) => {
            const isSelected = option.value === mode;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onModeChange(option.value)}
                className={cn(
                  "min-h-24 rounded-xl border p-4 text-left transition-all",
                  isSelected
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)]"
                    : "border-[var(--color-border)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-subtle)]"
                )}
              >
                <p className="text-sm font-semibold text-[var(--color-text)]">{option.label}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{option.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {(mode === "clean" || mode === "listing") && (
        <div className="grid gap-6 xl:grid-cols-2">
          <OptionSelector
            label="Cleanliness Level"
            value={cleanlinessLevel}
            onChange={onCleanlinessChange}
            options={[...cleanlinessOptions]}
          />
          <OptionSelector
            label="Output Resolution"
            value={targetOutput}
            onChange={onTargetOutputChange}
            options={[...outputOptions]}
          />
        </div>
      )}

      {(mode === "research" || mode === "listing") && (
        <OptionSelector
          label="Item Condition"
          value={condition}
          onChange={onConditionChange}
          options={[...conditionOptions]}
          columnsClassName="grid-cols-1 sm:grid-cols-2 xl:grid-cols-5"
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onStart}
          disabled={isStarting}
          className={cn(
            "min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-[var(--color-bg)]",
            "bg-gradient-to-r from-[var(--color-accent)] to-cyan-500",
            "disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          {isStarting
            ? "Starting..."
            : `${startLabelMap[mode]} ${imageCount} ${imageCount === 1 ? "item" : "items"}`}
        </button>
      </div>
    </div>
  );
}

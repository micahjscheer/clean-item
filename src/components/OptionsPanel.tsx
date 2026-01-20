import { Sparkles, Zap, Flame, Monitor, Maximize, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CleanlinessLevel, TargetOutput } from "@/routes/index";

interface OptionsPanelProps {
  cleanlinessLevel: CleanlinessLevel;
  setCleanlinessLevel: (level: CleanlinessLevel) => void;
  targetOutput: TargetOutput;
  setTargetOutput: (output: TargetOutput) => void;
  onStart: () => void;
  imageCount: number;
}

const cleanlinessOptions: {
  value: CleanlinessLevel;
  label: string;
  description: string;
  icon: typeof Sparkles;
}[] = [
  {
    value: "light",
    label: "Light",
    description: "Surface dust only",
    icon: Sparkles,
  },
  {
    value: "standard",
    label: "Standard",
    description: "Vacuum + wipe surfaces",
    icon: Zap,
  },
  {
    value: "deep",
    label: "Deep",
    description: "Seams + high-touch areas",
    icon: Flame,
  },
];

const outputOptions: {
  value: TargetOutput;
  label: string;
  description: string;
  icon: typeof Monitor;
}[] = [
  {
    value: "match",
    label: "Match",
    description: "Same as original",
    icon: Monitor,
  },
  {
    value: "2k",
    label: "2K",
    description: "~2048px",
    icon: Maximize,
  },
  {
    value: "4k",
    label: "4K",
    description: "~3840px",
    icon: Maximize2,
  },
];

export function OptionsPanel({
  cleanlinessLevel,
  setCleanlinessLevel,
  targetOutput,
  setTargetOutput,
  onStart,
  imageCount,
}: OptionsPanelProps) {
  return (
    <div className="space-y-6 p-6 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Cleanliness Level */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-[var(--color-text)]">
            Cleanliness Level
          </label>
          <div className="grid grid-cols-3 gap-2">
            {cleanlinessOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = cleanlinessLevel === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setCleanlinessLevel(option.value)}
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
                    <p className="text-[10px] opacity-70">{option.description}</p>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Output Resolution */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-[var(--color-text)]">
            Output Resolution
          </label>
          <div className="grid grid-cols-3 gap-2">
            {outputOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = targetOutput === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setTargetOutput(option.value)}
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
                    <p className="text-[10px] opacity-70">{option.description}</p>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

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
        Start Cleaning {imageCount} {imageCount === 1 ? "Photo" : "Photos"}
      </button>
    </div>
  );
}

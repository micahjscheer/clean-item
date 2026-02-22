import { Flame, Maximize, Maximize2, Monitor, Sparkles, Zap } from "lucide-react";
import { OptionSelector } from "@/components/shared/OptionSelector";
import { cn } from "@/lib/utils";
import type {
  CleanlinessLevel,
  TargetOutput,
} from "@/lib/workflowSchemas";

interface OptionsPanelProps {
  cleanlinessLevel: CleanlinessLevel;
  setCleanlinessLevel: (level: CleanlinessLevel) => void;
  targetOutput: TargetOutput;
  setTargetOutput: (output: TargetOutput) => void;
  onStart: () => void;
  imageCount: number;
  showStart?: boolean;
  startLabel?: string;
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
  showStart = true,
  startLabel,
}: OptionsPanelProps) {
  return (
    <div className="space-y-6 p-6 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
      <div className="grid gap-6 md:grid-cols-2">
        <OptionSelector
          label="Cleanliness Level"
          value={cleanlinessLevel}
          onChange={setCleanlinessLevel}
          options={cleanlinessOptions}
        />
        <OptionSelector
          label="Output Resolution"
          value={targetOutput}
          onChange={setTargetOutput}
          options={outputOptions}
        />
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
            `Start Cleaning ${imageCount} ${
              imageCount === 1 ? "Photo" : "Photos"
            }`}
        </button>
      )}
    </div>
  );
}

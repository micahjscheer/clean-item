import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type WizardStep = "upload" | "configure" | "processing" | "results";

interface StepDefinition {
  key: WizardStep;
  label: string;
}

const stepDefinitions: StepDefinition[] = [
  { key: "upload", label: "Upload" },
  { key: "configure", label: "Configure" },
  { key: "processing", label: "Processing" },
  { key: "results", label: "Results" },
];

interface WizardShellProps {
  currentStep: WizardStep;
  title: string;
  description: string;
  children: ReactNode;
}

export function WizardShell({
  currentStep,
  title,
  description,
  children,
}: WizardShellProps) {
  const currentStepIndex = stepDefinitions.findIndex((step) => step.key === currentStep);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
          <p className="max-w-2xl text-sm text-[var(--color-text-muted)] sm:text-base">
            {description}
          </p>
        </div>
        <ol className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2 sm:grid-cols-4">
          {stepDefinitions.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;
            return (
              <li
                key={step.key}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition-all",
                  isActive
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-text)]"
                    : isCompleted
                    ? "border-[var(--color-success)]/40 bg-[var(--color-success)]/10 text-[var(--color-text)]"
                    : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)]"
                )}
              >
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-subtle)]">
                  Step {index + 1}
                </p>
                <p className="font-semibold">{step.label}</p>
              </li>
            );
          })}
        </ol>
      </header>
      <section>{children}</section>
    </div>
  );
}

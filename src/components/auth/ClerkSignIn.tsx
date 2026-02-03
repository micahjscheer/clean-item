import { SignIn } from "@clerk/clerk-react";

const signInAppearance = {
  elements: {
    card: "bg-[var(--color-bg-elevated)] border border-[var(--color-border)] shadow-xl",
    headerTitle: "text-[var(--color-text)]",
    headerSubtitle: "text-[var(--color-text-muted)]",
    socialButtonsBlockButton:
      "border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]",
    formButtonPrimary:
      "bg-gradient-to-r from-[var(--color-accent)] to-cyan-500 text-[var(--color-bg)]",
    footerActionText: "text-[var(--color-text-muted)]",
    footerActionLink:
      "text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]",
    formFieldInput:
      "bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]",
  },
};

export function ClerkSignIn() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <SignIn appearance={signInAppearance} routing="hash" />
    </div>
  );
}

import { Outlet } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { SignedIn } from "@clerk/clerk-react";
import { ClerkUserButton } from "@/components/auth/ClerkUserButton";

export function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg)]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-cyan-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-lg tracking-tight">Create Listing</h1>
              <p className="text-xs text-[var(--color-text-muted)] -mt-0.5">Post-Detail Photo Cleaner</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-[var(--color-text-subtle)]">
            <span className="px-2 py-1 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
              AI Listing Assistant
            </span>
            <SignedIn>
              <ClerkUserButton />
            </SignedIn>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-[var(--color-border-subtle)] py-4">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-[var(--color-text-subtle)]">
          Upload photos → Clean, research, and list → Price with confidence
        </div>
      </footer>
    </div>
  );
}

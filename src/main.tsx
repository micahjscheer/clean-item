import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { ClerkProvider, SignedIn, SignedOut, useAuth } from "@clerk/clerk-react";
import { routeTree } from "./routeTree.gen";
import "./index.css";
import { ClerkSignIn } from "@/components/auth/ClerkSignIn";
import { z } from "zod";

const envSchema = z
  .object({
    VITE_CONVEX_URL: z.string().min(1).optional(),
    VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  })
  .passthrough();
const env = envSchema.parse(import.meta.env);
const convexUrl = env.VITE_CONVEX_URL;
const clerkPublishableKey = env.VITE_CLERK_PUBLISHABLE_KEY;
const queryClient = new QueryClient();
const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function SetupMessage({ missing }: { missing: string[] }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6 animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-cyan-600 flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold mb-2">Setup Required</h1>
          <p className="text-[var(--color-text-muted)]">
            Configure the missing environment variables to continue.
          </p>
        </div>

        {missing.includes("VITE_CONVEX_URL") && (
          <div className="space-y-3 text-left">
            <p className="text-sm text-[var(--color-text)] font-medium">
              Convex backend is not configured.
            </p>
            <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
              <code className="text-sm font-mono text-[var(--color-accent)]">
                bunx convex dev
              </code>
            </div>
            <p className="text-xs text-[var(--color-text-subtle)]">
              This will create a Convex project and add{" "}
              <code className="text-[var(--color-accent)]">VITE_CONVEX_URL</code>{" "}
              to <code className="text-[var(--color-accent)]">.env.local</code>.
            </p>
          </div>
        )}

        {missing.includes("VITE_CLERK_PUBLISHABLE_KEY") && (
          <div className="space-y-3 text-left">
            <p className="text-sm text-[var(--color-text)] font-medium">
              Clerk publishable key is missing.
            </p>
            <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
              <code className="text-sm font-mono text-[var(--color-accent)]">
                VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
              </code>
            </div>
            <p className="text-xs text-[var(--color-text-subtle)]">
              Add the key to{" "}
              <code className="text-[var(--color-accent)]">.env.local</code>{" "}
              from your Clerk dashboard.
            </p>
          </div>
        )}
        <div className="pt-4 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-subtle)]">
            After updating environment variables, refresh this page.
          </p>
        </div>
      </div>
    </div>
  );
}

function App() {
  const missing: string[] = [];
  if (!convexUrl) missing.push("VITE_CONVEX_URL");
  if (!clerkPublishableKey) missing.push("VITE_CLERK_PUBLISHABLE_KEY");

  if (missing.length > 0) {
    return <SetupMessage missing={missing} />;
  }

  const convex = new ConvexReactClient(convexUrl);

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      appearance={{
        variables: {
          colorPrimary: "#22d3ee",
          colorBackground: "#0a0f14",
          colorText: "#e8f4f8",
          colorInputBackground: "#111921",
          colorInputText: "#e8f4f8",
          colorTextSecondary: "#7b9dad",
        },
      }}
    >
      <SignedIn>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </ConvexProviderWithClerk>
      </SignedIn>
      <SignedOut>
        <ClerkSignIn />
      </SignedOut>
    </ClerkProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

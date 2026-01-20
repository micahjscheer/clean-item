import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "./index.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
const queryClient = new QueryClient();
const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function SetupMessage() {
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
            Convex backend is not configured. Run the following command to set it up:
          </p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-left">
          <code className="text-sm font-mono text-[var(--color-accent)]">
            bunx convex dev
          </code>
        </div>
        <div className="text-sm text-[var(--color-text-subtle)] space-y-2">
          <p>This will:</p>
          <ul className="text-left list-disc list-inside space-y-1">
            <li>Create a Convex account (if needed)</li>
            <li>Set up a new Convex project</li>
            <li>Generate <code className="text-[var(--color-accent)]">.env.local</code> with your deployment URL</li>
          </ul>
        </div>
        <div className="pt-4 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-subtle)]">
            After running Convex, refresh this page.
          </p>
        </div>
      </div>
    </div>
  );
}

function App() {
  if (!convexUrl) {
    return <SetupMessage />;
  }

  const convex = new ConvexReactClient(convexUrl);

  return (
    <ConvexProvider client={convex}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ConvexProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

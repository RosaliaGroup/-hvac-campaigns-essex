// SSR entry point used only by scripts/prerender.ts (loaded via Vite's
// `ssrLoadModule`, never bundled into the client build). Kept separate from
// main.tsx because the browser entry mounts to the DOM; this one just
// renders a string for a given route.
import React from "react";
import { renderToString } from "react-dom/server";
import { Router } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import App from "@/App";

export function render(routePath: string): string {
  // Fresh QueryClient + tRPC client per call: renderToString is synchronous
  // and never awaits an effect, so nothing in this tree actually fetches
  // during prerender — any data-driven widget just renders its initial
  // ("loading") state here and populates for real once the client hydrates.
  const queryClient = new QueryClient();
  const trpcClient = trpc.createClient({
    links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
  });

  return renderToString(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Router ssrPath={routePath}>
          <App />
        </Router>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

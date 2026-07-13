// Build trigger: 20260331
import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { describeProxyFailure } from "@/lib/proxyResponse";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async fetch(input, init) {
        const res = await globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
        // Guard against non-JSON / empty-body proxy failures (e.g. Netlify's
        // ~10 MB /api request cap returns an empty 400; gateways return HTML
        // 5xx). Reading the body once and re-wrapping lets tRPC parse normal
        // JSON while we surface a clear message for the rest — without logging
        // any request content (prompts, images, documents, keys).
        const bodyText = await res.text();
        const message = describeProxyFailure(
          res.status,
          res.headers.get("content-type"),
          bodyText,
        );
        if (message) throw new Error(message);
        // Re-wrap with only content-type: the original headers may advertise a
        // content-encoding/length for a body fetch already decoded, which would
        // mislead a second consumer. tRPC only needs the type and the body.
        return new Response(bodyText, {
          status: res.status,
          statusText: res.statusText,
          headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

import { useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { InlineSpinner, ErrorState } from "../components/common";
import { Button } from "@/components/ui/button";

/** Consumes a magic-link token (?token=…) and starts a portal session. */
export default function PortalVerify() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const utils = trpc.useUtils();
  const token = new URLSearchParams(search).get("token") ?? "";
  const attempted = useRef(false);

  const verify = trpc.portal.auth.verifyMagicLink.useMutation({
    onSuccess: async () => {
      await utils.portal.auth.me.invalidate();
      setLocation("/portal");
    },
  });

  useEffect(() => {
    if (token && !attempted.current) {
      attempted.current = true;
      verify.mutate({ token });
    }
  }, [token, verify]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm text-center">
        {!token ? (
          <ErrorState
            title="Invalid link"
            message="This sign-in link is missing its token. Please request a new one."
          />
        ) : verify.isError ? (
          <ErrorState title="Link expired" message={verify.error?.message} />
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <InlineSpinner className="h-6 w-6" />
            <p className="text-sm">Signing you in…</p>
          </div>
        )}
        {(!token || verify.isError) && (
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/portal/login")}>
            Back to sign in
          </Button>
        )}
      </div>
    </div>
  );
}

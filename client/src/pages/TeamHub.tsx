import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

/** The Team Hub (tasks, clock, reports, scorecard, videos) inside the CRM. */
export default function TeamHub() {
  const link = trpc.teamHub.link.useQuery(undefined, { staleTime: 10 * 60_000, refetchOnWindowFocus: false, retry: 1 });
  if (link.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Opening your Team Hub…
      </div>
    );
  }
  if (link.error) return <p className="p-6 text-sm text-red-700">{link.error.message}</p>;
  if (!link.data?.url) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {link.data?.reason === "not_on_team"
          ? "Your login isn't on the Team Hub yet. Ask the team to add you."
          : "The Team Hub isn't connected yet."}
      </p>
    );
  }
  return (
    <iframe
      title="Team Hub"
      src={link.data.url}
      className="w-full rounded-xl border bg-white"
      style={{ height: "calc(100dvh - 140px)", minHeight: 520 }}
    />
  );
}

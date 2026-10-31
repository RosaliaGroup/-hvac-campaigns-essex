import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export type FollowProfile = { platform: string; url: string; kind: "person" | "company"; followed: boolean };

/** One click opens the profile, one click records the follow. The task closes itself when all are followed. */
export default function FollowLinks({ contactId, taskId, profiles, onChanged }: {
  contactId: number; taskId: number; profiles: FollowProfile[]; onChanged: () => void;
}) {
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const follow = trpc.crmContactEnrichment.confirmFollow.useMutation({
    onSuccess: () => { setError(""); onChanged(); }, onError: e => setError(e.message),
  });
  const close = trpc.crmFollowups.closeFollowTask.useMutation({
    onSuccess: () => { setError(""); onChanged(); }, onError: e => setError(e.message),
  });
  if (!profiles.length) return <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
    <span>Research is still looking for this contact's profiles.</span>
    <Button size="sm" variant="ghost" disabled={close.isPending} onClick={() => close.mutate({ id: taskId })}>Nothing to follow</Button>
    {error && <span className="text-red-700" role="alert">{error}</span>}
  </div>;
  return <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
    {profiles.map(p => p.followed
      ? <span key={p.url} className="rounded border px-2 py-1 text-green-700">{p.platform}{p.kind === "company" ? " (company)" : ""} · Followed</span>
      : <span key={p.url} className="flex items-center gap-1 rounded border px-2 py-1">
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-700 hover:underline"
            onClick={() => setOpened(o => ({ ...o, [p.url]: true }))}>
            Follow on {p.platform}{p.kind === "company" ? " (company)" : ""} <ExternalLink size={12} />
          </a>
          {opened[p.url] && <Button size="sm" variant="outline" className="h-6 px-2" disabled={follow.isPending}
            onClick={() => follow.mutate({ contactId, url: p.url, followed: true })}>Done</Button>}
        </span>)}
    <Button size="sm" variant="ghost" className="h-6 px-2" disabled={close.isPending} onClick={() => close.mutate({ id: taskId })}>Skip</Button>
    {error && <span className="text-red-700" role="alert">{error}</span>}
  </div>;
}


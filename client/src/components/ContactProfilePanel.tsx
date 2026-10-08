import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Building2, ExternalLink, RefreshCw, Users } from "lucide-react";
import type { ContactProfile, ProfileFact } from "@shared/contactProfile";
function Fact({ label, fact }: { label: string; fact?: ProfileFact }) {
  if (!fact) return null;
  return (
    <div className="space-y-1">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-[#33475b] break-words">{fact.value}</dd>
      <a
        className="text-xs text-[#007a8c] inline-flex items-center gap-1"
        href={fact.source}
        target="_blank"
        rel="noopener noreferrer"
        title={fact.evidence}
      >
        Source <ExternalLink size={11} />
      </a>
    </div>
  );
}
export default function ContactProfilePanel({
  contactId,
  customerId,
  companyName,
}: {
  contactId?: number;
  customerId?: number;
  companyName?: string | null;
}) {
  const input = contactId ? { contactId } : { customerId: customerId! };
  const key = JSON.stringify(input),
    requested = useRef("");
  const [jobId, setJobId] = useState<string | null>(null),
    [error, setError] = useState("");
  const profile = trpc.crmCommunications.profile.useQuery(input, {
    retry: false,
  });
  const start = trpc.crmCommunications.enrichProfile.useMutation({
    onSuccess: r => setJobId(r.jobId),
    onError: e => setError(e.message),
  });
  const job = trpc.crmCommunications.profileJob.useQuery(
    { jobId: jobId ?? "" },
    { enabled: Boolean(jobId), refetchInterval: jobId ? 2000 : false }
  );
  useEffect(() => {
    setJobId(null);
    setError("");
  }, [key]);
  useEffect(() => {
    if (profile.isSuccess && !profile.data && requested.current !== key) {
      requested.current = key;
      start.mutate(input);
    }
  }, [key, profile.isSuccess, profile.data]);
  useEffect(() => {
    if (job.data?.status === "done") {
      setJobId(null);
      void profile.refetch();
    } else if (job.data?.status === "error") {
      setError(job.data.error || "Profile lookup failed");
      setJobId(null);
    } else if (job.isSuccess && jobId && !job.data) {
      setError("Lookup interrupted. Try again.");
      setJobId(null);
    }
  }, [job.data, job.isSuccess, jobId]);
  const data = profile.data as ContactProfile | null | undefined;
  const busy = Boolean(jobId) || start.isPending || profile.isLoading;
  return (
    <aside
      className="space-y-4 text-[#33475b]"
      aria-label="Company and social profiles"
    >
      <section className="rounded-md border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Building2 size={16} />
            Company
          </h2>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Refresh company and social profiles"
            disabled={busy}
            onClick={() => {
              setError("");
              start.mutate(input);
            }}
          >
            <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
          </Button>
        </div>
        <div className="p-4 space-y-3">
          {busy && (
            <p className="text-xs text-slate-500">
              Finding company and person profiles…
            </p>
          )}
          {(error || profile.error) && (
            <p role="alert" className="text-xs text-red-600">
              {error || profile.error?.message}
            </p>
          )}
          {!data?.company.name && companyName && (
            <div>
              <p className="text-xs text-slate-500">Company name</p>
              <p className="text-sm">{companyName}</p>
              <p className="text-xs text-slate-400">CRM contact information</p>
            </div>
          )}
          <dl className="space-y-3">
            <Fact label="Company name" fact={data?.company.name} />
            <Fact label="Website" fact={data?.company.website} />
            <Fact label="Industry" fact={data?.company.industry} />
            <Fact label="Location" fact={data?.company.location} />
            <Fact label="About" fact={data?.company.description} />
          </dl>
          {!busy && !Object.keys(data?.company ?? {}).length && (
            <p className="text-sm text-slate-500">
              {data?.status === "unavailable"
                ? data.message
                : "No confirmed company match."}
            </p>
          )}
        </div>
      </section>
      <section className="rounded-md border bg-white">
        <h2 className="font-semibold px-4 py-3 border-b flex items-center gap-2">
          <Users size={16} />
          Person’s social profiles
        </h2>
        <div className="p-4 space-y-3">
          {data?.social.map(s => (
            <div key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#007a8c] flex items-center gap-2"
              >
                {s.platform}
                <ExternalLink size={13} />
              </a>
              <a
                href={s.source}
                target="_blank"
                rel="noopener noreferrer"
                title={s.evidence}
                className="text-xs text-slate-500"
              >
                Match source
              </a>
            </div>
          ))}
          {!data?.social.length && (
            <p className="text-sm text-slate-500">
              {busy
                ? "Checking public profiles…"
                : "No confirmed person profiles found."}
            </p>
          )}
        </div>
      </section>
      {data && (
        <p className="text-xs text-slate-400 px-1">
          Checked {new Date(data.checkedAt).toLocaleDateString()}. Public
          matches are sourced; unmatched fields stay empty.
        </p>
      )}
    </aside>
  );
}

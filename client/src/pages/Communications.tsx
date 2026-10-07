import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";

type SyncResult = {
  imported: number;
  duplicates: number;
  skipped: number;
  nextPageToken?: string;
};
export default function Communications() {
  const [search, setSearch] = useState("");
  const [contactId, setContactId] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [pageToken, setPageToken] = useState<string | undefined>();
  const [notice, setNotice] = useState("");
  const contacts = trpc.crmCommunications.contacts.useQuery({ search });
  const status = trpc.crmCommunications.gmailStatus.useQuery();
  const timeline = trpc.crmCommunications.timeline.useQuery(
    { externalContactId: contactId ?? 0 },
    { enabled: contactId !== null }
  );
  const sync = trpc.crmCommunications.syncGmail.useMutation({
    onSuccess: data => {
      setJobId(data.jobId);
      setNotice("Reading Gmail…");
    },
    onError: error => setNotice(error.message),
  });
  const job = trpc.crmCommunications.gmailSyncJob.useQuery(
    { jobId: jobId ?? "" },
    { enabled: Boolean(jobId), refetchInterval: jobId ? 1500 : false }
  );
  useEffect(() => {
    if (!jobId || job.isFetching) return;
    if (job.error) {
      setNotice(job.error.message);
      setJobId(null);
      return;
    }
    if (job.data === null) {
      setNotice("Sync status was lost after a server restart. Retry safely.");
      setJobId(null);
    }
    if (job.data?.status === "done") {
      const result = job.data.result as SyncResult | null;
      if (!result) {
        setNotice("Connect the Gmail account before syncing.");
        setJobId(null);
        return;
      }
      setPageToken(result.nextPageToken);
      setNotice(
        `${result.imported} emails added; ${result.duplicates} already recorded; ${result.skipped} skipped.`
      );
      setJobId(null);
      void contacts.refetch();
      if (contactId !== null) void timeline.refetch();
    } else if (job.data?.status === "error") {
      setNotice(job.data.error ?? "Sync failed. Retry safely.");
      setJobId(null);
    }
  }, [job.data, jobId, job.isFetching, job.error]);
  const ready =
    status.data?.connected &&
    status.data.hasReadPermission &&
    status.data.accountEmail?.toLowerCase() === status.data.mailbox;
  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-bold">Communications</h1>
      <p className="text-muted-foreground">
        Email and SMS history for CRM leads and clients. Gmail refreshes every five
        minutes once connected.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={!ready || Boolean(jobId) || sync.isPending}
          onClick={() => sync.mutate({ pageToken })}
        >
          {pageToken ? "Sync next email page" : "Sync Gmail · last 30 days"}
        </Button>
        <Link href="/settings/integrations">Google connection settings</Link>
        {!ready && (
          <p className="text-sm">
            Connect sales@mechanicalenterprise.com and grant Gmail read
            permission.
          </p>
        )}
      </div>
      {notice && <p role="status">{notice}</p>}
      {(contacts.error || timeline.error || job.error || status.error) && (
        <p role="alert" className="text-red-600">
          {contacts.error?.message ??
            timeline.error?.message ??
            job.error?.message ??
            status.error?.message}
        </p>
      )}
      <div className="grid md:grid-cols-[300px_1fr] gap-5">
        <section className="space-y-3">
          <Input
            aria-label="Search contacts"
            placeholder="Search name, email or phone"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {contacts.isLoading && <p>Loading contacts…</p>}
          {contacts.data?.length === 0 && (
            <p>No matching leads or clients with communications yet. Add the person to CRM Leads or Contacts, then sync their email history.</p>
          )}
          {contacts.data?.map(contact => (
            <button
              key={contact.id}
              onClick={() => setContactId(contact.id)}
              className={`block w-full text-left rounded border p-3 ${contactId === contact.id ? "bg-muted" : ""}`}
            >
              <strong className="block break-words">{contact.name}</strong>
              {contact.company && <p className="text-sm break-words">{contact.company}</p>}
              <p className="text-sm break-all">
                {contact.email ?? contact.phone}
              </p>
            </button>
          ))}
        </section>
        <section className="space-y-3">
          {contactId === null ? (
            <p>Select a contact to see their history.</p>
          ) : timeline.isLoading ? (
            <p>Loading history…</p>
          ) : timeline.data?.length === 0 ? (
            <p>No communications recorded yet.</p>
          ) : (
            timeline.data?.map(message => (
              <article
                key={message.id}
                className="border rounded p-4 space-y-2"
              >
                <p className="text-sm text-muted-foreground">
                  {message.channel.toUpperCase()} · {message.direction} ·{" "}
                  {new Date(message.occurredAt).toLocaleString()} ·{" "}
                  {message.status}
                </p>
                {message.subject && (
                  <h2 className="font-semibold">{message.subject}</h2>
                )}
                <p className="text-sm break-all">
                  {message.fromAddress} → {message.toAddress}
                </p>
                <p className="whitespace-pre-wrap break-words">
                  {message.body ?? "No plain-text body available."}
                </p>
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

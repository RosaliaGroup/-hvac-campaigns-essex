import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import {
  ArrowLeft,
  Inbox,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Users,
} from "lucide-react";

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
  const [folder, setFolder] = useState<"all" | "inbox" | "sent" | "sms">("all");
  const [messageId, setMessageId] = useState<number | null>(null);
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
  const selectedContact = contacts.data?.find(
    contact => contact.id === contactId
  );
  const messages =
    timeline.data?.filter(
      message =>
        folder === "all" ||
        (folder === "sms"
          ? message.channel === "sms"
          : message.channel === "email" &&
            message.direction === (folder === "inbox" ? "inbound" : "outbound"))
    ) ?? [];
  const selectedMessage = messages.find(message => message.id === messageId);
  const folders = [
    { id: "all" as const, label: "All communications", icon: Mail },
    { id: "inbox" as const, label: "Inbox", icon: Inbox },
    { id: "sent" as const, label: "Sent", icon: Send },
    { id: "sms" as const, label: "SMS", icon: MessageSquare },
  ];
  return (
    <div className="min-h-[75vh] bg-[#f6f8fc] text-slate-800 rounded-2xl p-3 md:p-5 space-y-4">
      <header className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 md:w-56">
          <Mail className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold">Communications</h1>
        </div>
        <div className="relative flex-1 min-w-[220px] max-w-2xl">
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-500" />
          <Input
            className="h-12 pl-12 rounded-full border-0 bg-[#eaf1fb] text-slate-800"
            aria-label="Search leads and clients"
            placeholder="Search leads and clients"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setContactId(null);
              setMessageId(null);
            }}
          />
        </div>
        <span className="text-xs text-slate-500">
          sales@mechanicalenterprise.com
        </span>
      </header>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full bg-white text-slate-800"
          disabled={!ready || Boolean(jobId) || sync.isPending}
          onClick={() => sync.mutate({ pageToken })}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${jobId ? "animate-spin" : ""}`}
          />
          {pageToken ? "Sync next email page" : "Sync Gmail · last 30 days"}
        </Button>
        <Link
          className="text-blue-700 hover:underline"
          href="/settings/integrations"
        >
          Connection settings
        </Link>
        <span className="text-xs text-slate-500">
          Leads and clients only · refreshes every 5 minutes
        </span>
        {!ready && (
          <p className="text-sm">
            Connect sales@mechanicalenterprise.com and grant Gmail read
            permission.
          </p>
        )}
      </div>
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-900"
        >
          {notice}
        </p>
      )}
      {(contacts.error || timeline.error || job.error || status.error) && (
        <p role="alert" className="text-red-600">
          {contacts.error?.message ??
            timeline.error?.message ??
            job.error?.message ??
            status.error?.message}
        </p>
      )}
      <div className="grid md:grid-cols-[240px_minmax(0,1fr)] gap-4">
        <aside className="min-w-0">
          <nav aria-label="Communication folders" className="space-y-1 mb-6">
            {folders.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setFolder(item.id);
                  setMessageId(null);
                }}
                aria-current={folder === item.id ? "page" : undefined}
                className={`flex items-center gap-3 w-full rounded-full px-4 py-2 text-sm text-left ${folder === item.id ? "bg-[#d3e3fd] font-semibold text-blue-950" : "hover:bg-slate-200"}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
          <h2 className="flex items-center gap-2 px-4 mb-2 text-xs uppercase tracking-wide text-slate-500">
            <Users className="h-4 w-4" />
            Leads & clients
          </h2>
          <section className="max-h-[55vh] overflow-y-auto space-y-1">
            {contacts.isLoading && <p>Loading contacts…</p>}
            {contacts.data?.length === 0 && (
              <p>
                No matching leads or clients with communications yet. Add the
                person to CRM Leads or Contacts, then sync their email history.
              </p>
            )}
            {contacts.data?.map(contact => (
              <button
                key={contact.id}
                onClick={() => {
                  setContactId(contact.id);
                  setMessageId(null);
                }}
                aria-pressed={contactId === contact.id}
                className={`block w-full text-left rounded-xl px-4 py-3 ${contactId === contact.id ? "bg-[#d3e3fd]" : "hover:bg-slate-200"}`}
              >
                <strong className="block break-words">{contact.name}</strong>
                {contact.company && (
                  <p className="text-sm break-words">{contact.company}</p>
                )}
                <p className="text-sm break-all">
                  {contact.email ?? contact.phone}
                </p>
              </button>
            ))}
          </section>
        </aside>
        <section className="min-w-0 rounded-2xl bg-white overflow-hidden border border-slate-100 min-h-[60vh]">
          <div className="flex items-center gap-3 border-b px-5 py-4">
            {selectedMessage && (
              <button
                aria-label="Back to message list"
                onClick={() => setMessageId(null)}
                className="p-2 rounded-full hover:bg-slate-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="font-semibold truncate">
                {selectedContact?.name ?? "Leads & clients"}
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {selectedContact?.email ??
                  selectedContact?.phone ??
                  "Select a contact to view communications"}
              </p>
            </div>
            {contactId !== null && (
              <span className="ml-auto text-xs text-slate-500 whitespace-nowrap">
                {messages.length} messages
              </span>
            )}
          </div>
          {contactId === null ? (
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center text-slate-500">
              <Inbox className="h-10 w-10 mb-4 text-blue-300" />
              <p>Select a lead or client to open their messages.</p>
            </div>
          ) : timeline.isLoading ? (
            <p className="p-6 text-slate-500">Loading messages…</p>
          ) : selectedMessage ? (
            <article className="p-6 md:p-8 space-y-6">
              <h2 className="text-2xl font-normal break-words">
                {selectedMessage.subject ??
                  (selectedMessage.channel === "sms"
                    ? "Text message"
                    : "No subject")}
              </h2>
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-800 font-semibold">
                  {(selectedMessage.fromAddress ?? selectedContact?.name ?? "?")
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold break-all">
                    {selectedMessage.fromAddress}
                  </p>
                  <p className="text-xs text-slate-500 break-all">
                    to {selectedMessage.toAddress}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  {new Date(selectedMessage.occurredAt).toLocaleString()}
                </p>
              </div>
              <p className="text-xs text-slate-500">
                {selectedMessage.channel.toUpperCase()} ·{" "}
                {selectedMessage.direction} · {selectedMessage.status}
              </p>
              <div className="whitespace-pre-wrap break-words text-sm leading-7">
                {selectedMessage.body ??
                  "This email has no plain-text body available."}
              </div>
            </article>
          ) : messages.length === 0 ? (
            <p className="p-8 text-slate-500 text-sm">
              No messages in this folder for this contact.
            </p>
          ) : (
            messages.map(message => (
              <button
                key={message.id}
                onClick={() => setMessageId(message.id)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[160px_minmax(0,1fr)_90px] items-center gap-x-4 gap-y-1 border-b border-slate-100 px-5 py-3 text-left hover:bg-[#f2f6fc] focus-visible:outline-blue-500"
              >
                <span className="truncate text-sm font-medium">
                  {message.direction === "outbound"
                    ? "Me"
                    : (selectedContact?.name ?? message.fromAddress)}
                </span>
                <span className="min-w-0 truncate text-sm row-start-2 lg:row-start-auto">
                  <span className="mr-2 text-[10px] rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
                    {message.channel === "sms"
                      ? "SMS"
                      : message.direction === "outbound"
                        ? "Sent"
                        : "Inbox"}
                  </span>
                  <span className="font-medium">
                    {message.subject ?? "No subject"}
                  </span>
                  <span className="text-slate-500">
                    {" "}
                    —{" "}
                    {message.body?.replace(/\s+/g, " ") ??
                      "No preview available"}
                  </span>
                </span>
                <time className="text-xs text-slate-500 text-right col-start-2 row-start-1 lg:col-start-3">
                  {new Date(message.occurredAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </button>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
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
  const customerId = Number(
    new URLSearchParams(window.location.search).get("customerId")
  );
  const linkedContact = trpc.crmCommunications.contactForCustomer.useQuery(
    { customerId },
    { enabled: customerId > 0 }
  );
  const [search, setSearch] = useState("");
  const [contactId, setContactId] = useState<number | null>(null);
  useEffect(() => {
    if (linkedContact.data) setContactId(linkedContact.data.id);
  }, [linkedContact.data?.id]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [pageToken, setPageToken] = useState<string | undefined>();
  const handledSyncJob = useRef<string | null>(null);
  const syncTotals = useRef({ imported: 0, duplicates: 0, skipped: 0 });
  const [notice, setNotice] = useState("");
  const [folder, setFolder] = useState<"all" | "inbox" | "sent" | "sms">("all");
  const [messageId, setMessageId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [compose, setCompose] = useState<"email" | "sms" | null>(null);
  const [sendJobId, setSendJobId] = useState<string | null>(null);
  const [cardName, setCardName] = useState("");
  const [cardPhone, setCardPhone] = useState("");
  const card = trpc.crmCommunications.contactCard.useQuery(
    { id: contactId ?? 0 },
    { enabled: contactId !== null }
  );
  useEffect(() => {
    setCardName(card.data?.name ?? "");
    setCardPhone(card.data?.phone ?? "");
  }, [card.data]);
  useEffect(() => {
    setCompose(null);
    setDraft("");
  }, [contactId, messageId]);
  const saveCard = trpc.crmCommunications.saveContactCard.useMutation({
    onSuccess: () => {
      void card.refetch();
      void contacts.refetch();
      setNotice("Contact saved.");
    },
    onError: error => setNotice(error.message),
  });
  const sendOptions = {
    retry: false as const,
    onSuccess: (data: { jobId: string }) => {
      setSendJobId(data.jobId);
      setNotice("Sending…");
    },
    onError: (error: { message: string }) => setNotice(error.message),
  };
  const reply = trpc.crmCommunications.replyEmail.useMutation(sendOptions);
  const text = trpc.crmCommunications.sendText.useMutation(sendOptions);
  const sending = Boolean(sendJobId) || reply.isPending || text.isPending;
  const sendJob = trpc.crmCommunications.sendJob.useQuery(
    { jobId: sendJobId ?? "" },
    { enabled: Boolean(sendJobId), refetchInterval: sendJobId ? 1500 : false }
  );
  useEffect(() => {
    if (!sendJobId || sendJob.isFetching) return;
    if (sendJob.data?.status === "done") {
      const result = sendJob.data.result as { warning?: string };
      setNotice(result?.warning ?? "Message sent.");
      setSendJobId(null);
      setDraft("");
      setCompose(null);
      void timeline.refetch();
      void contacts.refetch();
    } else if (sendJob.data?.status === "error") {
      setNotice(sendJob.data.error ?? "Send failed.");
      setSendJobId(null);
    } else if (sendJob.data === null || sendJob.error) {
      setNotice(
        "Send status is unavailable. Check Gmail Sent or SMS history before trying again."
      );
      setSendJobId(null);
    }
  }, [sendJob.data, sendJob.error, sendJob.isFetching, sendJobId]);
  const contacts = trpc.crmCommunications.contacts.useQuery(
    { search },
    { refetchInterval: 30000 }
  );
  const status = trpc.crmCommunications.gmailStatus.useQuery();
  const timeline = trpc.crmCommunications.timeline.useQuery(
    { externalContactId: contactId ?? 0 },
    { enabled: contactId !== null, refetchInterval: 30000 }
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
      if (handledSyncJob.current === jobId) return;
      handledSyncJob.current = jobId;
      const result = job.data.result as SyncResult | null;
      if (!result) {
        setNotice("Connect the Gmail account before syncing.");
        setJobId(null);
        return;
      }
      setPageToken(result.nextPageToken);
      syncTotals.current.imported += result.imported;
      syncTotals.current.duplicates += result.duplicates;
      syncTotals.current.skipped += result.skipped;
      setNotice(
        `${syncTotals.current.imported} emails added; ${syncTotals.current.duplicates} already recorded; ${syncTotals.current.skipped} skipped.${result.nextPageToken ? " Reading the next page… Keep this page open." : " Sync complete."}`
      );
      setJobId(null);
      void contacts.refetch();
      if (contactId !== null) void timeline.refetch();
      if (result.nextPageToken)
        sync.mutate({ pageToken: result.nextPageToken });
    } else if (job.data?.status === "error") {
      setNotice(job.data.error ?? "Sync failed. Retry safely.");
      setJobId(null);
    }
  }, [job.data, jobId, job.isFetching, job.error]);
  const ready =
    status.data?.connected &&
    status.data.hasReadPermission &&
    status.data.accountEmail?.toLowerCase() === status.data.mailbox;
  const selectedContact =
    card.data ?? contacts.data?.find(contact => contact.id === contactId);
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
            aria-label="Search contacts, companies or email"
            placeholder="Search contacts, companies or email"
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
          onClick={() => {
            syncTotals.current = { imported: 0, duplicates: 0, skipped: 0 };
            sync.mutate({ pageToken });
          }}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${jobId ? "animate-spin" : ""}`}
          />
          {jobId || sync.isPending
            ? "Syncing all email pages…"
            : pageToken
              ? "Resume Gmail sync"
              : "Sync Gmail · last 30 days"}
        </Button>
        <Link
          className="text-blue-700 hover:underline"
          href="/settings/integrations"
        >
          Connection settings
        </Link>
        <span className="text-xs text-slate-500">
          Leads, clients and sent-email contacts · refreshes every 5 minutes
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
            Contacts & outreach
          </h2>
          <section className="max-h-[55vh] overflow-y-auto space-y-1">
            {contacts.isLoading && <p>Loading contacts…</p>}
            {contacts.data?.length === 0 && (
              <p>
                No matching contacts with communications yet. Sync Gmail Sent or
                add a contact to the CRM.
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
          {contactId !== null && (
            <section
              aria-label="Client contact card"
              className="border-b bg-slate-50 p-4 space-y-3"
            >
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-xs text-slate-500">
                  Client name
                  <Input
                    value={cardName}
                    onChange={e => setCardName(e.target.value)}
                    aria-label="Client name"
                    className="mt-1 bg-white text-slate-800"
                  />
                </label>
                <label className="text-xs text-slate-500">
                  Phone number
                  <Input
                    type="tel"
                    value={cardPhone}
                    onChange={e => setCardPhone(e.target.value)}
                    placeholder="Add phone number"
                    aria-label="Client phone number"
                    className="mt-1 bg-white text-slate-800"
                  />
                </label>
              </div>
              <p className="text-sm break-all">
                {selectedContact?.email}
                {selectedContact?.company && ` · ${selectedContact.company}`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!cardName.trim() || saveCard.isPending}
                  onClick={() =>
                    saveCard.mutate({
                      id: contactId,
                      name: cardName,
                      phone: cardPhone.trim() || undefined,
                    })
                  }
                >
                  Save contact
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    sending ||
                    !contacts.data?.find(contact => contact.id === contactId)
                      ?.phone
                  }
                  onClick={() => {
                    setCompose("sms");
                    setDraft("");
                  }}
                >
                  Send text message
                </Button>
                {!contacts.data?.find(contact => contact.id === contactId)
                  ?.phone && (
                  <span className="text-xs text-slate-500 self-center">
                    Save the contact with a phone number to enable texting.
                  </span>
                )}
              </div>
            </section>
          )}
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
                {selectedContact?.name ?? "Contacts & outreach"}
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
              {selectedMessage.channel === "email" &&
                selectedMessage.provider === "gmail" && (
                  <Button
                    variant="outline"
                    disabled={sending || !status.data?.hasSendPermission}
                    onClick={() => {
                      setCompose("email");
                      setDraft("");
                    }}
                  >
                    Reply by email
                  </Button>
                )}
              {selectedMessage.channel === "email" &&
                !status.data?.hasSendPermission && (
                  <p className="text-sm text-blue-700">
                    Reconnect Google in Connection settings to enable email
                    replies.
                  </p>
                )}
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
          {compose && contactId !== null && (
            <section
              className="border-t p-5 space-y-3"
              aria-label="Message composer"
            >
              <h3 className="font-semibold">
                {compose === "email" ? "Email reply" : "Text message"} ·{" "}
                {compose === "email"
                  ? selectedContact?.email
                  : selectedContact?.phone}
              </h3>
              <textarea
                className="w-full min-h-32 rounded-lg border p-3 text-sm text-slate-800 bg-white"
                aria-label="Message body"
                placeholder="Write your message…"
                maxLength={compose === "sms" ? 1600 : 20000}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                disabled={sending}
              />
              <div className="flex gap-2">
                <Button
                  disabled={sending || !draft.trim()}
                  onClick={() => {
                    const requestId = crypto.randomUUID();
                    if (compose === "email" && messageId !== null)
                      reply.mutate({
                        externalContactId: contactId,
                        messageId,
                        body: draft,
                        requestId,
                      });
                    else if (compose === "sms")
                      text.mutate({
                        externalContactId: contactId,
                        body: draft,
                        requestId,
                      });
                  }}
                >
                  {sending ? "Sending…" : "Send"}
                </Button>
                <Button
                  variant="outline"
                  disabled={sending}
                  onClick={() => {
                    setCompose(null);
                    setDraft("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </section>
          )}
        </section>
      </div>
    </div>
  );
}

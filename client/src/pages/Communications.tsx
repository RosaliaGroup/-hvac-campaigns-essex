import EmailThreadList from "@/components/EmailThreadList";
import EmailConversation from "@/components/EmailConversation";
import { groupEmailThreads } from "@/lib/emailThreads";
import ContactProfilePanel from "@/components/ContactProfilePanel";
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { internalSmsConversationPath } from "@/lib/internalSms";
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
  const [, navigate] = useLocation();
  const customerId = Number(
    new URLSearchParams(window.location.search).get("customerId")
  );
  const linkedContact = trpc.crmCommunications.contactForCustomer.useQuery(
    { customerId },
    { enabled: customerId > 0 }
  );
  const [search, setSearch] = useState("");
  const [contactId, setContactId] = useState<number | null>(() => Number(new URLSearchParams(window.location.search).get("contactId")) || null);
  useEffect(() => {
    if (linkedContact.data) setContactId(linkedContact.data.id);
  }, [linkedContact.data?.id]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [pageToken, setPageToken] = useState<string | undefined>();
  const handledSyncJob = useRef<string | null>(null);
  const syncTotals = useRef({ imported: 0, duplicates: 0, skipped: 0 });
  const [notice, setNotice] = useState("");
  const [folder, setFolder] = useState<"all" | "inbox" | "sent" | "sms">("all");
  const [messageId, setMessageId] = useState<number | null>(
    () =>
      Number(new URLSearchParams(window.location.search).get("messageId")) ||
      null
  );
  const [draft, setDraft] = useState("");
  const [subject, setSubject] = useState("");
  const openingCustomer = useRef<number | null>(null);
  const openCustomer = trpc.crmCommunications.openCustomerContact.useMutation({
    onSuccess: contact => {
      setContactId(contact.id);
      void contacts.refetch();
    },
    onError: error => setNotice(error.message),
  });
  useEffect(() => {
    if (
      customerId > 0 &&
      linkedContact.data === null &&
      openingCustomer.current !== customerId
    ) {
      openingCustomer.current = customerId;
      openCustomer.mutate({ customerId });
    }
  }, [customerId, linkedContact.data]);
  const openingLead = useRef<string | null>(null);
  const openLead = trpc.crmCommunications.openLeadContact.useMutation({
    onSuccess: contact => {
      setContactId(contact.id);
      void contacts.refetch();
    },
    onError: error => setNotice(error.message),
  });
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const captureId = Number(query.get("leadCaptureId"));
    const leadId = Number(query.get("leadId"));
    const id = captureId || leadId;
    const kind = captureId ? "capture" : "lead";
    if (id > 0 && openingLead.current !== `${kind}:${id}`) {
      openingLead.current = `${kind}:${id}`;
      openLead.mutate({ id, kind });
    }
  }, []);
  const [compose, setCompose] = useState<"email" | "newEmail" | "sms" | null>(
    null
  );
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
      setNotice("Working…");
    },
    onError: (error: { message: string }) => setNotice(error.message),
  };
  const newEmail = trpc.crmCommunications.composeEmail.useMutation(sendOptions);
  const reply = trpc.crmCommunications.replyEmail.useMutation(sendOptions);
  const text = trpc.crmCommunications.sendText.useMutation(sendOptions);
  const sending =
    Boolean(sendJobId) ||
    reply.isPending ||
    text.isPending ||
    newEmail.isPending;
  const sendJob = trpc.crmCommunications.sendJob.useQuery(
    { jobId: sendJobId ?? "" },
    { enabled: Boolean(sendJobId), refetchInterval: sendJobId ? 1500 : false }
  );
  useEffect(() => {
    if (!sendJobId || sendJob.isFetching) return;
    if (sendJob.data?.status === "done") {
      const result = sendJob.data.result as {
        warning?: string;
        draftSaved?: boolean;
      };
      setNotice(
        result?.warning ??
          (result?.draftSaved
            ? "Draft saved in Gmail Drafts. It has not been sent."
            : "Message sent.")
      );
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
        "Send status is unavailable. Check Gmail Sent, Drafts, or SMS history before trying again."
      );
      setSendJobId(null);
    }
  }, [sendJob.data, sendJob.error, sendJob.isFetching, sendJobId]);
  const contacts = trpc.crmCommunications.contacts.useQuery(
    { search },
    { refetchInterval: 30000 }
  );
  const crmContacts = trpc.customers.list.useQuery({
    search: search || undefined,
    limit: 100,
    offset: 0,
  });
  const leadOptions = trpc.crmCommunications.leadOptions.useQuery({ search });
  const availableContacts: {
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    leadOption?: { id: number; kind: "lead" | "capture" };
  }[] = [
    ...(contacts.data ?? []),
    ...(crmContacts.data?.items ?? [])
      // Historical Gmail Sent auto-imports are not approved CRM contacts.
      // Existing clients remain visible only with both email and phone.
      .filter(c => c.source !== "Gmail Sent" &&
        Boolean(c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) &&
        Boolean(c.phone && c.phone.replace(/\D/g,"").length >= 10))
      .filter(
        c =>
          !(contacts.data ?? []).some(
            e =>
              e.customerId === c.id ||
              (c.email && e.email?.toLowerCase() === c.email.toLowerCase())
          )
      )
      .map(c => ({
        id: -c.id,
        name: c.displayName,
        email: c.email,
        phone: c.phone,
        company: c.companyName,
      })),
    ...(leadOptions.data ?? [])
      .filter(
        l =>
          !(contacts.data ?? []).some(
            c =>
              (l.kind === "lead"
                ? c.leadId === l.id
                : c.leadCaptureId === l.id) ||
              (l.email && c.email?.toLowerCase() === l.email.toLowerCase()) ||
              (l.phone &&
                c.phone?.replace(/[^0-9+]/g, "") ===
                  l.phone.replace(/[^0-9+]/g, ""))
          )
      )
      .map(l => ({
        ...l,
        id: -(1000000000 + l.id * 2 + (l.kind === "capture" ? 1 : 0)),
        leadOption: { id: l.id, kind: l.kind },
        company: null,
      })),
  ];
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
  const allThreads = groupEmailThreads(timeline.data ?? []);
  const visibleThreads = allThreads.filter(thread =>
    thread.messages.some(
      message =>
        folder === "all" ||
        (folder === "sms"
          ? message.channel === "sms"
          : message.channel === "email" &&
            message.direction === (folder === "inbox" ? "inbound" : "outbound"))
    )
  );
  const messages = visibleThreads.flatMap(thread => thread.messages);
  const selectedThread = visibleThreads.find(thread =>
    thread.messages.some(message => message.id === messageId)
  );
  const selectedMessage = selectedThread?.latest;
  const folders = [
    { id: "all" as const, label: "All communications", icon: Mail },
    { id: "inbox" as const, label: "Inbox", icon: Inbox },
    { id: "sent" as const, label: "Sent", icon: Send },
    { id: "sms" as const, label: "SMS", icon: MessageSquare },
  ];
  return (
    <div className="min-w-0 max-w-full bg-[#f6f8fc] text-slate-800 rounded-2xl p-3 md:p-5 space-y-4">
      <header className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 md:w-56">
          <Mail className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold">Communications</h1>
        </div>
        <div className="relative flex-1 min-w-[220px] max-w-2xl">
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-500" />
          <Input
            className="h-12 pl-12 rounded-full border-0 bg-[#eaf1fb] text-slate-800"
            aria-label="Search contacts, leads, companies or email"
            placeholder="Search contacts, leads, companies or email"
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
          CRM contacts and leads · Gmail sync does not add people automatically
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
      {(contacts.error ||
        crmContacts.error ||
        linkedContact.error ||
        timeline.error ||
        job.error ||
        status.error) && (
        <p role="alert" className="text-red-600">
          {contacts.error?.message ??
            crmContacts.error?.message ??
            linkedContact.error?.message ??
            timeline.error?.message ??
            job.error?.message ??
            status.error?.message}
        </p>
      )}
      <div className="grid min-w-0 md:h-[calc(100dvh-240px)] md:min-h-[420px] md:grid-cols-[280px_minmax(0,1fr)] gap-4">
        <aside className="min-w-0 md:h-full md:overflow-y-auto pr-1">
          <nav aria-label="Communication folders" className="space-y-1 mb-6">
            {folders.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "sms") {
                    navigate(internalSmsConversationPath(selectedContact?.phone));
                    return;
                  }
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

          {contactId !== null && (
            <section
              aria-label="Client contact card"
              className="rounded-xl border bg-white p-4 space-y-3 mt-4"
            >
              <div className="grid gap-3">
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
                  disabled={!selectedContact?.email || sending}
                  onClick={() => {
                    setCompose("newEmail");
                    setSubject("");
                    setDraft("");
                  }}
                >
                  Compose email
                </Button>
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
                  disabled={!selectedContact?.phone}
                  onClick={() => navigate(internalSmsConversationPath(selectedContact?.phone))}
                >
                  Send text message
                </Button>
                {!selectedContact?.phone && (
                  <span className="text-xs text-slate-500 self-center">
                    Save the contact with a phone number to enable texting.
                  </span>
                )}
              </div>
            </section>
          )}

          {contactId !== null && (
            <div className="mt-4">
              <ContactProfilePanel
                key={contactId}
                contactId={contactId}
                companyName={card.data?.company}
              />
            </div>
          )}
        </aside>
        <section className="min-w-0 max-w-full rounded-2xl bg-white overflow-x-hidden overflow-y-auto border border-slate-100 min-h-[420px] md:min-h-0 md:h-full">
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
                {selectedContact?.name ?? "Communications"}
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {selectedContact?.email ??
                  selectedContact?.phone ??
                  "Select a contact or lead to view communications"}
              </p>
            </div>
            {contactId !== null && (
              <span className="ml-auto text-xs text-slate-500 whitespace-nowrap">
                {visibleThreads.length} conversations
              </span>
            )}
          </div>
          {contactId === null ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8 px-6 text-center text-slate-500">
              <Inbox className="h-10 w-10 mb-4 text-blue-300" />
              <p>
                Select a contact or lead to view messages or compose a new
                email.
              </p>
              <details
                open
                className="w-full max-w-2xl rounded-xl border bg-white text-left"
              >
                <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-xs uppercase tracking-wide text-slate-500">
                  <Users className="h-4 w-4" />
                  Select a contact or lead
                </summary>
                <section className="max-h-64 overflow-y-auto space-y-1">
                  {contacts.isLoading && <p>Loading contacts…</p>}
                  {availableContacts.length === 0 && (
                    <p>
                      No matching contacts. Search by name or email, or add a
                      contact to the CRM.
                    </p>
                  )}
                  {availableContacts.map(contact => (
                    <button
                      key={contact.id}
                      onClick={() => {
                        if (contact.leadOption)
                          openLead.mutate(contact.leadOption);
                        else if (contact.id < 0)
                          openCustomer.mutate({ customerId: -contact.id });
                        else setContactId(contact.id);
                        setMessageId(null);
                      }}
                      aria-pressed={contactId === contact.id}
                      className={`block w-full text-left rounded-xl px-4 py-3 ${contactId === contact.id ? "bg-[#d3e3fd]" : "hover:bg-slate-200"}`}
                    >
                      <strong className="block break-words">
                        {contact.name}
                        {contact.leadOption && (
                          <span className="ml-2 text-xs font-normal text-blue-700">
                            Lead
                          </span>
                        )}
                      </strong>
                      {contact.company && (
                        <p className="text-sm break-words">{contact.company}</p>
                      )}
                      <p className="text-sm break-all">
                        {contact.email ?? contact.phone}
                      </p>
                    </button>
                  ))}
                </section>
              </details>
            </div>
          ) : timeline.isLoading ? (
            <p className="p-6 text-slate-500">Loading messages…</p>
          ) : selectedMessage ? (
            <article className="p-5 md:p-7 space-y-5">
              <h2 className="text-2xl font-normal break-words">
                {selectedThread?.messages[0].subject?.replace(
                  /^(?:(?:re|fwd?):\s*)+/i,
                  ""
                ) ||
                  (selectedMessage.channel === "sms"
                    ? "Text message"
                    : "No subject")}
              </h2>
              <EmailConversation
                key={selectedThread?.key}
                messages={selectedThread?.messages ?? []}
              />
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
            <EmailThreadList
              messages={messages}
              contactName={selectedContact?.name}
              onOpen={setMessageId}
            />
          )}
          {compose && contactId !== null && (
            <section
              className="border-t p-5 space-y-3"
              aria-label="Message composer"
            >
              <h3 className="font-semibold">
                {compose === "newEmail"
                  ? "New email"
                  : compose === "email"
                    ? "Email reply"
                    : "Text message"}{" "}
                ·{" "}
                {compose !== "sms"
                  ? selectedContact?.email
                  : selectedContact?.phone}
              </h3>
              {compose === "newEmail" && (
                <Input
                  aria-label="Email subject"
                  placeholder="Subject"
                  maxLength={500}
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  disabled={sending}
                />
              )}
              {compose === "newEmail" && !status.data?.hasDraftPermission && (
                <p className="text-sm text-amber-700">
                  Reconnect Google to save drafts in Gmail.
                </p>
              )}
              {compose === "newEmail" && !status.data?.hasSendPermission && (
                <p className="text-sm text-amber-700">
                  Reconnect Google to send email.
                </p>
              )}
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
                {compose === "newEmail" && (
                  <Button
                    variant="outline"
                    disabled={
                      sending ||
                      !draft.trim() ||
                      !subject.trim() ||
                      !status.data?.hasDraftPermission
                    }
                    onClick={() =>
                      newEmail.mutate({
                        externalContactId: contactId,
                        subject,
                        body: draft,
                        action: "draft",
                        requestId: crypto.randomUUID(),
                      })
                    }
                  >
                    Save draft
                  </Button>
                )}
                <Button
                  disabled={
                    sending ||
                    !draft.trim() ||
                    (compose === "newEmail" &&
                      (!subject.trim() || !status.data?.hasSendPermission))
                  }
                  onClick={() => {
                    const requestId = crypto.randomUUID();
                    if (compose === "newEmail")
                      newEmail.mutate({
                        externalContactId: contactId,
                        subject,
                        body: draft,
                        action: "send",
                        requestId,
                      });
                    else if (compose === "email" && selectedMessage)
                      reply.mutate({
                        externalContactId: contactId,
                        messageId: selectedMessage.id,
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
                  {sending ? "Working…" : "Send"}
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

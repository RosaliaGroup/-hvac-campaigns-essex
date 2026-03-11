import { useState, useMemo, useEffect } from "react";
import InternalNav from "@/components/InternalNav";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Users,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  BarChart3,
  Upload,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  CalendarClock,
  Ban,
  Info,
  Pencil,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getLoginUrl } from "@/const";

// Pre-loaded contacts from the Excel file
const EXCEL_CONTACTS_A = [
  { firstName: "Green", lastName: "Billones", phone: "9734896266", email: "greenbillones@gmail.com", zip: "07110", segment: "A" as const, leadStatus: "ATTEMPTED_TO_CONTACT", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Valerie", lastName: "Baylor", phone: "8624327178", email: "v.lb1waldron@gmail.com", zip: "07876", segment: "A" as const, leadStatus: "ATTEMPTED_TO_CONTACT", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Donald", lastName: "Nelson", phone: "9085916870", email: "drlnddm@msn.com", zip: "07901", segment: "A" as const, leadStatus: "ATTEMPTED_TO_CONTACT", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Frances", lastName: "Wighardt", phone: "9733358575", email: "francescarl@optimum.net", zip: "07054", segment: "A" as const, leadStatus: "ATTEMPTED_TO_CONTACT", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Tom", lastName: "Davies", phone: "9732190852", email: "begood1953@hotmail.com", zip: "07874", segment: "A" as const, leadStatus: "ATTEMPTED_TO_CONTACT", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Elizabeth", lastName: "Alworth", phone: "9732260405", email: "emawc8@aol.com", zip: "07006", segment: "A" as const, leadStatus: "ATTEMPTED_TO_CONTACT", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Zbigniew", lastName: "Sobczak", phone: "2014869279", email: "zpsobczak@gmail.com", zip: "07834", segment: "A" as const, leadStatus: "ATTEMPTED_TO_CONTACT", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "John", lastName: "Wanczowski", phone: "8622642665", email: "johnnysizzle007@aol.com", zip: "07508", segment: "A" as const, leadStatus: "ATTEMPTED_TO_CONTACT", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Dev", lastName: "Dewan", phone: "9735664231", email: "dwn123456@gmail.com", zip: "07003", segment: "A" as const, leadStatus: "ATTEMPTED_TO_CONTACT", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Ivan", lastName: "Hall", phone: "9736505397", email: "ivanhall1956@yahoo.com", zip: "07111", segment: "A" as const, leadStatus: "ATTEMPTED_TO_CONTACT", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Kenneth", lastName: "Clay", phone: "2406872516", email: "knnyclay64@yahoo.com", zip: "07040", segment: "A" as const, leadStatus: "ATTEMPTED_TO_CONTACT", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Lowell", lastName: "Taclob", phone: "2013212250", email: "taclobl@yahoo.com", zip: "07505", segment: "A" as const, leadStatus: "IN_PROGRESS", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Jim", lastName: "Henry", phone: "2018037506", email: "doctorjimhenry@gmail.com", zip: "07419", segment: "A" as const, leadStatus: "UNQUALIFIED", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Greg", lastName: "Desilva", phone: "2017883288", email: "gdesilv1@gmail.com", zip: "07006", segment: "A" as const, leadStatus: "UNQUALIFIED", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Anita", lastName: "T Hsu", phone: "9084007415", email: "puremind031@gmail.com", zip: "07088", segment: "A" as const, leadStatus: "UNQUALIFIED", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "William", lastName: "Bedford", phone: "9736504638", email: "billbedford22@hotmail.com", zip: "07405", segment: "A" as const, leadStatus: "ATTEMPTED_TO_CONTACT", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Bridget", lastName: "Jackson", phone: "9733423018", email: "maudeestates@gmail.com", zip: "07018", segment: "A" as const, leadStatus: "UNQUALIFIED", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Zdenka", lastName: "Simkova", phone: "8628230327", email: "muka0017@hotmail.com", zip: "07026", segment: "A" as const, leadStatus: "ATTEMPTED_TO_CONTACT", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Misael", lastName: "R", phone: "3473876836", email: "drepp77@gmail.com", zip: "07082", segment: "A" as const, leadStatus: "CONNECTED", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Ufredo", lastName: "Molina", phone: "2014520965", email: "umolina1162@gmail.com", zip: "07031", segment: "A" as const, leadStatus: "CONNECTED", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Robert", lastName: "Shin", phone: "3474544553", email: "rshin01@mail.com", zip: "07607", segment: "A" as const, leadStatus: "UNQUALIFIED", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Trial", lastName: "Spare", phone: "8624521356", email: "trialspare14@gmail.com", zip: "07013", segment: "A" as const, leadStatus: "ATTEMPTED_TO_CONTACT", smsTag: "ME-Rebate-SegA-2026" },
  { firstName: "Homebuddy", lastName: "Homebuddy", phone: "6469635886", email: "adijfs5joxvtnaoy@yahoo.com", zip: "07003", segment: "A" as const, leadStatus: "", smsTag: "ME-Rebate-SegA-2026" },
];

const EXCEL_CONTACTS_B = [
  { firstName: "Douglas", lastName: "Herrera", phone: "4074730660", email: "facchineil@aol.com", zip: "07109", segment: "B" as const, leadStatus: "UNQUALIFIED", smsTag: "ME-Rebate-SegB-2026" },
  { firstName: "Richard", lastName: "Skowronski", phone: "7329330707", email: "rskowronski@gerardcnd.com", zip: "07753", segment: "B" as const, leadStatus: "", smsTag: "ME-Rebate-SegB-2026" },
  { firstName: "Sheryl", lastName: "Folsom", phone: "2014496850", email: "sfolsom@trccompanies.com", zip: "08901", segment: "B" as const, leadStatus: "", smsTag: "ME-Rebate-SegB-2026" },
  { firstName: "Marykay", lastName: "Barbieri", phone: "7326313603", email: "marykay.barbieri@greekrep.com", zip: "08816", segment: "B" as const, leadStatus: "", smsTag: "ME-Rebate-SegB-2026" },
  { firstName: "Jhon", lastName: "Rendon", phone: "6462269189", email: "jhon@mechanicalenterprise.com", zip: "07105", segment: "B" as const, leadStatus: "", smsTag: "ME-Rebate-SegB-2026" },
  { firstName: "Debbie", lastName: "Genovese", phone: "7323989677", email: "dgenovese@ridgecorp.net", zip: "08902", segment: "B" as const, leadStatus: "", smsTag: "ME-Rebate-SegB-2026" },
  { firstName: "Gregg", lastName: "Genovese", phone: "7323989677", email: "ggenovese@ridgecorp.net", zip: "08902", segment: "B" as const, leadStatus: "", smsTag: "ME-Rebate-SegB-2026" },
  { firstName: "Jennifer", lastName: "Kuzio", phone: "7323989677", email: "jkuzio@ridgecorp.net", zip: "08902", segment: "B" as const, leadStatus: "", smsTag: "ME-Rebate-SegB-2026" },
  { firstName: "Efrat", lastName: "Altman", phone: "9738749998", email: "efrat@ynhnj.com", zip: "07102", segment: "B" as const, leadStatus: "", smsTag: "ME-Rebate-SegB-2026" },
  { firstName: "Alexis", lastName: "Halpert", phone: "8623536009", email: "alexish@pdcllc.us", zip: "07104", segment: "B" as const, leadStatus: "", smsTag: "ME-Rebate-SegB-2026" },
  { firstName: "Christina", lastName: "Raimo", phone: "9732278330", email: "craimo@trematore.com", zip: "07004", segment: "B" as const, leadStatus: "", smsTag: "ME-Rebate-SegB-2026" },
  { firstName: "Brian", lastName: "Trematore", phone: "9732278330", email: "btrematore@trematore.com", zip: "07004", segment: "B" as const, leadStatus: "", smsTag: "ME-Rebate-SegB-2026" },
  { firstName: "Beverly", lastName: "Scott", phone: "7323989677", email: "bscott@ridgecorp.net", zip: "08902", segment: "B" as const, leadStatus: "", smsTag: "ME-Rebate-SegB-2026" },
];

// Default message templates from the Excel file
const DEFAULT_MSG1 = `Hi {{contact.firstname}}! Mechanical Enterprise here 🏠 New Jersey homeowners are qualifying for up to $16,000 in rebates on heat pump upgrades — no upfront cost, payments go right on your utility bill. FREE assessment, zero obligation. Call us now: (862) 419-1763. Reply STOP to opt out.`;
const DEFAULT_MSG2 = `{{contact.firstname}}, just checking in — Mechanical Enterprise. Homeowners in your area are cutting energy bills by 50% with heat pump upgrades + up to $16K back in rebates. Takes 10 min to see if you qualify. Call for your FREE assessment: (862) 419-1763. Reply STOP to opt out.`;
const DEFAULT_MSG3 = `Last reminder from Mechanical Enterprise 👋 The Residential Decarbonization Program rebates (up to $16K) are available now for New Jersey homeowners. Your FREE assessment could save you $100s/month on energy. Call to book: (862) 419-1763. Reply STOP to opt out.`;

type Contact = {
  id: number;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  zip: string | null;
  segment: "A" | "B" | "C";
  leadStatus: string | null;
  smsTag: string | null;
  optedOut: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export default function SmsCampaigns() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [segmentFilter, setSegmentFilter] = useState<"all" | "A" | "B" | "C">("all");
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [activeMsg, setActiveMsg] = useState<1 | 2 | 3>(1);
  const [msgTexts, setMsgTexts] = useState({ 1: DEFAULT_MSG1, 2: DEFAULT_MSG2, 3: DEFAULT_MSG3 });
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendTarget, setSendTarget] = useState<"selected" | "all">("selected");
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; skipped: number; quotaRemaining?: number } | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedContactForHistory, setSelectedContactForHistory] = useState<Contact | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<"selected" | "all">("selected");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<{ scheduled: number } | null>(null);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", phone: "", email: "", zip: "", segment: "A" as "A" | "B" | "C", leadStatus: "", notes: "" });

  // Queries
  const { data: contacts = [], isLoading: contactsLoading, refetch: refetchContacts } = trpc.smsCampaigns.listContacts.useQuery({ segment: segmentFilter });
  const { data: quota, refetch: refetchQuota } = trpc.smsCampaigns.getQuota.useQuery();
  const { data: sendHistory = [] } = trpc.smsCampaigns.getSendHistory.useQuery(
    { contactId: selectedContactForHistory?.id, limit: 20 },
    { enabled: historyDialogOpen }
  );

  // Mutations
  const importMutation = trpc.smsCampaigns.importContacts.useMutation({
    onSuccess: (data) => {
      toast({ title: "Contacts imported", description: `${data.imported} imported, ${data.skipped} skipped (duplicates)` });
      refetchContacts();
    },
    onError: (e) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  const sendBulkMutation = trpc.smsCampaigns.sendBulk.useMutation({
    onSuccess: (data) => {
      setSendResult(data);
      setIsSending(false);
      refetchContacts();
      refetchQuota();
      toast({
        title: `Sent ${data.sent} messages`,
        description: `${data.failed} failed, ${data.skipped} skipped.`,
      });
    },
    onError: (e) => {
      setIsSending(false);
      toast({ title: "Send failed", description: e.message, variant: "destructive" });
    },
  });

  const scheduleSendMutation = trpc.smsCampaigns.scheduleSend.useMutation({
    onSuccess: (data) => {
      setScheduleResult(data);
      setIsScheduling(false);
      toast({
        title: `Scheduled ${data.scheduled} messages`,
        description: `They will be sent automatically at the chosen date/time.`,
      });
    },
    onError: (e) => {
      setIsScheduling(false);
      toast({ title: "Schedule failed", description: e.message, variant: "destructive" });
    },
  });

  const toggleOptOutMutation = trpc.smsCampaigns.toggleOptOut.useMutation({
    onSuccess: () => refetchContacts(),
  });

  const deleteContactMutation = trpc.smsCampaigns.deleteContact.useMutation({
    onSuccess: () => {
      refetchContacts();
      toast({ title: "Contact removed" });
    },
  });

  const updateContactMutation = trpc.smsCampaigns.updateContact.useMutation({
    onSuccess: () => {
      refetchContacts();
      setEditContact(null);
      toast({ title: "Contact updated" });
    },
    onError: (e) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  function openEditContact(contact: Contact) {
    setEditContact(contact);
    setEditForm({
      firstName: contact.firstName,
      lastName: contact.lastName ?? "",
      phone: contact.phone,
      email: contact.email ?? "",
      zip: contact.zip ?? "",
      segment: contact.segment,
      leadStatus: contact.leadStatus ?? "",
      notes: "",
    });
  }

  function handleSaveEdit() {
    if (!editContact) return;
    updateContactMutation.mutate({ id: editContact.id, ...editForm });
  }

  // Computed
  const filteredContacts = contacts as Contact[];
  const activeContacts = filteredContacts.filter((c) => !c.optedOut);
  const allSelected = filteredContacts.length > 0 && selectedContactIds.length === filteredContacts.length;

  const charCount = msgTexts[activeMsg].length;
  const smsCount = Math.ceil(charCount / 160);

  // Set default scheduled date to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduledDate(tomorrow.toISOString().split("T")[0]);
  }, []);

  async function handleScheduleSend() {
    if (!scheduledDate || !scheduledTime) {
      toast({ title: "Please select a date and time", variant: "destructive" });
      return;
    }
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`);
    if (scheduledAt <= new Date()) {
      toast({ title: "Scheduled time must be in the future", variant: "destructive" });
      return;
    }
    const ids =
      scheduleTarget === "all"
        ? activeContacts.map((c) => c.id)
        : selectedContactIds.filter((id) => {
            const c = filteredContacts.find((x) => x.id === id);
            return c && !c.optedOut;
          });
    if (ids.length === 0) {
      toast({ title: "No contacts to schedule", variant: "destructive" });
      return;
    }
    setIsScheduling(true);
    setScheduleResult(null);
    await scheduleSendMutation.mutateAsync({
      contactIds: ids,
      messageNum: activeMsg,
      messageText: msgTexts[activeMsg],
      scheduledAt,
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(filteredContacts.map((c) => c.id));
    }
  }

  function toggleContact(id: number) {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleImportFromExcel() {
    const all = [...EXCEL_CONTACTS_A, ...EXCEL_CONTACTS_B];
    await importMutation.mutateAsync(all);
  }

  async function handleSend() {
    const ids =
      sendTarget === "all"
        ? activeContacts.map((c) => c.id)
        : selectedContactIds.filter((id) => {
            const c = filteredContacts.find((x) => x.id === id);
            return c && !c.optedOut;
          });

    if (ids.length === 0) {
      toast({ title: "No contacts to send to", variant: "destructive" });
      return;
    }

    setIsSending(true);
    setSendResult(null);
    await sendBulkMutation.mutateAsync({
      contactIds: ids,
      messageNum: activeMsg,
      messageText: msgTexts[activeMsg],
    });
  }

  function getStatusBadge(status: string | null) {
    if (!status || status === "—" || status === "") return null;
    const map: Record<string, string> = {
      ATTEMPTED_TO_CONTACT: "bg-yellow-100 text-yellow-800",
      CONNECTED: "bg-green-100 text-green-800",
      IN_PROGRESS: "bg-blue-100 text-blue-800",
      UNQUALIFIED: "bg-gray-100 text-gray-700",
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? "bg-gray-100 text-gray-700"}`}>
        {status.replace(/_/g, " ")}
      </span>
    );
  }

  if (authLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin h-8 w-8 text-gray-400" /></div>;
  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <InternalNav />
      {/* Header */}
      <div className="bg-[#1e3a5f] text-white px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-7 w-7 text-[#ff6b35]" />
            <div>
              <h1 className="text-2xl font-bold">SMS Campaign Manager</h1>
              <p className="text-blue-200 text-sm">Powered by TextBelt · Mechanical Enterprise</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {quota && (
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
                <Zap className="h-4 w-4 text-yellow-300" />
                <span className="text-sm font-semibold">{quota.quotaRemaining} texts remaining</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="border-white/30 text-white hover:bg-white/10 bg-transparent"
              onClick={() => refetchQuota()}
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="contacts">
          <TabsList className="mb-6 bg-white border">
            <TabsTrigger value="contacts" className="gap-2"><Users className="h-4 w-4" /> Contacts ({filteredContacts.length})</TabsTrigger>
            <TabsTrigger value="compose" className="gap-2"><MessageSquare className="h-4 w-4" /> Compose & Send</TabsTrigger>
            <TabsTrigger value="scheduled" className="gap-2"><CalendarClock className="h-4 w-4" /> Scheduled</TabsTrigger>
            <TabsTrigger value="history" className="gap-2"><BarChart3 className="h-4 w-4" /> Send History</TabsTrigger>
            <TabsTrigger value="settings" className="gap-2"><Info className="h-4 w-4" /> Opt-Out Setup</TabsTrigger>
          </TabsList>

          {/* ── CONTACTS TAB ── */}
          <TabsContent value="contacts">
            <div className="flex flex-wrap gap-3 mb-4 items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleImportFromExcel}
                  disabled={importMutation.isPending}
                >
                  <Upload className="h-4 w-4" />
                  {importMutation.isPending ? "Importing..." : "Import from Excel (37 contacts)"}
                </Button>

                <Select value={segmentFilter} onValueChange={(v) => { setSegmentFilter(v as typeof segmentFilter); setSelectedContactIds([]); }}>
                  <SelectTrigger className="w-40 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Segments</SelectItem>
                    <SelectItem value="A">🔴 Segment A (SQLs)</SelectItem>
                    <SelectItem value="B">🟡 Segment B (NJ Leads)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 items-center">
                {selectedContactIds.length > 0 && (
                  <span className="text-sm text-gray-600">{selectedContactIds.length} selected</span>
                )}
                <Button
                  size="sm"
                  className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 gap-2"
                  disabled={selectedContactIds.length === 0}
                  onClick={() => { setSendTarget("selected"); setSendDialogOpen(true); }}
                >
                  <Send className="h-4 w-4" /> Send to Selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={activeContacts.length === 0}
                  onClick={() => { setSendTarget("all"); setSendDialogOpen(true); }}
                >
                  <Send className="h-4 w-4" /> Send to All ({activeContacts.length})
                </Button>
              </div>
            </div>

            {contactsLoading ? (
              <div className="flex justify-center py-16"><RefreshCw className="animate-spin h-8 w-8 text-gray-400" /></div>
            ) : filteredContacts.length === 0 ? (
              <Card className="text-center py-16">
                <CardContent>
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No contacts yet</p>
                  <p className="text-gray-400 text-sm mt-1">Click "Import from Excel" to load your 37 contacts</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="px-4 py-3 text-left">
                          <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded" />
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Phone</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Segment</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Opt-Out</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContacts.map((contact) => (
                        <tr
                          key={contact.id}
                          className={`border-b hover:bg-gray-50 transition-colors ${contact.optedOut ? "opacity-50" : ""}`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedContactIds.includes(contact.id)}
                              onChange={() => toggleContact(contact.id)}
                              disabled={contact.optedOut}
                              className="rounded"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{contact.firstName} {contact.lastName}</div>
                            {contact.email && <div className="text-xs text-gray-500 flex items-center gap-1"><Mail className="h-3 w-3" />{contact.email}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-gray-700"><Phone className="h-3.5 w-3.5 text-gray-400" />{contact.phone}</div>
                            {contact.zip && <div className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{contact.zip}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={contact.segment === "A" ? "border-red-300 text-red-700 bg-red-50" : "border-yellow-300 text-yellow-700 bg-yellow-50"}>
                              Seg {contact.segment}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(contact.leadStatus)}</td>
                          <td className="px-4 py-3">
                            {contact.optedOut ? (
                              <Badge variant="destructive" className="text-xs">Opted Out</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">Active</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 items-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => { setSelectedContactForHistory(contact); setHistoryDialogOpen(true); }}
                              >
                                History
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => toggleOptOutMutation.mutate({ id: contact.id, optedOut: !contact.optedOut })}
                              >
                                {contact.optedOut ? "Restore" : "Opt Out"}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title="Edit contact"
                                onClick={() => openEditContact(contact)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Delete contact"
                                onClick={() => {
                                  if (confirm(`Delete ${contact.firstName} ${contact.lastName ?? ""}?`)) {
                                    deleteContactMutation.mutate({ id: contact.id });
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ── COMPOSE TAB ── */}
          <TabsContent value="compose">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Message Editor */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-[#ff6b35]" />
                    3-Message Drip Sequence
                  </CardTitle>
                  <CardDescription>
                    Use <code className="bg-gray-100 px-1 rounded text-xs">{"{{contact.firstname}}"}</code> to personalize with first name
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    {([1, 2, 3] as const).map((n) => (
                      <button
                        key={n}
                        onClick={() => setActiveMsg(n)}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                          activeMsg === n
                            ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                            : "bg-white text-gray-600 border-gray-200 hover:border-[#1e3a5f]"
                        }`}
                      >
                        {n === 1 ? "Day 1" : n === 2 ? "Day 4" : "Day 10"}
                      </button>
                    ))}
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <Label className="text-sm font-medium">
                        {activeMsg === 1 ? "Initial Outreach" : activeMsg === 2 ? "Follow-Up" : "Final Reminder"}
                      </Label>
                      <span className={`text-xs ${charCount > 320 ? "text-red-500" : "text-gray-500"}`}>
                        {charCount} chars · {smsCount} SMS
                      </span>
                    </div>
                    <Textarea
                      value={msgTexts[activeMsg]}
                      onChange={(e) => setMsgTexts((prev) => ({ ...prev, [activeMsg]: e.target.value }))}
                      rows={8}
                      className="text-sm font-mono resize-none"
                      placeholder="Type your message..."
                    />
                  </div>

                  <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 space-y-1">
                    <p className="font-semibold">Compliance reminder:</p>
                    <p>All messages must include opt-out language (e.g. "Reply STOP to opt out"). TextBelt handles STOP replies automatically.</p>
                  </div>

                  <div className="flex gap-2 pt-2 flex-wrap">
                    <Button
                      className="flex-1 bg-[#ff6b35] hover:bg-[#ff6b35]/90 gap-2 min-w-[140px]"
                      disabled={selectedContactIds.length === 0}
                      onClick={() => { setSendTarget("selected"); setSendDialogOpen(true); }}
                    >
                      <Send className="h-4 w-4" />
                      Send to {selectedContactIds.length} selected
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2 min-w-[140px]"
                      disabled={activeContacts.length === 0}
                      onClick={() => { setSendTarget("all"); setSendDialogOpen(true); }}
                    >
                      <Send className="h-4 w-4" />
                      Send to all ({activeContacts.length})
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2 min-w-[140px] border-[#1e3a5f] text-[#1e3a5f]"
                      disabled={selectedContactIds.length === 0 && activeContacts.length === 0}
                      onClick={() => { setScheduleTarget(selectedContactIds.length > 0 ? "selected" : "all"); setScheduleDialogOpen(true); }}
                    >
                      <CalendarClock className="h-4 w-4" />
                      Schedule Send
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Preview & Stats */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Message Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm p-4 text-sm text-gray-800 leading-relaxed">
                      {msgTexts[activeMsg]
                        .replace(/\{\{contact\.firstname\}\}/gi, "John")
                        .replace(/\{\{firstName\}\}/gi, "John")}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Preview with "John" as first name</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      TextBelt Quota
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {quota ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Texts remaining</span>
                          <span className="text-2xl font-bold text-[#1e3a5f]">{quota.quotaRemaining}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          Sending to {sendTarget === "all" ? activeContacts.length : selectedContactIds.length} contacts will use {sendTarget === "all" ? activeContacts.length : selectedContactIds.length} credits
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Loading quota...</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Drip Schedule</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { day: "Day 1", label: "Initial Outreach", desc: "Send today — introduce rebate offer", color: "bg-green-500" },
                      { day: "Day 4", label: "Follow-Up", desc: "No response? Re-engage with energy savings angle", color: "bg-yellow-500" },
                      { day: "Day 10", label: "Final Reminder", desc: "Last chance — urgency + rebate deadline", color: "bg-red-500" },
                    ].map((item) => (
                      <div key={item.day} className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${item.color}`} />
                        <div>
                          <div className="text-sm font-semibold text-gray-800">{item.day} — {item.label}</div>
                          <div className="text-xs text-gray-500">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ── SCHEDULED TAB ── */}
          <TabsContent value="scheduled">
            <ScheduledSendsTab />
          </TabsContent>

          {/* ── HISTORY TAB ── */}
          <TabsContent value="history">
            <SendHistoryTab />
          </TabsContent>

          {/* ── OPT-OUT SETUP TAB ── */}
          <TabsContent value="settings">
            <OptOutSetupTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Send Confirmation Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-[#ff6b35]" />
              Confirm Send
            </DialogTitle>
            <DialogDescription>
              You are about to send <strong>Message {activeMsg}</strong> ({activeMsg === 1 ? "Day 1 — Initial" : activeMsg === 2 ? "Day 4 — Follow-Up" : "Day 10 — Final"}) to{" "}
              <strong>
                {sendTarget === "all" ? activeContacts.length : selectedContactIds.filter((id) => {
                  const c = filteredContacts.find((x) => x.id === id);
                  return c && !c.optedOut;
                }).length} contacts
              </strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            <p className="text-xs text-gray-400">Preview (personalized for first contact):</p>
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 max-h-32 overflow-y-auto font-mono text-xs">
              {(() => {
                const firstContact = sendTarget === "all"
                  ? activeContacts[0]
                  : filteredContacts.find((c) => selectedContactIds.includes(c.id) && !c.optedOut);
                const name = firstContact?.firstName ?? "[Name]";
                return msgTexts[activeMsg]
                  .replace(/\{\{contact\.firstname\}\}/gi, name)
                  .replace(/\{\{firstName\}\}/gi, name);
              })()}
            </div>
          </div>

          {sendResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 text-green-700 font-semibold"><CheckCircle2 className="h-4 w-4" /> Send complete</div>
              <div className="text-sm text-green-600">Sent: {sendResult.sent} · Failed: {sendResult.failed} · Skipped: {sendResult.skipped}</div>
              {sendResult.quotaRemaining !== undefined && (
                <div className="text-xs text-green-500">Quota remaining: {sendResult.quotaRemaining}</div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setSendDialogOpen(false); setSendResult(null); }}>
              {sendResult ? "Close" : "Cancel"}
            </Button>
            {!sendResult && (
              <Button
                className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 gap-2"
                onClick={handleSend}
                disabled={isSending}
              >
                {isSending ? <><RefreshCw className="h-4 w-4 animate-spin" /> Sending...</> : <><Send className="h-4 w-4" /> Send Now</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Send Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={(open) => { setScheduleDialogOpen(open); if (!open) setScheduleResult(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-[#1e3a5f]" />
              Schedule Send — Message {activeMsg} ({activeMsg === 1 ? "Day 1" : activeMsg === 2 ? "Day 4" : "Day 10"})
            </DialogTitle>
            <DialogDescription>
              Choose a date and time. The server will automatically send the message to all eligible contacts at that time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Date</Label>
                <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Time</Label>
                <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
              <p className="font-semibold mb-1">Sending to:</p>
              <p>{scheduleTarget === "all" ? `All ${activeContacts.length} active contacts` : `${selectedContactIds.length} selected contacts`}</p>
              {scheduledDate && scheduledTime && (
                <p className="mt-1 text-blue-600">Scheduled for: {new Date(`${scheduledDate}T${scheduledTime}:00`).toLocaleString()}</p>
              )}
            </div>

            {scheduleResult && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-700 font-semibold"><CheckCircle2 className="h-4 w-4" /> Scheduled!</div>
                <p className="text-sm text-green-600 mt-1">{scheduleResult.scheduled} messages queued. Check the Scheduled tab to monitor or cancel.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setScheduleDialogOpen(false); setScheduleResult(null); }}>
              {scheduleResult ? "Close" : "Cancel"}
            </Button>
            {!scheduleResult && (
              <Button
                className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 gap-2"
                onClick={handleScheduleSend}
                disabled={isScheduling}
              >
                {isScheduling ? <><RefreshCw className="h-4 w-4 animate-spin" /> Scheduling...</> : <><CalendarClock className="h-4 w-4" /> Schedule</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send History — {selectedContactForHistory?.firstName} {selectedContactForHistory?.lastName}</DialogTitle>
          </DialogHeader>
          {sendHistory.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No messages sent yet</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {sendHistory.map((s) => (
                <div key={s.id} className="border rounded-lg p-3 text-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium">Message {s.messageNum} (Day {s.messageNum === 1 ? 1 : s.messageNum === 2 ? 4 : 10})</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "sent" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {s.status}
                    </span>
                  </div>
                  <p className="text-gray-600 text-xs line-clamp-2">{s.messageText}</p>
                  <p className="text-gray-400 text-xs mt-1">{new Date(s.sentAt).toLocaleString()}</p>
                  {s.errorMessage && <p className="text-red-500 text-xs mt-1">{s.errorMessage}</p>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── EDIT CONTACT DIALOG ── */}
      <Dialog open={!!editContact} onOpenChange={(o) => { if (!o) setEditContact(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>Update contact details. Phone will be auto-formatted to +1 US format.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">First Name</Label>
                <Input value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Last Name</Label>
                <Input value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Phone Number</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} placeholder="e.g. 9731234567 or +19731234567" className="h-8 text-sm" />
              <p className="text-xs text-gray-400 mt-0.5">Enter 10-digit number — +1 is added automatically</p>
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">ZIP Code</Label>
                <Input value={editForm.zip} onChange={(e) => setEditForm((f) => ({ ...f, zip: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Segment</Label>
                <Select value={editForm.segment} onValueChange={(v) => setEditForm((f) => ({ ...f, segment: v as "A" | "B" | "C" }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Segment A (SQL)</SelectItem>
                    <SelectItem value="B">Segment B (NJ Lead)</SelectItem>
                    <SelectItem value="C">Segment C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Lead Status</Label>
              <Input value={editForm.leadStatus} onChange={(e) => setEditForm((f) => ({ ...f, leadStatus: e.target.value }))} className="h-8 text-sm" placeholder="e.g. CONNECTED, ATTEMPTED_TO_CONTACT" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditContact(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateContactMutation.isPending} className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90">
              {updateContactMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScheduledSendsTab() {
  const { data: scheduled = [], isLoading, refetch } = trpc.smsCampaigns.listScheduledSends.useQuery({ status: "all" });
  const { toast } = useToast();
  const cancelMutation = trpc.smsCampaigns.cancelScheduledSend.useMutation({
    onSuccess: () => { refetch(); toast({ title: "Scheduled send cancelled" }); },
    onError: (e) => toast({ title: "Cancel failed", description: e.message, variant: "destructive" }),
  });

  const pending = scheduled.filter((s) => s.status === "pending");
  const sent = scheduled.filter((s) => s.status === "sent");
  const failed = scheduled.filter((s) => s.status === "failed");
  const cancelled = scheduled.filter((s) => s.status === "cancelled");

  if (isLoading) return <div className="flex justify-center py-16"><RefreshCw className="animate-spin h-8 w-8 text-gray-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pending", value: pending.length, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Sent", value: sent.length, color: "text-green-600", bg: "bg-green-50" },
          { label: "Failed", value: failed.length, color: "text-red-600", bg: "bg-red-50" },
          { label: "Cancelled", value: cancelled.length, color: "text-gray-500", bg: "bg-gray-50" },
        ].map((stat) => (
          <Card key={stat.label} className={stat.bg}>
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-gray-500 mb-1">{stat.label}</div>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {scheduled.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <CalendarClock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No scheduled sends yet</p>
            <p className="text-gray-400 text-sm mt-1">Use the "Schedule Send" button in the Compose tab to queue messages</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Contact ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Message</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Scheduled For</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {scheduled.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-600">Contact #{s.contactId}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                        Msg {s.messageNum} (Day {s.messageNum === 1 ? 1 : s.messageNum === 2 ? 4 : 10})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{new Date(s.scheduledAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        s.status === "pending" ? "bg-blue-100 text-blue-700" :
                        s.status === "sent" ? "bg-green-100 text-green-700" :
                        s.status === "failed" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {s.status === "pending" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                          onClick={() => cancelMutation.mutate({ id: s.id })}
                        >
                          <Ban className="h-3 w-3" /> Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function OptOutSetupTab() {
  const domain = window.location.origin;
  const webhookUrl = `${domain}/api/sms/reply`;

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-red-500" />
            Automatic Opt-Out (STOP Reply Handler)
          </CardTitle>
          <CardDescription>
            When a contact replies STOP, UNSUBSCRIBE, QUIT, CANCEL, or END, they are automatically marked as opted out and all pending scheduled sends are cancelled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 font-semibold mb-2"><CheckCircle2 className="h-4 w-4" /> Webhook is active at:</div>
            <code className="text-sm bg-white border rounded px-3 py-2 block text-gray-800 break-all">{webhookUrl}</code>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-gray-800">How to configure in TextBelt:</h3>
            <ol className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-2"><span className="font-bold text-[#ff6b35] flex-shrink-0">1.</span> Log in to your TextBelt account at <a href="https://textbelt.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">textbelt.com/dashboard</a></li>
              <li className="flex gap-2"><span className="font-bold text-[#ff6b35] flex-shrink-0">2.</span> Find the <strong>Webhook URL</strong> or <strong>Reply Webhook</strong> setting</li>
              <li className="flex gap-2"><span className="font-bold text-[#ff6b35] flex-shrink-0">3.</span> Paste the URL above into the webhook field</li>
              <li className="flex gap-2"><span className="font-bold text-[#ff6b35] flex-shrink-0">4.</span> Save — TextBelt will now POST to your server whenever a recipient replies</li>
            </ol>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
            <p className="font-semibold mb-1">Opt-out keywords handled automatically:</p>
            <p className="font-mono text-xs">STOP · UNSUBSCRIBE · QUIT · CANCEL · END · OPT-OUT · OPT OUT · REMOVE</p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            <div className="flex items-center gap-2 font-semibold mb-1"><AlertTriangle className="h-4 w-4" /> Note</div>
            <p>TextBelt's reply webhook feature requires a paid plan. If you are on a free/trial plan, opt-outs must be managed manually via the Contacts tab.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SendHistoryTab() {
  const { data: history = [], isLoading } = trpc.smsCampaigns.getSendHistory.useQuery({ limit: 100 });

  const stats = useMemo(() => {
    const sent = history.filter((s) => s.status === "sent").length;
    const failed = history.filter((s) => s.status === "failed").length;
    const msg1 = history.filter((s) => s.messageNum === 1 && s.status === "sent").length;
    const msg2 = history.filter((s) => s.messageNum === 2 && s.status === "sent").length;
    const msg3 = history.filter((s) => s.messageNum === 3 && s.status === "sent").length;
    return { sent, failed, msg1, msg2, msg3 };
  }, [history]);

  if (isLoading) return <div className="flex justify-center py-16"><RefreshCw className="animate-spin h-8 w-8 text-gray-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Sent", value: stats.sent, icon: CheckCircle2, color: "text-green-600" },
          { label: "Failed", value: stats.failed, icon: XCircle, color: "text-red-500" },
          { label: "Day 1 Sent", value: stats.msg1, icon: Clock, color: "text-blue-600" },
          { label: "Day 4 Sent", value: stats.msg2, icon: Clock, color: "text-yellow-600" },
          { label: "Day 10 Sent", value: stats.msg3, icon: Clock, color: "text-orange-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-gray-500">{stat.label}</span>
              </div>
              <div className="text-2xl font-bold text-gray-800">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {history.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No messages sent yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Message</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Quota Left</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Sent At</th>
                </tr>
              </thead>
              <tbody>
                {history.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{s.phone}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                        Msg {s.messageNum} (Day {s.messageNum === 1 ? 1 : s.messageNum === 2 ? 4 : 10})
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 max-w-xs">{s.messageText}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === "sent" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {s.status}
                      </span>
                      {s.errorMessage && <p className="text-xs text-red-500 mt-0.5">{s.errorMessage}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.quotaRemaining ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(s.sentAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  UserPlus, Trash2, RefreshCw, ShieldOff, ShieldCheck, ArrowLeft, Users, Loader2,
  Copy, CheckCircle2, Pencil, Phone, Mail,
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ContactFields } from "@/components/ContactFields";
import {
  emptyContactFields, contactFieldsFrom, contactFieldsToPayload, type ContactFieldsValue,
} from "@/lib/contactOptions";
import { isValidEmail, isValidUsPhone, telHref } from "@shared/validation";

const roleBadge: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  member: "bg-blue-100 text-blue-700",
  viewer: "bg-gray-100 text-gray-700",
};

const statusBadge: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  invited: "bg-yellow-100 text-yellow-700",
  suspended: "bg-red-100 text-red-700",
};

type Role = "admin" | "member" | "viewer";
type FormState = ContactFieldsValue & {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
};

const blankForm: FormState = {
  ...emptyContactFields,
  firstName: "",
  lastName: "",
  email: "",
  role: "member",
};

export default function TeamManagement() {
  const { loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [formError, setFormError] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  const { data: members = [], refetch, isLoading } = trpc.teamAuth.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  const inviteMutation = trpc.teamAuth.invite.useMutation({
    onSuccess: (data) => {
      setGeneratedLink(data.inviteUrl);
      refetch();
    },
    onError: (err) => setFormError(err.message),
  });

  const updateMutation = trpc.teamAuth.update.useMutation({
    onSuccess: () => {
      refetch();
      toast({ title: "Contact details saved." });
      closeDialog();
    },
    onError: (err) => setFormError(err.message),
  });

  const removeMutation = trpc.teamAuth.remove.useMutation({
    onSuccess: () => { refetch(); toast({ title: "Team member removed." }); },
  });

  const statusMutation = trpc.teamAuth.updateStatus.useMutation({
    onSuccess: () => { refetch(); },
  });

  const resendMutation = trpc.teamAuth.resendInvite.useMutation({
    onSuccess: (data) => {
      toast({ title: "New invite link generated", description: data.inviteUrl });
    },
  });

  const openCreate = () => {
    setForm(blankForm);
    setMode("create");
    setEditingId(null);
    setFormError("");
    setGeneratedLink("");
    setDialogOpen(true);
  };

  const openEdit = async (id: number) => {
    setFormError("");
    setGeneratedLink("");
    try {
      const p = await utils.teamAuth.get.fetch({ id });
      setForm({
        ...contactFieldsFrom(p),
        firstName: p.firstName ?? "",
        lastName: p.lastName ?? "",
        email: p.email,
        role: p.role,
      });
      setMode("edit");
      setEditingId(id);
      setDialogOpen(true);
    } catch {
      toast({ title: "Could not load that team member.", variant: "destructive" });
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setForm(blankForm);
    setEditingId(null);
    setFormError("");
    setGeneratedLink("");
  };

  const validate = (): string | null => {
    if (!form.firstName.trim()) return "First name is required.";
    if (!form.lastName.trim()) return "Last name is required.";
    if (mode === "create" && !isValidEmail(form.email)) return "Enter a valid work email address.";
    if (!isValidUsPhone(form.mobilePhone)) return "Enter a valid 10-digit US mobile phone number.";
    if (form.emergencyContactPhone.trim() && !isValidUsPhone(form.emergencyContactPhone)) {
      return "The emergency contact phone isn't a valid US number.";
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setGeneratedLink("");
    const err = validate();
    if (err) { setFormError(err); return; }

    const contact = contactFieldsToPayload(form);
    if (mode === "create") {
      const { mobilePhone, ...rest } = contact; // mobilePhone is required (non-null) on create
      inviteMutation.mutate({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        role: form.role,
        origin: window.location.origin,
        mobilePhone: (mobilePhone ?? "").trim(),
        ...rest,
      });
    } else if (editingId != null) {
      // Work email + role stay read-only in edit mode so login access and
      // permissions are never changed by this form.
      updateMutation.mutate({
        id: editingId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        ...contact,
      });
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const busy = inviteMutation.isPending || updateMutation.isPending;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/command-center">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="w-4 h-4" /> Command Center
            </Button>
          </Link>
          <div className="w-px h-5 bg-border" />
          <Users className="w-5 h-5 text-[#1e3a5f]" />
          <div>
            <h1 className="text-lg font-bold text-[#1e3a5f]">Team Access</h1>
            <p className="text-xs text-muted-foreground">Manage who can access the dashboard</p>
          </div>
        </div>
        <Button className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 gap-2" onClick={openCreate}>
          <UserPlus className="w-4 h-4" /> Add Technician
        </Button>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => (o ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add a Technician" : "Edit Contact Details"}</DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Fill in their details. They'll get an invite link to set a password and access the app."
                : "Update this technician's contact details. Login email and role are managed separately."}
            </DialogDescription>
          </DialogHeader>

          {generatedLink ? (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  Technician added! Copy the invite link below and send it to <strong>{form.email}</strong>.
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Input value={generatedLink} readOnly className="text-xs font-mono" />
                <Button variant="outline" size="icon" onClick={copyLink}>
                  {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={closeDialog} className="w-full">Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {formError && (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              {/* Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="tm-first">First name</Label>
                  <Input id="tm-first" value={form.firstName} onChange={(e) => patch({ firstName: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tm-last">Last name</Label>
                  <Input id="tm-last" value={form.lastName} onChange={(e) => patch({ lastName: e.target.value })} required />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="tm-email">Work email</Label>
                  <Input
                    id="tm-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => patch({ email: e.target.value })}
                    disabled={mode === "edit"}
                    required={mode === "create"}
                  />
                  {mode === "edit" && (
                    <p className="text-xs text-muted-foreground">Login email can't be changed here.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tm-role">Role</Label>
                  {mode === "create" ? (
                    <Select value={form.role} onValueChange={(v) => patch({ role: v as Role })}>
                      <SelectTrigger id="tm-role"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin — full access</SelectItem>
                        <SelectItem value="member">Member — standard access</SelectItem>
                        <SelectItem value="viewer">Viewer — read-only</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-10 flex items-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge[form.role] ?? ""}`}>
                        {form.role}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">Permissions unchanged</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-semibold mb-3">Contact Details</p>
                <ContactFields value={form} onChange={patch} idPrefix="tm" />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button type="submit" className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90" disabled={busy}>
                  {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {mode === "create" ? "Generate Invite Link" : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Team Members
              <Badge variant="secondary" className="ml-2">{members.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No team members yet</p>
                <p className="text-sm mt-1">Add a technician to give them access.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Sign In</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => {
                      const tel = telHref(m.mobilePhone);
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.name}</TableCell>
                          <TableCell className="text-sm">
                            {m.mobilePhone && tel ? (
                              <a href={`tel:${tel}`} className="inline-flex items-center gap-1 text-[#1e3a5f] hover:underline">
                                <Phone className="w-3.5 h-3.5" /> {m.mobilePhone}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1 text-[#1e3a5f] hover:underline">
                              <Mail className="w-3.5 h-3.5" /> {m.email}
                            </a>
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge[m.role] ?? ""}`}>
                              {m.role}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[m.status] ?? ""}`}>
                              {m.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {m.lastSignedIn ? new Date(m.lastSignedIn).toLocaleDateString() : "Never"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" title="Edit contact details" onClick={() => openEdit(m.id)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {m.status === "invited" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Resend invite"
                                  onClick={() => resendMutation.mutate({ id: m.id, origin: window.location.origin })}
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </Button>
                              )}
                              {m.status === "active" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Suspend"
                                  onClick={() => statusMutation.mutate({ id: m.id, status: "suspended" })}
                                >
                                  <ShieldOff className="w-4 h-4 text-orange-500" />
                                </Button>
                              )}
                              {m.status === "suspended" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Reactivate"
                                  onClick={() => statusMutation.mutate({ id: m.id, status: "active" })}
                                >
                                  <ShieldCheck className="w-4 h-4 text-green-600" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Remove"
                                onClick={() => {
                                  if (confirm(`Remove ${m.name} from the team?`)) {
                                    removeMutation.mutate({ id: m.id });
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* How it works */}
        <Card className="mt-4 border-dashed">
          <CardContent className="pt-4">
            <h3 className="font-semibold text-sm mb-3">How team access works</h3>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Click <strong>Add Technician</strong> and fill in their name, work email, mobile phone, and contact details.</li>
              <li>Copy the generated invite link and send it to them directly (email, text, etc.).</li>
              <li>They click the link, set their password, and are immediately logged in.</li>
              <li>Technicians can keep their own phone, address, emergency contact, and photo up to date from the field app under <strong>My Profile</strong>.</li>
              <li>Use the <strong>pencil</strong> icon to edit contact details, or suspend/remove access at any time.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

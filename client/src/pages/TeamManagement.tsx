import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  UserPlus, Trash2, RefreshCw, ShieldOff, ShieldCheck, ArrowLeft, Users, Loader2, Copy, CheckCircle2,
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

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

export default function TeamManagement() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [inviteError, setInviteError] = useState("");
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

  const inviteMutation = trpc.teamAuth.invite.useMutation({
    onSuccess: (data) => {
      setGeneratedLink(data.inviteUrl);
      refetch();
    },
    onError: (err) => setInviteError(err.message),
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

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");
    setGeneratedLink("");
    inviteMutation.mutate({
      email: inviteEmail,
      name: inviteName,
      role: inviteRole,
      origin: window.location.origin,
    });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetInviteForm = () => {
    setInviteEmail("");
    setInviteName("");
    setInviteRole("member");
    setInviteError("");
    setGeneratedLink("");
    setInviteOpen(false);
  };

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
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 gap-2">
              <UserPlus className="w-4 h-4" /> Invite Team Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite a Team Member</DialogTitle>
              <DialogDescription>
                They will receive an invite link to set their password and access the dashboard.
              </DialogDescription>
            </DialogHeader>
            {generatedLink ? (
              <div className="space-y-4">
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    Invite created! Copy the link below and send it to <strong>{inviteEmail}</strong>.
                  </AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Input value={generatedLink} readOnly className="text-xs font-mono" />
                  <Button variant="outline" size="icon" onClick={copyLink}>
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <DialogFooter>
                  <Button onClick={resetInviteForm} className="w-full">Done</Button>
                </DialogFooter>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                {inviteError && (
                  <Alert variant="destructive">
                    <AlertDescription>{inviteError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    placeholder="Jane Smith"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    placeholder="jane@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin — full access</SelectItem>
                      <SelectItem value="member">Member — standard access</SelectItem>
                      <SelectItem value="viewer">Viewer — read-only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetInviteForm}>Cancel</Button>
                  <Button
                    type="submit"
                    className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90"
                    disabled={inviteMutation.isPending}
                  >
                    {inviteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Generate Invite Link
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

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
                <p className="text-sm mt-1">Invite someone to give them dashboard access.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Sign In</TableHead>
                    <TableHead>Invited By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>
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
                        {m.lastSignedIn
                          ? new Date(m.lastSignedIn).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.invitedBy}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
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
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* How it works */}
        <Card className="mt-4 border-dashed">
          <CardContent className="pt-4">
            <h3 className="font-semibold text-sm mb-3">How team access works</h3>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Click <strong>Invite Team Member</strong> and fill in their name, email, and role.</li>
              <li>Copy the generated invite link and send it to them directly (email, text, etc.).</li>
              <li>They click the link, set their password, and are immediately logged in.</li>
              <li>To reset a password, they go to <strong>/team-login</strong> and click "Forgot password?" — you'll receive a notification with their reset link to forward.</li>
              <li>You can suspend or remove access at any time from this page.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

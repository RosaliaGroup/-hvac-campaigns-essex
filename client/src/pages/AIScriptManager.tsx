import { useState } from "react";
import InternalNav from "@/components/InternalNav";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Copy, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

type ScriptCategory = "master" | "residential" | "commercial" | "vrv_vrf" | "objections" | "custom";

const categoryLabels: Record<ScriptCategory, string> = {
  master: "Master Prompt",
  residential: "Residential",
  commercial: "Commercial",
  vrv_vrf: "VRV/VRF Systems",
  objections: "Objection Handling",
  custom: "Custom",
};

const categoryColors: Record<ScriptCategory, string> = {
  master: "bg-[#ff6b35] text-white",
  residential: "bg-blue-500 text-white",
  commercial: "bg-green-500 text-white",
  vrv_vrf: "bg-purple-500 text-white",
  objections: "bg-orange-500 text-white",
  custom: "bg-gray-500 text-white",
};

export default function AIScriptManager() {
  const { user, loading: authLoading } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedScript, setSelectedScript] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ScriptCategory>("custom");
  const [content, setContent] = useState("");

  // Fetch all scripts
  const { data: scripts, refetch } = trpc.aiScripts.getAll.useQuery();

  // Mutations
  const createMutation = trpc.aiScripts.create.useMutation({
    onSuccess: () => {
      toast.success("Script created successfully!");
      refetch();
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Failed to create script: ${error.message}`);
    },
  });

  const updateMutation = trpc.aiScripts.update.useMutation({
    onSuccess: () => {
      toast.success("Script updated successfully!");
      refetch();
      setIsEditDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Failed to update script: ${error.message}`);
    },
  });

  const deleteMutation = trpc.aiScripts.delete.useMutation({
    onSuccess: () => {
      toast.success("Script deleted successfully!");
      refetch();
      setIsDeleteDialogOpen(false);
      setSelectedScript(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete script: ${error.message}`);
    },
  });

  const resetForm = () => {
    setTitle("");
    setCategory("custom");
    setContent("");
    setSelectedScript(null);
  };

  const handleCreate = () => {
    if (!title || !content) {
      toast.error("Please fill in all required fields");
      return;
    }

    createMutation.mutate({
      title,
      category,
      content,
      isActive: true,
    });
  };

  const handleEdit = (script: any) => {
    setSelectedScript(script);
    setTitle(script.title);
    setCategory(script.category);
    setContent(script.content);
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedScript || !title || !content) {
      toast.error("Please fill in all required fields");
      return;
    }

    updateMutation.mutate({
      id: selectedScript.id,
      title,
      category,
      content,
    });
  };

  const handleDelete = (script: any) => {
    setSelectedScript(script);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedScript) {
      deleteMutation.mutate({ id: selectedScript.id });
    }
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Script copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#ff6b35]" />
      </div>
    );
  }

  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }

  return (
    <div className="min-h-screen bg-secondary/30 py-8">
      <InternalNav />
      <div className="container max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-[#1e3a5f] mb-2">AI Script Manager</h1>
            <p className="text-muted-foreground">
              Create, edit, and manage custom Vapi AI assistant scripts
            </p>
          </div>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-[#ff6b35] hover:bg-[#ff6b35]/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Script
          </Button>
        </div>

        {scripts && scripts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No scripts yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first AI assistant script to get started
              </p>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-[#ff6b35] hover:bg-[#ff6b35]/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Script
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {scripts?.map((script) => (
              <Card key={script.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-xl">{script.title}</CardTitle>
                        <Badge className={categoryColors[script.category as ScriptCategory]}>
                          {categoryLabels[script.category as ScriptCategory]}
                        </Badge>
                      </div>
                      <CardDescription>
                        Created {new Date(script.createdAt).toLocaleDateString()} • Updated{" "}
                        {new Date(script.updatedAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(script.content, script.id)}
                      >
                        {copiedId === script.id ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(script)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(script)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-secondary/30 p-4 rounded-lg">
                    <pre className="text-sm whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                      {script.content}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Script</DialogTitle>
              <DialogDescription>
                Add a new AI assistant script for your Vapi integration
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="create-title">Title *</Label>
                <Input
                  id="create-title"
                  placeholder="e.g., Emergency HVAC Response Script"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-category">Category *</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as ScriptCategory)}>
                  <SelectTrigger id="create-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-content">Script Content *</Label>
                <Textarea
                  id="create-content"
                  placeholder="Enter your AI assistant script here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={15}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsCreateDialogOpen(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="bg-[#ff6b35] hover:bg-[#ff6b35]/90"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Script
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Script</DialogTitle>
              <DialogDescription>
                Update your AI assistant script
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title *</Label>
                <Input
                  id="edit-title"
                  placeholder="e.g., Emergency HVAC Response Script"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category *</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as ScriptCategory)}>
                  <SelectTrigger id="edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-content">Script Content *</Label>
                <Textarea
                  id="edit-content"
                  placeholder="Enter your AI assistant script here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={15}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsEditDialogOpen(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={updateMutation.isPending}
                className="bg-[#ff6b35] hover:bg-[#ff6b35]/90"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the script "{selectedScript?.title}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setIsDeleteDialogOpen(false);
                setSelectedScript(null);
              }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

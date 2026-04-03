import { useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Zap,
  Plus,
  Trash2,
  FolderOpen,
  DollarSign,
  BarChart3,
  FileText,
  MapPin,
} from "lucide-react";

const DISCIPLINES = ["HVAC", "Plumbing", "Electrical", "Fire Protection", "Controls"];

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function TakeOffAI() {
  const [, setLocation] = useLocation();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newDiscipline, setNewDiscipline] = useState("HVAC");

  const { data: projects = [], isLoading, refetch } = trpc.takeoffs.list.useQuery();
  const createMutation = trpc.takeoffs.create.useMutation({
    onSuccess: (data) => {
      setShowNew(false);
      setNewName("");
      setNewLocation("");
      setLocation(`/takeoff-ai/${data.id}`);
    },
  });
  const deleteMutation = trpc.takeoffs.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const totalBid = projects.reduce((s, p) => s + (p.directCost || 0), 0);
  const avgBid = projects.length > 0 ? totalBid / projects.length : 0;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              AI Take-Off &amp; Estimating
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your mechanical take-off projects
            </p>
          </div>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Take-Off
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <FolderOpen className="h-8 w-8 text-primary/30" />
              <div>
                <p className="text-2xl font-bold">{projects.length}</p>
                <p className="text-xs text-muted-foreground">Projects</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-500/30" />
              <div>
                <p className="text-2xl font-bold">{fmt(totalBid)}</p>
                <p className="text-xs text-muted-foreground">Total Direct Cost</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-blue-500/30" />
              <div>
                <p className="text-2xl font-bold">{fmt(avgBid)}</p>
                <p className="text-xs text-muted-foreground">Avg Project Cost</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* New project form */}
        {showNew && (
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">New Take-Off Project</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Project name (e.g. Building 7 HVAC)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Location"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="flex-1"
                />
                <Select value={newDiscipline} onValueChange={setNewDiscipline}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISCIPLINES.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!newName.trim() || createMutation.isPending}
                  onClick={() =>
                    createMutation.mutate({
                      name: newName.trim(),
                      location: newLocation,
                      discipline: newDiscipline,
                    })
                  }
                >
                  Create &amp; Open
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Projects table */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Loading projects…
          </div>
        ) : projects.length === 0 && !showNew ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold mb-1">No take-off projects yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first project, upload drawings, and let AI extract quantities.
              </p>
              <Button onClick={() => setShowNew(true)}>
                <Plus className="h-4 w-4 mr-1" /> New Take-Off
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="text-left px-4 py-2.5 font-medium">Project</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Location</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Discipline</th>
                  <th className="text-right px-4 py-2.5 font-medium">Items</th>
                  <th className="text-right px-4 py-2.5 font-medium">Direct Cost</th>
                  <th className="text-center px-4 py-2.5 font-medium">Status</th>
                  <th className="text-right px-4 py-2.5 font-medium hidden lg:table-cell">Created</th>
                  <th className="w-[80px]" />
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t hover:bg-accent/30 cursor-pointer"
                    onClick={() => setLocation(`/takeoff-ai/${p.id}`)}
                  >
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">
                      {p.location ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {p.location}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden lg:table-cell">
                      {p.discipline || "HVAC"}
                    </td>
                    <td className="px-4 py-2.5 text-right">{p.itemCount}</td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {fmt(p.directCost || 0)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge
                        variant="outline"
                        className={
                          p.status === "complete"
                            ? "border-green-300 text-green-700 bg-green-50"
                            : "border-yellow-300 text-yellow-700 bg-yellow-50"
                        }
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground text-xs hidden lg:table-cell">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${p.name}"?`)) {
                            deleteMutation.mutate({ id: p.id });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

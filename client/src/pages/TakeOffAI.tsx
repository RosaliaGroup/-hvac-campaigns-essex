import { useState, useRef, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Zap,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Info,
  Download,
  Plus,
  Trash2,
  RefreshCw,
  DollarSign,
  BarChart3,
  Wrench,
  Wind,
  Thermometer,
  Package,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type Category =
  | "MACHINERY"
  | "SHEET METAL"
  | "COPPER"
  | "INSULATION"
  | "AIR DEVICES"
  | "ACCESSORIES"
  | "LABOR"
  | "OTHER";

interface TakeOffRow {
  id: string;
  category: Category;
  description: string;
  tag: string;
  qty: number;
  unit: string;
  vendor: string;
  model: string;
  specs: string;
  source: string;
  confidence: number;
  unitPrice: number;
  notes: string;
}

interface Finding {
  id: string;
  severity: "info" | "warning" | "error";
  title: string;
  detail: string;
}

interface UploadedFile {
  name: string;
  type: string;
  size: number;
  base64: string;
  status: "ready" | "uploading" | "done" | "error";
}

interface Margins {
  materials: number;
  labor: number;
  overhead: number;
  profit: number;
  contingency: number;
  tax: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  "MACHINERY",
  "SHEET METAL",
  "COPPER",
  "INSULATION",
  "AIR DEVICES",
  "ACCESSORIES",
  "LABOR",
  "OTHER",
];

const CATEGORY_COLORS: Record<Category, string> = {
  MACHINERY: "bg-blue-100 text-blue-800 border-blue-200",
  "SHEET METAL": "bg-orange-100 text-orange-800 border-orange-200",
  COPPER: "bg-amber-100 text-amber-800 border-amber-200",
  INSULATION: "bg-purple-100 text-purple-800 border-purple-200",
  "AIR DEVICES": "bg-indigo-100 text-indigo-800 border-indigo-200",
  ACCESSORIES: "bg-green-100 text-green-800 border-green-200",
  LABOR: "bg-teal-100 text-teal-800 border-teal-200",
  OTHER: "bg-gray-100 text-gray-800 border-gray-200",
};

const DISCIPLINES = [
  "HVAC",
  "Plumbing",
  "Electrical",
  "Fire Protection",
  "Controls",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function emptyRow(): TakeOffRow {
  return {
    id: uid(),
    category: "OTHER",
    description: "",
    tag: "",
    qty: 1,
    unit: "EA",
    vendor: "",
    model: "",
    specs: "",
    source: "",
    confidence: 0,
    unitPrice: 0,
    notes: "",
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TakeOffAI() {
  // files & analysis state
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [rows, setRows] = useState<TakeOffRow[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  // project settings
  const [projectName, setProjectName] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [discipline, setDiscipline] = useState("HVAC");
  const [instructions, setInstructions] = useState("");

  // table controls
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");

  // margins
  const [margins, setMargins] = useState<Margins>({
    materials: 20,
    labor: 35,
    overhead: 12,
    profit: 10,
    contingency: 5,
    tax: 6.625,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // ── Log helper ───────────────────────────────────────────────────────────
  const log = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${ts}] ${msg}`]);
  }, []);

  // ── File handling ────────────────────────────────────────────────────────
  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList) return;
      const accepted = Array.from(fileList).filter(
        (f) =>
          f.type === "application/pdf" ||
          f.type.startsWith("image/")
      );
      for (const f of accepted) {
        log(`Adding file: ${f.name}`);
        const base64 = await fileToBase64(f);
        setFiles((prev) => [
          ...prev,
          { name: f.name, type: f.type, size: f.size, base64, status: "ready" },
        ]);
      }
    },
    [log]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f.name !== name));

  // ── Claude analysis ──────────────────────────────────────────────────────
  const analyzeWithClaude = async () => {
    if (files.length === 0) {
      log("No files to analyze.");
      return;
    }
    setAnalyzing(true);
    log("Starting AI analysis…");

    try {
      const file = files[0];
      log(`Sending ${file.name} to Claude via serverless function…`);
      const res = await fetch("/.netlify/functions/takeoff-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: file.base64,
          fileType: file.type,
          projName: projectName,
          discipline,
          location: projectLocation,
          instructions,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errBody.error || `API ${res.status}`);
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      log("Response received — parsing…");

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response.");

      const parsed = JSON.parse(jsonMatch[0]);
      const newRows: TakeOffRow[] = (parsed.items || []).map((item: any) => ({
        id: uid(),
        category: CATEGORIES.includes(item.category) ? item.category : "OTHER",
        description: item.description || "",
        tag: item.tag || "",
        qty: Number(item.qty) || 1,
        unit: item.unit || "EA",
        vendor: item.vendor || "",
        model: item.model || "",
        specs: item.specs || "",
        source: item.source || "",
        confidence: typeof item.confidence === "string"
          ? ({ high: 90, med: 60, low: 30 } as Record<string, number>)[item.confidence] ?? 0
          : Number(item.confidence) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        notes: item.notes || "",
      }));

      const newFindings: Finding[] = (parsed.findings || []).map((f: any) => ({
        id: uid(),
        severity: (f.type === "warning" ? "warning" : f.type === "alert" ? "error" : "info") as Finding["severity"],
        title: f.title || "",
        detail: f.body || f.detail || "",
      }));

      setRows(newRows);
      setFindings(newFindings);
      log(`Parsed ${newRows.length} line items, ${newFindings.length} findings.`);
    } catch (err: any) {
      log(`Error: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Row editing ──────────────────────────────────────────────────────────
  const updateRow = (id: string, field: keyof TakeOffRow, value: any) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const deleteRow = (id: string) =>
    setRows((prev) => prev.filter((r) => r.id !== id));

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  // ── Filtering ────────────────────────────────────────────────────────────
  const filteredRows = rows.filter((r) => {
    const matchSearch =
      !search ||
      r.description.toLowerCase().includes(search.toLowerCase()) ||
      r.tag.toLowerCase().includes(search.toLowerCase()) ||
      r.vendor.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "ALL" || r.category === filterCategory;
    return matchSearch && matchCat;
  });

  const groupedRows = CATEGORIES.reduce<Record<string, TakeOffRow[]>>(
    (acc, cat) => {
      const catRows = filteredRows.filter((r) => r.category === cat);
      if (catRows.length > 0) acc[cat] = catRows;
      return acc;
    },
    {}
  );

  // ── Bid calculation ──────────────────────────────────────────────────────
  const matCost = rows
    .filter((r) => r.category !== "LABOR")
    .reduce((s, r) => s + r.qty * r.unitPrice, 0);
  const laborCost = rows
    .filter((r) => r.category === "LABOR")
    .reduce((s, r) => s + r.qty * r.unitPrice, 0);

  const matMarkup = matCost * (margins.materials / 100);
  const laborBurden = laborCost * (margins.labor / 100);
  const subtotal = matCost + matMarkup + laborCost + laborBurden;
  const withOverhead = subtotal * (1 + margins.overhead / 100);
  const withContingency = withOverhead * (1 + margins.contingency / 100);
  const withProfit = withContingency * (1 + margins.profit / 100);
  const taxAmount = matMarkup * (margins.tax / 100);
  const bidPrice = withProfit + taxAmount;

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  // ── Export CSV ───────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = [
      "Category",
      "Description",
      "Tag",
      "Qty",
      "Unit",
      "Unit Price",
      "Ext Price",
      "Vendor",
      "Model",
      "Specs",
      "Source",
      "Confidence",
      "Notes",
    ];
    const csvRows = rows.map((r) =>
      [
        r.category,
        `"${r.description}"`,
        r.tag,
        r.qty,
        r.unit,
        r.unitPrice,
        (r.qty * r.unitPrice).toFixed(2),
        `"${r.vendor}"`,
        `"${r.model}"`,
        `"${r.specs}"`,
        `"${r.source}"`,
        r.confidence,
        `"${r.notes}"`,
      ].join(",")
    );
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName || "takeoff"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ───────────────────────────────────────────────────────────────
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
              Upload plans, let AI extract quantities, then build your bid.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={rows.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
          {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            {/* Upload zone */}
            <Card>
              <CardContent className="p-4">
                <div
                  ref={dropRef}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">
                    Drop PDF or images here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or click to browse
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </div>

                {files.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {files.map((f) => (
                      <div
                        key={f.name}
                        className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1.5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{f.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {(f.size / 1024).toFixed(0)}KB
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(f.name);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Project settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  Project Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Project name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
                <Input
                  placeholder="Location"
                  value={projectLocation}
                  onChange={(e) => setProjectLocation(e.target.value)}
                />
                <Select value={discipline} onValueChange={setDiscipline}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISCIPLINES.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
                  placeholder="Additional instructions for the AI…"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
                <Button
                  className="w-full"
                  onClick={analyzeWithClaude}
                  disabled={analyzing || files.length === 0}
                >
                  {analyzing ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  {analyzing ? "Analyzing…" : "Analyze with AI"}
                </Button>
                {analyzing && <Progress value={undefined} className="h-1" />}
              </CardContent>
            </Card>

            {/* Log panel */}
            <Card className="bg-zinc-950 text-zinc-300 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono text-zinc-500">
                  LOG
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[180px] px-4 pb-3">
                  {logs.length === 0 ? (
                    <p className="text-xs text-zinc-600 font-mono">
                      Waiting for activity…
                    </p>
                  ) : (
                    logs.map((l, i) => (
                      <p key={i} className="text-xs font-mono leading-5">
                        {l}
                      </p>
                    ))
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT PANEL ─────────────────────────────────────────────── */}
          <Tabs defaultValue="takeoff" className="flex flex-col">
            <TabsList className="w-fit">
              <TabsTrigger value="takeoff" className="gap-1.5">
                <Wrench className="h-3.5 w-3.5" /> Take-Off
              </TabsTrigger>
              <TabsTrigger value="summary" className="gap-1.5">
                <DollarSign className="h-3.5 w-3.5" /> Summary
              </TabsTrigger>
              <TabsTrigger value="findings" className="gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Findings
                {findings.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {findings.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Take-Off Tab ──────────────────────────────────────────── */}
            <TabsContent value="takeoff" className="flex-1 mt-3">
              <Card>
                <CardContent className="p-4">
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Input
                      placeholder="Search items…"
                      className="max-w-[220px] h-8 text-sm"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <Select
                      value={filterCategory}
                      onValueChange={setFilterCategory}
                    >
                      <SelectTrigger className="w-[160px] h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Categories</SelectItem>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="ml-auto">
                      <Button size="sm" variant="outline" onClick={addRow}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
                      </Button>
                    </div>
                  </div>

                  {/* Table */}
                  <ScrollArea className="max-h-[600px]">
                    {Object.keys(groupedRows).length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground">
                        <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
                        <p className="text-sm">
                          No items yet — upload plans and analyze, or add rows
                          manually.
                        </p>
                      </div>
                    ) : (
                      Object.entries(groupedRows).map(([cat, catRows]) => (
                        <div key={cat} className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${CATEGORY_COLORS[cat as Category]}`}
                            >
                              {cat}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {catRows.length} item{catRows.length !== 1 && "s"} ·{" "}
                              {fmt(
                                catRows.reduce(
                                  (s, r) => s + r.qty * r.unitPrice,
                                  0
                                )
                              )}
                            </span>
                          </div>
                          <div className="border rounded-md overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-muted/50 text-muted-foreground">
                                  <th className="text-left px-2 py-1.5 font-medium">
                                    Description
                                  </th>
                                  <th className="text-left px-2 py-1.5 font-medium w-[60px]">
                                    Tag
                                  </th>
                                  <th className="text-right px-2 py-1.5 font-medium w-[50px]">
                                    Qty
                                  </th>
                                  <th className="text-left px-2 py-1.5 font-medium w-[45px]">
                                    Unit
                                  </th>
                                  <th className="text-right px-2 py-1.5 font-medium w-[80px]">
                                    Unit $
                                  </th>
                                  <th className="text-right px-2 py-1.5 font-medium w-[80px]">
                                    Ext $
                                  </th>
                                  <th className="text-center px-2 py-1.5 font-medium w-[40px]">
                                    Conf
                                  </th>
                                  <th className="w-[32px]" />
                                </tr>
                              </thead>
                              <tbody>
                                {catRows.map((r) => (
                                  <tr
                                    key={r.id}
                                    className="border-t hover:bg-accent/30"
                                  >
                                    <td className="px-2 py-1">
                                      <Input
                                        className="h-6 text-xs border-0 shadow-none p-0"
                                        value={r.description}
                                        onChange={(e) =>
                                          updateRow(
                                            r.id,
                                            "description",
                                            e.target.value
                                          )
                                        }
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <Input
                                        className="h-6 text-xs border-0 shadow-none p-0"
                                        value={r.tag}
                                        onChange={(e) =>
                                          updateRow(r.id, "tag", e.target.value)
                                        }
                                      />
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                      <Input
                                        type="number"
                                        className="h-6 text-xs border-0 shadow-none p-0 text-right w-full"
                                        value={r.qty}
                                        onChange={(e) =>
                                          updateRow(
                                            r.id,
                                            "qty",
                                            Number(e.target.value)
                                          )
                                        }
                                      />
                                    </td>
                                    <td className="px-2 py-1 text-xs">
                                      {r.unit}
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                      <Input
                                        type="number"
                                        className="h-6 text-xs border-0 shadow-none p-0 text-right w-full"
                                        value={r.unitPrice}
                                        onChange={(e) =>
                                          updateRow(
                                            r.id,
                                            "unitPrice",
                                            Number(e.target.value)
                                          )
                                        }
                                      />
                                    </td>
                                    <td className="px-2 py-1 text-right text-xs font-medium">
                                      {fmt(r.qty * r.unitPrice)}
                                    </td>
                                    <td className="px-2 py-1 text-center">
                                      <Badge
                                        variant="outline"
                                        className={`text-[9px] px-1 ${
                                          r.confidence >= 80
                                            ? "border-green-300 text-green-700"
                                            : r.confidence >= 50
                                            ? "border-yellow-300 text-yellow-700"
                                            : "border-red-300 text-red-700"
                                        }`}
                                      >
                                        {r.confidence}%
                                      </Badge>
                                    </td>
                                    <td className="px-1 py-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0"
                                        onClick={() => deleteRow(r.id)}
                                      >
                                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Summary Tab ───────────────────────────────────────────── */}
            <TabsContent value="summary" className="flex-1 mt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bid price card */}
                <Card className="md:col-span-2 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">
                        Total Bid Price
                      </p>
                      <p className="text-3xl font-bold tracking-tight mt-1">
                        {fmt(bidPrice)}
                      </p>
                    </div>
                    <BarChart3 className="h-10 w-10 text-primary/30" />
                  </CardContent>
                </Card>

                {/* Markup controls */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Markup Controls</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(
                      [
                        ["materials", "Material Markup %"],
                        ["labor", "Labor Burden %"],
                        ["overhead", "Overhead %"],
                        ["profit", "Profit %"],
                        ["contingency", "Contingency %"],
                        ["tax", "Tax %"],
                      ] as const
                    ).map(([key, label]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between"
                      >
                        <label className="text-xs text-muted-foreground">
                          {label}
                        </label>
                        <Input
                          type="number"
                          step="0.1"
                          className="w-[80px] h-7 text-xs text-right"
                          value={margins[key]}
                          onChange={(e) =>
                            setMargins((m) => ({
                              ...m,
                              [key]: Number(e.target.value),
                            }))
                          }
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Cost buildup */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Cost Build-Up</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <table className="w-full text-xs">
                      <tbody className="divide-y">
                        <tr>
                          <td className="py-1.5 text-muted-foreground">
                            Material Cost
                          </td>
                          <td className="py-1.5 text-right font-medium">
                            {fmt(matCost)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 text-muted-foreground">
                            Material Markup
                          </td>
                          <td className="py-1.5 text-right font-medium">
                            {fmt(matMarkup)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 text-muted-foreground">
                            Labor Cost
                          </td>
                          <td className="py-1.5 text-right font-medium">
                            {fmt(laborCost)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 text-muted-foreground">
                            Labor Burden
                          </td>
                          <td className="py-1.5 text-right font-medium">
                            {fmt(laborBurden)}
                          </td>
                        </tr>
                        <Separator className="my-1" />
                        <tr>
                          <td className="py-1.5 text-muted-foreground">
                            Subtotal
                          </td>
                          <td className="py-1.5 text-right font-medium">
                            {fmt(subtotal)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 text-muted-foreground">
                            + Overhead ({margins.overhead}%)
                          </td>
                          <td className="py-1.5 text-right font-medium">
                            {fmt(withOverhead)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 text-muted-foreground">
                            + Contingency ({margins.contingency}%)
                          </td>
                          <td className="py-1.5 text-right font-medium">
                            {fmt(withContingency)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 text-muted-foreground">
                            + Profit ({margins.profit}%)
                          </td>
                          <td className="py-1.5 text-right font-medium">
                            {fmt(withProfit)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 text-muted-foreground">
                            + Tax ({margins.tax}%)
                          </td>
                          <td className="py-1.5 text-right font-medium">
                            {fmt(taxAmount)}
                          </td>
                        </tr>
                        <Separator className="my-1" />
                        <tr className="font-bold">
                          <td className="py-2">Bid Price</td>
                          <td className="py-2 text-right text-base">
                            {fmt(bidPrice)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── Findings Tab ──────────────────────────────────────────── */}
            <TabsContent value="findings" className="flex-1 mt-3">
              <div className="space-y-3">
                {findings.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">
                      No findings yet — run an analysis to get AI observations.
                    </p>
                  </div>
                ) : (
                  findings.map((f) => (
                    <Card key={f.id}>
                      <CardContent className="p-4 flex gap-3">
                        {f.severity === "error" ? (
                          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                        ) : f.severity === "warning" ? (
                          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                        ) : (
                          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{f.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {f.detail}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}

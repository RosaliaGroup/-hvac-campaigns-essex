import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { extractPDFPages, buildSelectedText, buildImageBlocks, type ExtractedPage } from "@/lib/pdfExtract";
import { DEFAULT_PRICEBOOK, matchPricebook, CSI_DIVISIONS, type PricebookEntry } from "@/lib/pricebook";
import { runVerification } from "@/lib/takeoffVerify";
import { trpc } from "@/lib/trpc";
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
  Package,
  Save,
  ArrowLeft,
  Lightbulb,
  ArrowRight,
  X,
  Check,
  Star,
  ShieldCheck,
  ShieldAlert,
  Eye,
  ChevronDown,
  Layers,
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
  rawFile: File;
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

type VeType = "redesign" | "substitution" | "scope_reduction" | "sequencing";

interface VeSuggestion {
  id: number;
  veType: string | null;
  itemDescription: string | null;
  currentSpec: string | null;
  alternativeSpec: string | null;
  vendor: string | null;
  model: string | null;
  estimatedSavings: string | null;
  savingsPercent: string | null;
  tradeOffs: string | null;
  codeCompliant: boolean | number | null;
  affectedItems: string | null;
  implementationNotes: string | null;
  status: "pending" | "applied" | "rejected";
}

const VE_TYPE_CONFIG: Record<VeType, { label: string; color: string; icon?: string }> = {
  redesign: { label: "REDESIGN", color: "bg-purple-100 text-purple-800 border-purple-200" },
  substitution: { label: "SUBSTITUTION", color: "bg-blue-100 text-blue-800 border-blue-200" },
  scope_reduction: { label: "SCOPE REDUCTION", color: "bg-orange-100 text-orange-800 border-orange-200" },
  sequencing: { label: "SEQUENCING", color: "bg-gray-100 text-gray-800 border-gray-200" },
};

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  "MACHINERY", "SHEET METAL", "COPPER", "INSULATION",
  "AIR DEVICES", "ACCESSORIES", "LABOR", "OTHER",
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

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function emptyRow(): TakeOffRow {
  return { id: uid(), category: "OTHER", description: "New Item", tag: "", qty: 1, unit: "EA", vendor: "", model: "", specs: "", source: "Manual", confidence: 60, unitPrice: 0, notes: "" };
}

function safeParseJSON(raw: string) {
  let text = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try { return JSON.parse(text); } catch {}
  try {
    const pagesMatch = text.match(/"pages"\s*:\s*(\d+)/);
    const pages = pagesMatch ? parseInt(pagesMatch[1]) : 1;
    const items: any[] = [];
    const itemRegex = /\{[^{}]*"category"\s*:[^{}]*"description"\s*:[^{}]*"qty"\s*:\s*[\d.]+[^{}]*\}/g;
    let match;
    while ((match = itemRegex.exec(text)) !== null) {
      try { const item = JSON.parse(match[0]); if (item.category && item.description) items.push(item); } catch {}
    }
    const findings: any[] = [];
    const findingRegex = /\{[^{}]*"type"\s*:\s*"(warning|info|success|alert)"[^{}]*"title"\s*:[^{}]*\}/g;
    while ((match = findingRegex.exec(text)) !== null) {
      try { const f = JSON.parse(match[0]); if (f.type && f.title) findings.push(f); } catch {}
    }
    if (items.length > 0) return { pages, items, findings };
  } catch {}
  throw new Error("Could not parse AI response");
}

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// ── Component ────────────────────────────────────────────────────────────────

export default function TakeOffDetail() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();

  // Data from DB
  const { data: projectData, isLoading: loadingProject, refetch } = trpc.takeoffs.getById.useQuery({ id: projectId });
  const saveMutation = trpc.takeoffs.saveItems.useMutation();
  const updateMutation = trpc.takeoffs.update.useMutation();
  const veRunMutation = trpc.takeoffs.runVE.useMutation();
  const veUpdateMutation = trpc.takeoffs.updateVE.useMutation();
  const veClearMutation = trpc.takeoffs.clearVE.useMutation();

  // Local state
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [rows, setRows] = useState<TakeOffRow[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [veSuggestions, setVeSuggestions] = useState<VeSuggestion[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  const [veRunning, setVeRunning] = useState(false);
  const [veFilter, setVeFilter] = useState<string>("all");
  const [showReanalyzeConfirm, setShowReanalyzeConfirm] = useState(false);

  const [pricebook, setPricebook] = useState<PricebookEntry[]>(() => [...DEFAULT_PRICEBOOK]);

  // 3-step pipeline state
  const [extractedPages, setExtractedPages] = useState<ExtractedPage[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [expandedPage, setExpandedPage] = useState<number | null>(null);
  const [analysisStep, setAnalysisStep] = useState<"idle" | "extracting" | "ready" | "analyzing" | "reconciling">("idle");

  const [margins, setMargins] = useState<Margins>({
    materials: 20, labor: 35, overhead: 12, profit: 10, contingency: 5, tax: 6.625,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiKeyRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  // Fetch API key on mount
  useEffect(() => {
    fetch("/.netlify/functions/get-api-config")
      .then((r) => r.json())
      .then((d) => { apiKeyRef.current = d.apiKey || null; })
      .catch(() => {});
  }, []);

  // Load project data from DB
  useEffect(() => {
    if (!projectData || initializedRef.current) return;
    initializedRef.current = true;
    console.log("[Mount] items from DB:", projectData.items?.length, "rows in state:", rows.length);
    console.log("[Mount] auto-analyze triggered? false — analysis only runs on button click");

    const dbRows: TakeOffRow[] = projectData.items.map((i) => ({
      id: uid(),
      category: (CATEGORIES.includes(i.category as Category) ? i.category : "OTHER") as Category,
      description: i.description || "",
      tag: i.tag || "",
      qty: Number(i.qty) || 1,
      unit: i.unit || "EA",
      vendor: i.vendor || "",
      model: i.model || "",
      specs: i.specs || "",
      source: i.source || "",
      confidence: i.confidence || 0,
      unitPrice: Number(i.unitPrice) || 0,
      notes: i.notes || "",
    }));
    setRows(dbRows);

    const dbFindings: Finding[] = projectData.findings.map((f) => ({
      id: uid(),
      severity: (f.type === "warning" ? "warning" : f.type === "alert" ? "error" : "info") as Finding["severity"],
      title: f.title || "",
      detail: f.body || "",
    }));
    setFindings(dbFindings);
    setVeSuggestions(projectData.veSuggestions || []);
    if (dbRows.length > 0) setLastSaved(new Date(projectData.project.updatedAt));
  }, [projectData]);

  // Auto-save debounced
  useEffect(() => {
    if (!dirty || rows.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveToDb();
    }, 2000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [rows, dirty]);

  const log = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${ts}] ${msg}`]);
  }, []);

  // ── Save to DB ────────────────────────────────────────────────────────────
  const saveToDb = async () => {
    try {
      await saveMutation.mutateAsync({
        projectId,
        items: rows.map((r) => ({
          category: r.category,
          description: r.description,
          tag: r.tag,
          qty: r.qty,
          unit: r.unit,
          vendor: r.vendor,
          model: r.model,
          specs: r.specs,
          source: r.source,
          confidence: r.confidence,
          unitPrice: r.unitPrice,
          notes: r.notes,
        })),
        findings: findings.map((f) => ({
          type: f.severity,
          title: f.title,
          body: f.detail,
          source: "",
        })),
      });
      setLastSaved(new Date());
      setDirty(false);
      log("Saved to database.");
    } catch (err: any) {
      log(`Save error: ${err.message}`);
    }
  };

  // ── File handling ─────────────────────────────────────────────────────────
  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;
    const accepted = Array.from(fileList).filter(
      (f) => f.type === "application/pdf" || f.type.startsWith("image/")
    );
    for (const f of accepted) {
      log(`Adding file: ${f.name}`);
      const base64 = await fileToBase64(f);
      setFiles((prev) => [...prev, { name: f.name, type: f.type, size: f.size, base64, rawFile: f, status: "ready" }]);
    }
  }, [log]);

  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }, [handleFiles]);
  const removeFile = (name: string) => setFiles((prev) => prev.filter((f) => f.name !== name));

  // ── STEP 1: Extract pages from PDF ──────────────────────────────────────────
  const runExtraction = async () => {
    if (files.length === 0) return;
    const file = files[0];
    if (file.type !== "application/pdf") {
      // For images, create a single pseudo-page
      setExtractedPages([{ pageNum: 1, text: "", charCount: 0, thumbnail: `data:${file.type};base64,${file.base64}`, selected: true }]);
      setAnalysisStep("ready");
      log("Image file ready for analysis.");
      return;
    }

    setExtracting(true);
    setAnalysisStep("extracting");
    log("Step 1: Extracting text and thumbnails from PDF…");

    try {
      const pages = await extractPDFPages(file.rawFile, (page, total) => {
        log(`Extracted page ${page} of ${total}…`);
      });
      setExtractedPages(pages);
      const totalChars = pages.reduce((s, p) => s + p.charCount, 0);
      log(`Step 1 complete: ${pages.length} pages extracted, ${totalChars.toLocaleString()} characters of text`);
      setAnalysisStep("ready");
    } catch (err: any) {
      log(`Extraction error: ${err.message}`);
      setAnalysisStep("idle");
    } finally {
      setExtracting(false);
    }
  };

  const togglePage = (pageNum: number) => {
    setExtractedPages((prev) => prev.map((p) => p.pageNum === pageNum ? { ...p, selected: !p.selected } : p));
  };

  // ── Helper: call Claude with retry ────────────────────────────────────────
  const callClaude = async (system: string, messages: any[]): Promise<string> => {
    if (!apiKeyRef.current) {
      const cfgRes = await fetch("/.netlify/functions/get-api-config");
      const cfg = await cfgRes.json();
      apiKeyRef.current = cfg.apiKey || null;
    }
    if (!apiKeyRef.current) throw new Error("API key not available");

    const headers = { "Content-Type": "application/json", "x-api-key": apiKeyRef.current, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" };
    const body = JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 16000, system, messages });

    let res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers, body });
    if (res.status === 429) {
      log("Rate limit hit — waiting 60 seconds then retrying…");
      await new Promise(resolve => setTimeout(resolve, 60000));
      log("Retrying…");
      res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers, body });
    }
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.content?.[0]?.text || "";
  };

  // ── STEP 2 + 3: Analyze with Claude (batched) + Reconcile ─────────────────
  const analyzeWithClaude = async () => {
    const selected = extractedPages.filter((p) => p.selected);
    if (selected.length === 0) { log("No pages selected."); return; }

    setAnalyzing(true);
    setAnalysisStep("analyzing");

    const pName = projectData?.project.name || "HVAC Project";
    const pLoc = projectData?.project.location || "Newark NJ";
    const pDisc = projectData?.project.discipline || "HVAC";
    const totalChars = selected.reduce((s, p) => s + p.charCount, 0);
    const isScanned = totalChars < 500;

    log(`Step 2: Analyzing ${selected.length} of ${extractedPages.length} pages…`);

    const systemPrompt = `You are an expert HVAC/MEP mechanical estimator performing a category-by-category takeoff. Project: ${pName}. Discipline: ${pDisc}. Location: ${pLoc}. Instructions: ${instructions || "None"}.

FOLLOW THIS TAKEOFF ORDER — add a finding for each step completed:
STEP 1 — EQUIPMENT SCHEDULES: Read ALL equipment schedules first (AHUs, ODUs, ERVs, fans, pumps). These are AUTHORITATIVE counts.
STEP 2 — EQUIPMENT ON PLANS: Verify schedule counts by counting tags on floor plans. Flag any discrepancy as a warning finding.
STEP 3 — DUCTWORK: Rectangular by size in LF, round by diameter in LF. Count fittings (elbows, tees, transitions).
STEP 4 — PIPING: Refrigerant lines by diameter in LF, condensate drain in LF.
STEP 5 — AIR DEVICES: Supply registers, return grilles, exhaust grilles — count each type.
STEP 6 — ACCESSORIES: Fire dampers, volume dampers, motorized dampers, louvers, flex connectors.
STEP 7 — INSULATION: Duct wrap in SF, pipe insulation in LF.
STEP 8 — CONTROLS: Thermostats, sensors, CO detectors, BMS points.

PRICING — NJ DIRECT COST (material + labor, NO markup):
Equipment: VRF ODU $800-1,200/ton; VRF AHU $400-700/unit; Exhaust fan <500CFM $150-300; Exhaust fan >1000CFM $500-1,500; ERV $800-2,000; RTU $3,000-6,000
Ductwork: Rect ≤10in $8-14/LF; Rect 12-20in $18-28/LF; Rect >20in $28-40/LF; Round 5-6in $4-8/LF
Piping: Refrigerant ≤3/8" $8-12/LF; Refrigerant >3/8" $12-18/LF; Condensate PVC $4-6/LF
Air devices: Supply register $35-85; Return grille $45-85; Exhaust grille $30-60
Accessories: Fire damper $180-350; Volume damper $60-120; Motorized damper $200-450; Louver $250-500
Insulation: Duct wrap $3-5/SF; Pipe insulation $4-7/LF
Controls: Thermostat $150-400; CO detector $120-200; Sensor $80-150

LABOR RATES (SMACNA/RSMeans NJ):
Sheet metal duct: $90-115/hr, 1.0-1.5 hr per 100 SF duct
Equipment setting: 4-8 hr per AHU, 2-4 hr per ODU, 6-12 hr per RTU
Piping (copper refrigerant): included in per-LF price
Controls/thermostats: 2-3 hr each
Air devices: 0.5-1.0 hr each

Respond ONLY with valid JSON: {"pages":${selected.length},"items":[{"category":"MACHINERY|SHEET METAL|COPPER|INSULATION|AIR DEVICES|ACCESSORIES|LABOR|OTHER","description":"<desc>","tag":"<tag>","qty":<number>,"unit":"EA|LF|SF|LS|HR","vendor":"<brand>","model":"<model>","specs":"<specs>","source":"<sheet>","confidence":"high|med|low","unitPrice":<number>,"notes":"<notes>"}],"findings":[{"type":"warning|info|success|alert","title":"<title>","body":"<body>","source":"<ref>"}]}`;

    try {
      // Split into batches of 4 pages if > 8 pages
      const BATCH_SIZE = 4;
      const needsBatching = selected.length > 8;
      const batches: ExtractedPage[][] = [];
      if (needsBatching) {
        for (let i = 0; i < selected.length; i += BATCH_SIZE) {
          batches.push(selected.slice(i, i + BATCH_SIZE));
        }
      } else {
        batches.push(selected);
      }

      const batchResults: string[] = [];

      for (let b = 0; b < batches.length; b++) {
        const batch = batches[b];
        const batchLabel = needsBatching ? ` (batch ${b + 1}/${batches.length})` : "";
        log(`Sending pages ${batch.map((p) => p.pageNum).join(", ")} to Claude${batchLabel}…`);

        // Build message content: text + images combined
        const batchText = batch.map((p) => `=== PAGE ${p.pageNum} ===\n${p.text}`).join("\n\n");
        const imageBlocks = buildImageBlocks(batch, 4);

        let content: any[];
        if (isScanned) {
          // Scanned PDF: send only images
          content = [...imageBlocks, { type: "text", text: `Analyze these ${batch.length} pages of mechanical drawings for ${pName}. Extract every equipment item. Return valid JSON.` }];
        } else {
          // Digital PDF: send both text and images
          content = [
            ...imageBlocks,
            { type: "text", text: `Here is extracted text from pages ${batch.map((p) => p.pageNum).join(", ")} AND images of each page. Use the text for precise counting and the images to understand the layout. Cross-reference both.\n\n${batchText}\n\nExtract every item from these pages. Return valid JSON.` },
          ];
        }

        const text = await callClaude(systemPrompt, [{ role: "user", content }]);
        batchResults.push(text);
        log(`Batch ${b + 1} response received (${text.length} chars).`);
      }

      // ── STEP 3: Reconcile if batched ──────────────────────────────────────
      let finalText: string;
      if (batchResults.length > 1) {
        setAnalysisStep("reconciling");
        log("Step 3: Reconciling results across all pages…");
        const combined = batchResults.map((r, i) => `=== BATCH ${i + 1} RESULTS ===\n${r}`).join("\n\n");
        finalText = await callClaude(
          `You are an HVAC estimator. You received take-off results from multiple batches of drawing pages. Merge them into a single, deduplicated take-off. If the same equipment tag appears in multiple batches, keep only one entry with the correct quantity. Cross-check schedule quantities against plan counts. Respond ONLY with valid JSON in the same format.`,
          [{ role: "user", content: `Merge these ${batchResults.length} batch results into one final take-off:\n\n${combined}\n\nDeduplicate, reconcile, and return the final JSON.` }]
        );
        log("Reconciliation complete.");
      } else {
        finalText = batchResults[0];
      }

      log("Parsing results…");

      const parsed = safeParseJSON(finalText);
      const newRows: TakeOffRow[] = (parsed.items || []).map((item: any) => ({
        id: uid(),
        category: CATEGORIES.includes(item.category) ? item.category : "OTHER",
        description: item.description || "", tag: item.tag || "",
        qty: Number(item.qty) || 1, unit: item.unit || "EA",
        vendor: item.vendor || "", model: item.model || "",
        specs: item.specs || "", source: item.source || "",
        confidence: typeof item.confidence === "string"
          ? ({ high: 90, med: 60, low: 30 } as Record<string, number>)[item.confidence] ?? 0
          : Number(item.confidence) || 0,
        unitPrice: Number(item.unitPrice) || 0, notes: item.notes || "",
      }));

      const newFindings: Finding[] = (parsed.findings || []).map((f: any) => ({
        id: uid(),
        severity: (f.type === "warning" ? "warning" : f.type === "alert" ? "error" : "info") as Finding["severity"],
        title: f.title || "", detail: f.body || f.detail || "",
      }));

      // Apply pricebook matching
      const pricedRows = newRows.map((r) => {
        if (r.unitPrice > 0) return r;
        const match = matchPricebook(r.description, pricebook);
        return match ? { ...r, unitPrice: match.defaultPrice } : r;
      });

      // Run verification checks
      log("Running verification checks…");
      const verifyFindings = runVerification(pricedRows);

      setRows(pricedRows);
      setFindings([...newFindings, ...verifyFindings]);
      setDirty(true);
      setAnalysisStep("idle");
      log(`Done! ${pricedRows.length} line items, ${newFindings.length + verifyFindings.length} findings (${verifyFindings.length} from verification).`);

      // Auto-save immediately after analysis
      setTimeout(() => saveToDb(), 500);
    } catch (err: any) {
      log(`Error: ${err.message}`);
      setAnalysisStep("idle");
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Row editing ───────────────────────────────────────────────────────────
  const updateRow = (id: string, field: keyof TakeOffRow, value: any) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    setDirty(true);
  };
  const deleteRow = (id: string) => { setRows((prev) => prev.filter((r) => r.id !== id)); setDirty(true); };
  const addRow = () => {
    const newRow: TakeOffRow = {
      id: uid(),
      category: "OTHER",
      description: "New Item",
      tag: "",
      qty: 1,
      unit: "EA",
      vendor: "",
      model: "",
      specs: "",
      source: "Manual",
      confidence: 60,
      unitPrice: 0,
      notes: "",
    };
    setRows((prev) => [...prev, newRow]);
    setDirty(true);
    // Clear any active filters that would hide the new row
    setFilterCategory("ALL");
    setSearch("");
  };

  // ── Value Engineering ─────────────────────────────────────────────────────
  const runVE = async () => {
    setVeRunning(true);
    console.log("[VE] Calling runVE with projectId:", projectId, "type:", typeof projectId, "rows in state:", rows.length);
    try {
      const result = await veRunMutation.mutateAsync({ projectId });
      setVeSuggestions(result.suggestions);
      if (result.cached) log("VE suggestions loaded from cache.");
      else log(`Generated ${result.suggestions.length} VE suggestions.`);
    } catch (err: any) {
      log(`VE error: ${err.message}`);
    } finally {
      setVeRunning(false);
    }
  };

  const applyVE = async (ve: VeSuggestion) => {
    await veUpdateMutation.mutateAsync({ id: ve.id, status: "applied" });
    setVeSuggestions((prev) => prev.map((s) => (s.id === ve.id ? { ...s, status: "applied" } : s)));
  };

  const dismissVE = async (ve: VeSuggestion) => {
    await veUpdateMutation.mutateAsync({ id: ve.id, status: "rejected" });
    setVeSuggestions((prev) => prev.map((s) => (s.id === ve.id ? { ...s, status: "rejected" } : s)));
  };

  const rerunVE = async () => {
    await veClearMutation.mutateAsync({ projectId });
    setVeSuggestions([]);
    runVE();
  };

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filteredRows = rows.filter((r) => {
    const matchSearch = !search || (r.description || "").toLowerCase().includes(search.toLowerCase()) || (r.tag || "").toLowerCase().includes(search.toLowerCase()) || (r.vendor || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "ALL" || r.category === filterCategory;
    return matchSearch && matchCat;
  });

  const groupedRows = CATEGORIES.reduce<Record<string, TakeOffRow[]>>((acc, cat) => {
    const catRows = filteredRows.filter((r) => r.category === cat);
    if (catRows.length > 0) acc[cat] = catRows;
    return acc;
  }, {});

  // ── Bid calculation ───────────────────────────────────────────────────────
  const matCost = rows.filter((r) => r.category !== "LABOR").reduce((s, r) => s + r.qty * r.unitPrice, 0);
  const laborCost = rows.filter((r) => r.category === "LABOR").reduce((s, r) => s + r.qty * r.unitPrice, 0);
  const matMarkup = matCost * (margins.materials / 100);
  const laborBurden = laborCost * (margins.labor / 100);
  const subtotal = matCost + matMarkup + laborCost + laborBurden;
  const withOverhead = subtotal * (1 + margins.overhead / 100);
  const withContingency = withOverhead * (1 + margins.contingency / 100);
  const withProfit = withContingency * (1 + margins.profit / 100);
  const taxAmount = matMarkup * (margins.tax / 100);
  const bidPrice = withProfit + taxAmount;

  const activeVE = veSuggestions.filter((s) => s.status === "pending" || s.status === "applied");
  const totalVESavings = activeVE.reduce((s, ve) => s + Number(ve.estimatedSavings || 0), 0);
  const veSavingsByType = (type: string) => activeVE.filter((s) => s.veType === type).reduce((s, ve) => s + Number(ve.estimatedSavings || 0), 0);
  const filteredVE = veFilter === "all" ? veSuggestions : veSuggestions.filter((s) => s.veType === veFilter);

  // ── Export CSV (CSI Division 23 format) ─────────────────────────────────────
  const exportCSV = () => {
    const projName = projectData?.project.name || "HVAC Project";
    const projLoc = projectData?.project.location || "NJ";
    const dateStr = new Date().toISOString().slice(0, 10);
    const lines: string[] = [];

    lines.push(`"${projName} — Mechanical Take-Off",,,,,,,,`);
    lines.push(`"Location: ${projLoc}","Date: ${dateStr}","Prepared by: ME AI Take-Off",,,,,,`);
    lines.push("");
    lines.push("CSI Division,Category,Description,Tag,Qty,Unit,Material $,Labor Hrs,Labor $,Ext Material,Ext Labor,Ext Total,Vendor,Model,Confidence,Notes");

    let totalMat = 0;
    let totalLabor = 0;

    for (const cat of CATEGORIES) {
      const catRows = rows.filter((r) => r.category === cat);
      if (catRows.length === 0) continue;
      const csi = CSI_DIVISIONS[cat] || "23 00 00";
      let catMat = 0;
      let catLabor = 0;

      for (const r of catRows) {
        const match = matchPricebook(r.description, pricebook);
        const laborHrs = match ? match.laborHours * r.qty : 0;
        const laborRate = match ? match.laborRate : 95;
        const laborCostItem = laborHrs * laborRate;
        const matExt = r.qty * r.unitPrice;
        catMat += matExt;
        catLabor += laborCostItem;
        lines.push([
          `"${csi}"`, `"${cat}"`, `"${r.description}"`, `"${r.tag}"`,
          r.qty, r.unit, r.unitPrice.toFixed(2), laborHrs.toFixed(1), laborRate.toFixed(0),
          matExt.toFixed(2), laborCostItem.toFixed(2), (matExt + laborCostItem).toFixed(2),
          `"${r.vendor}"`, `"${r.model}"`, `${r.confidence}%`, `"${r.notes}"`
        ].join(","));
      }

      lines.push(`,,"SUBTOTAL — ${cat}",,,,,,,,${catMat.toFixed(2)},${catLabor.toFixed(2)},${(catMat + catLabor).toFixed(2)},,,`);
      lines.push("");
      totalMat += catMat;
      totalLabor += catLabor;
    }

    lines.push("");
    lines.push(`,,"DIRECT COST TOTAL",,,,,,,,${totalMat.toFixed(2)},${totalLabor.toFixed(2)},${(totalMat + totalLabor).toFixed(2)},,,`);
    lines.push(`,,"Material Markup (${margins.materials}%)",,,,,,,,${(totalMat * margins.materials / 100).toFixed(2)},,${(totalMat * margins.materials / 100).toFixed(2)},,,`);
    lines.push(`,,"Labor Burden (${margins.labor}%)",,,,,,,,,${(totalLabor * margins.labor / 100).toFixed(2)},${(totalLabor * margins.labor / 100).toFixed(2)},,,`);
    lines.push(`,,"Overhead (${margins.overhead}%)",,,,,,,,,,${((totalMat + totalLabor) * margins.overhead / 100).toFixed(2)},,,`);
    lines.push(`,,"Profit (${margins.profit}%)",,,,,,,,,,${((totalMat + totalLabor) * margins.profit / 100).toFixed(2)},,,`);
    lines.push(`,,"BID PRICE",,,,,,,,,,${bidPrice.toFixed(2)},,,`);

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${projName}-div23-${dateStr}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loadingProject) {
    return <DashboardLayout><div className="flex items-center justify-center py-20 text-muted-foreground">Loading project…</div></DashboardLayout>;
  }

  if (!projectData) {
    return <DashboardLayout><div className="flex items-center justify-center py-20 text-muted-foreground">Project not found.</div></DashboardLayout>;
  }

  const project = projectData.project;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/takeoff-ai")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{project.name}</h1>
              <p className="text-xs text-muted-foreground">
                {project.location && `${project.location} · `}{project.discipline || "HVAC"}
                {lastSaved && ` · Saved ${lastSaved.toLocaleTimeString()}`}
                {dirty && " · Unsaved changes"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={rows.length === 0}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button size="sm" onClick={saveToDb} disabled={!dirty && rows.length === 0}>
              <Save className="h-4 w-4 mr-1" /> Save
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
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Drop PDF or images here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                  <input ref={fileInputRef} type="file" multiple accept=".pdf,image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                </div>
                {files.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {files.map((f) => (
                      <div key={f.name} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{f.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{(f.size / 1024).toFixed(0)}KB</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); removeFile(f.name); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    {/* Extract button — Step 1 */}
                    {extractedPages.length === 0 && (
                      <Button className="w-full mt-2" size="sm" onClick={runExtraction} disabled={extracting}>
                        {extracting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Layers className="h-4 w-4 mr-2" />}
                        {extracting ? "Extracting pages…" : "Extract Pages"}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Page preview — shown after Step 1 */}
            {extractedPages.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    Step 1: Extraction Complete
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground">
                    {extractedPages.length} pages extracted, {extractedPages.reduce((s, p) => s + p.charCount, 0).toLocaleString()} characters — uncheck pages to exclude from analysis
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[300px]">
                    <div className="divide-y">
                      {extractedPages.map((p) => (
                        <div key={p.pageNum} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <input type="checkbox" checked={p.selected} onChange={() => togglePage(p.pageNum)} className="h-3.5 w-3.5 rounded accent-primary" />
                            <img src={p.thumbnail} alt={`Page ${p.pageNum}`} className="h-10 w-8 object-cover rounded border flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">Page {p.pageNum}</p>
                              <p className="text-[10px] text-muted-foreground">{p.charCount.toLocaleString()} chars</p>
                            </div>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setExpandedPage(expandedPage === p.pageNum ? null : p.pageNum)}>
                              <ChevronDown className={`h-3 w-3 transition-transform ${expandedPage === p.pageNum ? "rotate-180" : ""}`} />
                            </Button>
                          </div>
                          {expandedPage === p.pageNum && (
                            <pre className="mt-2 text-[10px] text-muted-foreground bg-muted/50 rounded p-2 max-h-[120px] overflow-auto whitespace-pre-wrap">{p.text || "(no text — scanned page)"}</pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Analyze section — Step 2 */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
                  placeholder="Additional instructions for the AI…"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
                {analysisStep === "analyzing" || analysisStep === "reconciling" ? (
                  <Button className="w-full" disabled>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    {analysisStep === "reconciling" ? "Reconciling…" : `Analyzing ${extractedPages.filter((p) => p.selected).length} pages…`}
                  </Button>
                ) : rows.length === 0 ? (
                  <Button className="w-full" onClick={analyzeWithClaude} disabled={extractedPages.filter((p) => p.selected).length === 0 && files.length === 0}>
                    <Zap className="h-4 w-4 mr-2" />
                    {extractedPages.length > 0 ? `Proceed to Analysis (${extractedPages.filter((p) => p.selected).length} pages)` : "Analyze with AI"}
                  </Button>
                ) : showReanalyzeConfirm ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                    <p className="text-xs text-amber-800">
                      This will re-run the AI analysis and replace all {rows.length} saved items. This costs ~$0.40 in API credits. Continue?
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" className="flex-1" onClick={() => { setShowReanalyzeConfirm(false); analyzeWithClaude(); }}>Yes, Re-analyze</Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowReanalyzeConfirm(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => setShowReanalyzeConfirm(true)}>
                    <RefreshCw className="h-4 w-4 mr-2" /> Re-analyze
                  </Button>
                )}
                {(analyzing || extracting) && <Progress value={undefined} className="h-1" />}
              </CardContent>
            </Card>

            {/* Log panel */}
            <Card className="bg-zinc-950 text-zinc-300 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono text-zinc-500">LOG</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[160px] px-4 pb-3">
                  {logs.length === 0 ? (
                    <p className="text-xs text-zinc-600 font-mono">Waiting for activity…</p>
                  ) : logs.map((l, i) => <p key={i} className="text-xs font-mono leading-5">{l}</p>)}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT PANEL ─────────────────────────────────────────────── */}
          <Tabs defaultValue="takeoff" className="flex flex-col">
            <TabsList className="w-fit">
              <TabsTrigger value="takeoff" className="gap-1.5"><Wrench className="h-3.5 w-3.5" /> Take-Off</TabsTrigger>
              <TabsTrigger value="summary" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Summary</TabsTrigger>
              <TabsTrigger value="findings" className="gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Findings
                {findings.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{findings.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="ve" className="gap-1.5">
                <Lightbulb className="h-3.5 w-3.5" /> Value Eng.
                {veSuggestions.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{veSuggestions.filter(s => s.status === "pending").length}</Badge>}
              </TabsTrigger>
            </TabsList>

            {/* ── Take-Off Tab ──────────────────────────────────────────── */}
            <TabsContent value="takeoff" className="flex-1 mt-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Input placeholder="Search items…" className="max-w-[220px] h-8 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="w-[160px] h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Categories</SelectItem>
                        {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="ml-auto"><Button size="sm" variant="outline" onClick={addRow}><Plus className="h-3.5 w-3.5 mr-1" /> Add Row</Button></div>
                  </div>

                  <ScrollArea className="max-h-[600px]">
                    {Object.keys(groupedRows).length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground">
                        <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
                        <p className="text-sm">No items yet — upload plans and analyze, or add rows manually.</p>
                      </div>
                    ) : Object.entries(groupedRows).map(([cat, catRows]) => (
                      <div key={cat} className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[cat as Category]}`}>{cat}</Badge>
                          <span className="text-xs text-muted-foreground">{catRows.length} item{catRows.length !== 1 && "s"} · {fmt(catRows.reduce((s, r) => s + r.qty * r.unitPrice, 0))}</span>
                        </div>
                        <div className="border rounded-md overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-muted/50 text-muted-foreground">
                                <th className="text-left px-2 py-1.5 font-medium">Description</th>
                                <th className="text-left px-2 py-1.5 font-medium w-[60px]">Tag</th>
                                <th className="text-right px-2 py-1.5 font-medium min-w-[80px] w-[80px]">Qty</th>
                                <th className="text-left px-2 py-1.5 font-medium w-[45px]">Unit</th>
                                <th className="text-right px-2 py-1.5 font-medium w-[80px]">Unit $</th>
                                <th className="text-right px-2 py-1.5 font-medium w-[80px]">Ext $</th>
                                <th className="text-center px-2 py-1.5 font-medium w-[40px]">Conf</th>
                                <th className="w-[32px]" />
                              </tr>
                            </thead>
                            <tbody>
                              {catRows.map((r) => (
                                <tr key={r.id} className="border-t hover:bg-accent/30">
                                  <td className="px-2 py-1"><Input className="h-6 text-xs border-0 shadow-none p-0" value={r.description} onChange={(e) => updateRow(r.id, "description", e.target.value)} /></td>
                                  <td className="px-2 py-1"><Input className="h-6 text-xs border-0 shadow-none p-0" value={r.tag} onChange={(e) => updateRow(r.id, "tag", e.target.value)} /></td>
                                  <td className="px-2 py-1 text-right">
                                    <input type="number" value={r.qty} onChange={(e) => updateRow(r.id, "qty", parseFloat(e.target.value) || 0)} className="w-24 text-right font-mono text-sm bg-transparent border-0 focus:outline-none focus:bg-white focus:border focus:border-orange-300 focus:px-1 rounded" style={{ minWidth: "80px" }} />
                                  </td>
                                  <td className="px-2 py-1 text-xs">{r.unit}</td>
                                  <td className="px-2 py-1 text-right"><Input type="number" className="h-6 text-xs border-0 shadow-none p-0 text-right w-full" value={r.unitPrice} onChange={(e) => updateRow(r.id, "unitPrice", Number(e.target.value))} /></td>
                                  <td className="px-2 py-1 text-right text-xs font-medium">{fmt(r.qty * r.unitPrice)}</td>
                                  <td className="px-2 py-1 text-center">
                                    <Badge variant="outline" className={`text-[9px] px-1 ${r.confidence >= 80 ? "border-green-300 text-green-700" : r.confidence >= 50 ? "border-yellow-300 text-yellow-700" : "border-red-300 text-red-700"}`}>{r.confidence}%</Badge>
                                  </td>
                                  <td className="px-1 py-1"><Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => deleteRow(r.id)}><Trash2 className="h-3 w-3 text-muted-foreground" /></Button></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Summary Tab ───────────────────────────────────────────── */}
            <TabsContent value="summary" className="flex-1 mt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="md:col-span-2 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Total Bid Price</p>
                      <p className="text-3xl font-bold tracking-tight mt-1">{fmt(bidPrice)}</p>
                    </div>
                    <BarChart3 className="h-10 w-10 text-primary/30" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Markup Controls</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {([["materials", "Material Markup %"], ["labor", "Labor Burden %"], ["overhead", "Overhead %"], ["profit", "Profit %"], ["contingency", "Contingency %"], ["tax", "Tax %"]] as const).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between">
                        <label className="text-xs text-muted-foreground">{label}</label>
                        <Input type="number" step="0.1" className="w-[80px] h-7 text-xs text-right" value={margins[key]} onChange={(e) => setMargins((m) => ({ ...m, [key]: Number(e.target.value) }))} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Cost Build-Up</CardTitle></CardHeader>
                  <CardContent>
                    <table className="w-full text-xs">
                      <tbody className="divide-y">
                        <tr><td className="py-1.5 text-muted-foreground">Material Cost</td><td className="py-1.5 text-right font-medium">{fmt(matCost)}</td></tr>
                        <tr><td className="py-1.5 text-muted-foreground">Material Markup</td><td className="py-1.5 text-right font-medium">{fmt(matMarkup)}</td></tr>
                        <tr><td className="py-1.5 text-muted-foreground">Labor Cost</td><td className="py-1.5 text-right font-medium">{fmt(laborCost)}</td></tr>
                        <tr><td className="py-1.5 text-muted-foreground">Labor Burden</td><td className="py-1.5 text-right font-medium">{fmt(laborBurden)}</td></tr>
                        <Separator className="my-1" />
                        <tr><td className="py-1.5 text-muted-foreground">Subtotal</td><td className="py-1.5 text-right font-medium">{fmt(subtotal)}</td></tr>
                        <tr><td className="py-1.5 text-muted-foreground">+ Overhead ({margins.overhead}%)</td><td className="py-1.5 text-right font-medium">{fmt(withOverhead)}</td></tr>
                        <tr><td className="py-1.5 text-muted-foreground">+ Contingency ({margins.contingency}%)</td><td className="py-1.5 text-right font-medium">{fmt(withContingency)}</td></tr>
                        <tr><td className="py-1.5 text-muted-foreground">+ Profit ({margins.profit}%)</td><td className="py-1.5 text-right font-medium">{fmt(withProfit)}</td></tr>
                        <tr><td className="py-1.5 text-muted-foreground">+ Tax ({margins.tax}%)</td><td className="py-1.5 text-right font-medium">{fmt(taxAmount)}</td></tr>
                        <Separator className="my-1" />
                        <tr className="font-bold"><td className="py-2">Bid Price</td><td className="py-2 text-right text-base">{fmt(bidPrice)}</td></tr>
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                {/* Pricebook */}
                <Card className="md:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Pricebook — Standard Unit Prices
                    </CardTitle>
                    <p className="text-[10px] text-muted-foreground">Set your standard prices. Matching items auto-populate when AI returns $0 pricing.</p>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[300px]">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                        {pricebook.map((entry, idx) => (
                          <div key={entry.key} className="flex items-center justify-between py-1 border-b border-dashed">
                            <span className="text-xs text-muted-foreground truncate pr-2">{entry.label} ({entry.unit})</span>
                            <Input
                              type="number"
                              className="w-[80px] h-6 text-xs text-right"
                              value={entry.defaultPrice}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setPricebook((prev) => prev.map((p, i) => i === idx ? { ...p, defaultPrice: val } : p));
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
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
                    <p className="text-sm">No findings yet — run an analysis to get AI observations.</p>
                  </div>
                ) : findings.map((f) => (
                  <Card key={f.id}>
                    <CardContent className="p-4 flex gap-3">
                      {f.severity === "error" ? <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                        : f.severity === "warning" ? <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                        : <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />}
                      <div>
                        <p className="text-sm font-medium">{f.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{f.detail}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* ── Value Engineering Tab ──────────────────────────────────── */}
            <TabsContent value="ve" className="flex-1 mt-3">
              <div className="space-y-4">
                {/* Controls + savings summary */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    {veSuggestions.length > 0 && (
                      <div>
                        <p className="text-sm font-medium">
                          Total potential savings: <span className="text-green-600 text-lg font-bold">{fmt(totalVESavings)}</span>
                        </p>
                        <div className="flex flex-wrap gap-3 mt-1">
                          {(["redesign", "substitution", "scope_reduction", "sequencing"] as VeType[]).map((t) => {
                            const s = veSavingsByType(t);
                            if (s === 0) return null;
                            return (
                              <span key={t} className="text-[10px] text-muted-foreground">
                                <Badge variant="outline" className={`text-[9px] mr-1 ${VE_TYPE_CONFIG[t].color}`}>{VE_TYPE_CONFIG[t].label}</Badge>
                                {fmt(s)}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {veSuggestions.length > 0 && (
                      <Button variant="outline" size="sm" onClick={rerunVE} disabled={veRunning}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Re-run
                      </Button>
                    )}
                    {veSuggestions.length === 0 && (
                      <Button size="sm" onClick={runVE} disabled={veRunning || rows.length === 0}>
                        {veRunning ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Lightbulb className="h-4 w-4 mr-2" />}
                        {veRunning ? "Analyzing…" : "Run Value Engineering"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Filter row */}
                {veSuggestions.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { key: "all", label: "All" },
                      { key: "redesign", label: "Redesigns" },
                      { key: "substitution", label: "Substitutions" },
                      { key: "scope_reduction", label: "Scope Reductions" },
                      { key: "sequencing", label: "Sequencing" },
                    ].map((f) => (
                      <Button
                        key={f.key}
                        size="sm"
                        variant={veFilter === f.key ? "default" : "outline"}
                        className="h-7 text-xs"
                        onClick={() => setVeFilter(f.key)}
                      >
                        {f.label}
                        {f.key !== "all" && (
                          <span className="ml-1 opacity-60">
                            ({veSuggestions.filter((s) => s.veType === f.key).length})
                          </span>
                        )}
                      </Button>
                    ))}
                  </div>
                )}

                {veRunning && <Progress value={undefined} className="h-1" />}

                {/* VE Cards */}
                {veSuggestions.length === 0 && !veRunning ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Lightbulb className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Click "Run Value Engineering" to get AI-powered cost reduction suggestions.</p>
                  </div>
                ) : (
                  filteredVE.map((ve) => {
                    const typeKey = (ve.veType || "substitution") as VeType;
                    const typeConfig = VE_TYPE_CONFIG[typeKey] || VE_TYPE_CONFIG.substitution;
                    const isRedesign = typeKey === "redesign";
                    const isCompliant = ve.codeCompliant === true || ve.codeCompliant === 1;
                    let affectedList: string[] = [];
                    try { affectedList = ve.affectedItems ? JSON.parse(ve.affectedItems) : []; } catch { affectedList = []; }

                    return (
                      <Card key={ve.id} className={`${ve.status === "rejected" ? "opacity-50" : ""} ${isRedesign ? "border-purple-300 shadow-md" : ""}`}>
                        <CardContent className={`p-4 ${isRedesign ? "bg-purple-50/30" : ""}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              {/* Type badge + title */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={`text-[10px] ${typeConfig.color}`}>
                                  {typeConfig.label}
                                </Badge>
                                {isRedesign && (
                                  <Badge className="bg-purple-600 text-white text-[10px] gap-0.5">
                                    <Star className="h-2.5 w-2.5" /> High Impact
                                  </Badge>
                                )}
                                {isCompliant ? (
                                  <span className="flex items-center gap-0.5 text-[10px] text-green-600">
                                    <ShieldCheck className="h-3 w-3" /> Code Compliant
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-0.5 text-[10px] text-yellow-600">
                                    <ShieldAlert className="h-3 w-3" /> Verify Compliance
                                  </span>
                                )}
                              </div>
                              <p className={`font-medium ${isRedesign ? "text-base" : "text-sm"}`}>{ve.itemDescription}</p>
                              <div className="flex items-center gap-2 text-xs flex-wrap">
                                <span className="bg-red-50 text-red-700 border border-red-200 rounded px-2 py-0.5">{ve.currentSpec}</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className="bg-green-50 text-green-700 border border-green-200 rounded px-2 py-0.5">{ve.alternativeSpec}</span>
                              </div>
                              {(ve.vendor || ve.model) && (
                                <p className="text-xs text-muted-foreground">Alt: {[ve.vendor, ve.model].filter(Boolean).join(" ")}</p>
                              )}
                              <p className="text-xs text-muted-foreground">{ve.tradeOffs}</p>
                              {ve.implementationNotes && (
                                <p className="text-xs text-muted-foreground italic">Implementation: {ve.implementationNotes}</p>
                              )}
                              {affectedList.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {affectedList.map((a, i) => (
                                    <span key={i} className="text-[10px] bg-muted rounded px-1.5 py-0.5">{a}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`font-bold text-green-600 ${isRedesign ? "text-xl" : "text-lg"}`}>{fmt(Number(ve.estimatedSavings || 0))}</p>
                              {Number(ve.savingsPercent || 0) > 0 && (
                                <p className="text-xs text-green-600 font-medium">-{Number(ve.savingsPercent).toFixed(0)}%</p>
                              )}
                              <p className="text-[10px] text-muted-foreground">estimated savings</p>
                              {ve.status === "pending" && (
                                <div className="flex gap-1 mt-2 justify-end">
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => applyVE(ve)}>
                                    <Check className="h-3 w-3 mr-1" /> Apply
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => dismissVE(ve)}>
                                    <X className="h-3 w-3 mr-1" /> Dismiss
                                  </Button>
                                </div>
                              )}
                              {ve.status === "applied" && <Badge className="mt-2 bg-green-100 text-green-800 border-green-200">Applied</Badge>}
                              {ve.status === "rejected" && <Badge variant="secondary" className="mt-2">Dismissed</Badge>}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}

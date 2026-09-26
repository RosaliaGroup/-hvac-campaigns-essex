import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MousePointerClick,
  Eye,
  Percent,
  ArrowUpDown,
  FileCheck2,
  FileX2,
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  Loader2,
  Target,
  Sparkles,
  Type,
  AlignLeft,
  FileText,
  MessageCircleQuestion,
  Link2,
  Braces,
  RotateCw,
  CheckCircle2,
  ExternalLink,
  AlertTriangle,
  X,
  Clock,
  CloudOff,
  DownloadCloud,
  Copy,
  Check,
  Ban,
  Save,
  Info,
  ShieldAlert,
  DollarSign,
  Lock,
  GitPullRequest,
  Undo2,
  Tag as TagIcon,
  ListChecks,
  Trash2,
  History,
  Download,
  MoreVertical,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import InternalNav from "@/components/InternalNav";
import DashboardFooter from "@/components/DashboardFooter";
import { getLoginUrl } from "@/const";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  SEO_FILTERS,
  applySeoFilters,
  SEO_STATUS_LABELS,
  SEO_ACTION_LABELS,
  SEO_PROBLEM_LABELS,
  SEO_CATEGORY_LABELS,
  INDEX_STATUS_LABELS,
  isNotIndexed,
  seoScoreBand,
  type SeoOpportunity,
  type SeoStatus,
  type SeoAction,
  type SeoFilterKey,
  type AiDraftStatus,
  type BusinessImpact,
} from "@shared/seo";

/**
 * The bulk-approve workflow's own safety net (docs/seo-bulk-approve-spec.md)
 * now gates the actual publish path — buildBatchDiff/approveBatchToPR reject
 * locked pages and BLOCK-level lint findings server-side before anything ever
 * reaches a PR. "Optimize Selected" only ever writes drafts (never publishes),
 * and locked rows are unselectable in the table below (see `lockedByPath`),
 * so it no longer needs its own separate gate.
 */

/** Mirrors server/services/seo/bulkApprove.ts's MAX_BATCH_SIZE. */
const MAX_BULK_APPROVE_BATCH = 20;

/** Mirrors drizzle/schema.ts's SEO_PAGE_TAGS — not imported directly to keep drizzle out of the client bundle. */
const SEO_TAG_OPTIONS = ["claims-review", "locked", "verified-project", "illustrative"] as const;
type SeoPageTagName = (typeof SEO_TAG_OPTIONS)[number];
const SEO_TAG_LABELS: Record<SeoPageTagName, string> = {
  "claims-review": "Claims Review",
  locked: "Locked",
  "verified-project": "Verified Project",
  illustrative: "Illustrative",
};

/* ── Formatting helpers ─────────────────────────────────────────────────── */

const fmtInt = (n: number) => n.toLocaleString();
const fmtPct = (fraction: number, digits = 1) => `${(fraction * 100).toFixed(digits)}%`;
const fmtPos = (n: number) => (n > 0 ? n.toFixed(1) : "—");

/* ── Status + score styling ─────────────────────────────────────────────── */

const STATUS_STYLES: Record<SeoStatus, string> = {
  needs_review: "bg-slate-100 text-slate-700 border-slate-200",
  queued: "bg-blue-100 text-blue-800 border-blue-200",
  optimizing: "bg-indigo-100 text-indigo-800 border-indigo-200",
  waiting_review: "bg-purple-100 text-purple-800 border-purple-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  published: "bg-teal-100 text-teal-800 border-teal-200",
  waiting_for_indexing: "bg-amber-100 text-amber-800 border-amber-200",
  ranking_improved: "bg-green-100 text-green-800 border-green-200",
};

function StatusBadge({ status }: { status: SeoStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap text-xs font-medium px-2.5 py-0.5 rounded-full border ${STATUS_STYLES[status]}`}>
      {SEO_STATUS_LABELS[status]}
    </span>
  );
}

const PRIORITY_STYLES = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
} as const;

function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border capitalize ${PRIORITY_STYLES[priority]}`}>
      {priority}
    </span>
  );
}

const SCORE_BAND_COLOR = {
  good: { text: "text-green-600", bar: "bg-green-500" },
  fair: { text: "text-amber-600", bar: "bg-amber-500" },
  poor: { text: "text-red-600", bar: "bg-red-500" },
} as const;

function ScoreMeter({ score, size = "sm" }: { score: number; size?: "sm" | "lg" }) {
  const band = seoScoreBand(score);
  const color = SCORE_BAND_COLOR[band];
  if (size === "lg") {
    return (
      <div className="w-full">
        <div className="flex items-end gap-1.5">
          <span className={`text-4xl font-bold ${color.text}`}>{score}</span>
          <span className="text-sm text-muted-foreground mb-1">/ 100</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className={`h-full rounded-full ${color.bar}`} style={{ width: `${score}%` }} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 min-w-[92px]">
      <span className={`text-sm font-semibold tabular-nums ${color.text}`}>{score}</span>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full ${color.bar}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

/* ── KPI cards ──────────────────────────────────────────────────────────── */

function DeltaPill({ value, kind }: { value: number; kind: "higher-better" | "lower-better" }) {
  if (!value) return <span className="text-xs text-muted-foreground">No change</span>;
  const isUp = value > 0;
  const good = kind === "higher-better" ? isUp : !isUp;
  const Icon = isUp ? TrendingUp : TrendingDown;
  const magnitude = Math.abs(value);
  const label = kind === "lower-better" ? magnitude.toFixed(1) : fmtPct(magnitude);
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${good ? "text-green-600" : "text-red-600"}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  delta?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">{label}</span>
          <Icon className="h-5 w-5 text-[#ff6b35]" />
        </div>
        <p className="text-3xl font-bold text-[#1e3a5f]">{value}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{hint}</span>
          {delta}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── AI action metadata (drawer + bulk) ─────────────────────────────────── */

const ACTION_ICONS: Record<SeoAction, React.ComponentType<{ className?: string }>> = {
  rewrite_title: Type,
  rewrite_meta: AlignLeft,
  expand_content: FileText,
  generate_faq: MessageCircleQuestion,
  add_internal_links: Link2,
  generate_schema: Braces,
  request_reindex: RotateCw,
  optimize_everything: Sparkles,
};

/** The six content actions shown as a grid in the drawer. */
const CONTENT_ACTIONS: SeoAction[] = [
  "rewrite_title",
  "rewrite_meta",
  "expand_content",
  "generate_faq",
  "add_internal_links",
  "generate_schema",
];

/* ── Detail drawer ──────────────────────────────────────────────────────── */

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="col-span-2 break-words">{children}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-[#1e3a5f]">{value}</p>
    </div>
  );
}

/* ── AI draft workspace (Phase 2) ───────────────────────────────────────── */

const DRAFT_STATUS_STYLE: Record<AiDraftStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  edited: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 gap-1 px-2 text-xs text-muted-foreground"
      disabled={!text}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn't copy to clipboard");
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function SectionHeader({
  title,
  copyText,
  action,
  onRegenerate,
  regenerating,
  disabled,
}: {
  title: string;
  copyText: string;
  action: SeoAction;
  onRegenerate: (a: SeoAction) => void;
  regenerating: boolean;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="flex items-center gap-1">
        <CopyButton text={copyText} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
          disabled={disabled}
          onClick={() => onRegenerate(action)}
        >
          {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Regenerate
        </Button>
      </div>
    </div>
  );
}

function DraftWorkspace({ opportunity, isAdmin }: { opportunity: SeoOpportunity; isAdmin: boolean }) {
  const pageId = Number(opportunity.id);
  const utils = trpc.useUtils();
  const draftQ = trpc.seo.getOptimization.useQuery({ id: pageId });
  const draft = draftQ.data;

  const [edit, setEdit] = useState<{
    title: string;
    metaDescription: string;
    h1: string;
    contentExpansion: string;
    schema: string;
  } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    // Refresh the editable copy from the server draft when we have no pending
    // edits (so generate/regenerate/approve results flow into the fields).
    if (draft && !dirty) {
      setEdit({
        title: draft.title ?? "",
        metaDescription: draft.metaDescription ?? "",
        h1: draft.h1 ?? "",
        contentExpansion: draft.contentExpansion ?? "",
        schema: draft.schema ? JSON.stringify(draft.schema, null, 2) : "",
      });
    }
  }, [draft, dirty]);

  const afterWrite = () => {
    utils.seo.getOptimization.invalidate({ id: pageId });
    utils.seo.getOpportunities.invalidate();
    utils.seo.getBusinessImpact.invalidate();
  };

  const generate = trpc.seo.generateOptimization.useMutation({
    onSuccess: () => { setDirty(false); afterWrite(); toast.success("Draft generated"); },
    onError: (e) => toast.error(e.message),
  });
  const regenerate = trpc.seo.regenerateOptimization.useMutation({
    onSuccess: () => { setDirty(false); afterWrite(); toast.success("Draft regenerated"); },
    onError: (e) => toast.error(e.message),
  });
  const save = trpc.seo.updateOptimizationDraft.useMutation({
    onSuccess: () => { setDirty(false); afterWrite(); toast.success("Edits saved"); },
    onError: (e) => toast.error(e.message),
  });
  const approve = trpc.seo.approveOptimization.useMutation({
    onSuccess: () => { afterWrite(); toast.success("Marked reviewed — use \"Approve to PR\" to publish"); },
    onError: (e) => toast.error(e.message),
  });
  const reject = trpc.seo.rejectOptimization.useMutation({
    onSuccess: () => { afterWrite(); toast.success("Draft rejected — page back to needs review"); },
    onError: (e) => toast.error(e.message),
  });

  const busy =
    generate.isPending || regenerate.isPending || save.isPending || approve.isPending || reject.isPending;
  const genAction = generate.isPending ? generate.variables?.action : undefined;
  const regenAction = regenerate.isPending ? regenerate.variables?.action : undefined;
  const writeDisabled = !isAdmin || busy;

  const hasDraft =
    !!draft &&
    !!(
      draft.title ||
      draft.metaDescription ||
      draft.h1 ||
      draft.contentExpansion ||
      draft.faq.length > 0 ||
      draft.internalLinks.length > 0 ||
      draft.schema
    );

  const doGenerate = (action: SeoAction) => generate.mutate({ id: pageId, action });
  const doRegenerate = (action: SeoAction) => regenerate.mutate({ id: pageId, action });

  const onSave = () => {
    if (!edit) return;
    let schemaVal: Record<string, unknown> | null = null;
    if (edit.schema.trim()) {
      try {
        schemaVal = JSON.parse(edit.schema) as Record<string, unknown>;
      } catch {
        toast.error("Schema must be valid JSON");
        return;
      }
    }
    save.mutate({
      id: pageId,
      patch: {
        title: edit.title || null,
        metaDescription: edit.metaDescription || null,
        h1: edit.h1 || null,
        contentExpansion: edit.contentExpansion || null,
        schema: schemaVal,
      },
    });
  };

  const field = (k: "title" | "metaDescription" | "h1" | "contentExpansion" | "schema", v: string) => {
    setEdit((p) => (p ? { ...p, [k]: v } : p));
    setDirty(true);
  };

  const faqText = (draft?.faq ?? []).map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
  const linksText = (draft?.internalLinks ?? [])
    .map((l) => `${l.anchor} → ${l.targetPath} (${l.rationale})`)
    .join("\n");

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Drafts only — nothing here is published to your live site. "Mark Reviewed" only flags a draft as human-checked; it does not publish. Publishing happens exclusively through "Approve to PR" below the table, which opens a pull request a human still has to merge on GitHub.</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#1e3a5f]">AI Draft</span>
          {draft && (
            <Badge variant="outline" className={`text-xs ${DRAFT_STATUS_STYLE[draft.status]}`}>
              {draft.status === "edited" ? "Edited" : draft.status === "approved" ? "Reviewed" : "Draft"}
            </Badge>
          )}
          {draft?.model && draft.model !== "none" && (
            <span className="text-xs text-muted-foreground">· {draft.model}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={writeDisabled || !hasDraft} onClick={() => reject.mutate({ id: pageId })}>
            <Ban className="mr-1.5 h-4 w-4" /> Reject
          </Button>
          <Button type="button" size="sm" className="bg-emerald-600 hover:bg-emerald-600/90" disabled={writeDisabled || !hasDraft} onClick={() => approve.mutate({ id: pageId })}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark Reviewed
          </Button>
        </div>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
          <ShieldAlert className="h-4 w-4 shrink-0" /> Admin access is required to generate, edit, or approve drafts.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {CONTENT_ACTIONS.map((action) => {
          const Icon = ACTION_ICONS[action];
          return (
            <Button key={action} type="button" variant="outline" size="sm" className="justify-start" disabled={writeDisabled} onClick={() => doGenerate(action)}>
              {genAction === action ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
              {SEO_ACTION_LABELS[action]}
            </Button>
          );
        })}
      </div>
      <Button type="button" size="sm" className="w-full justify-center bg-[#ff6b35] hover:bg-[#ff6b35]/90" disabled={writeDisabled} onClick={() => doGenerate("optimize_everything")}>
        {genAction === "optimize_everything" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        {SEO_ACTION_LABELS.optimize_everything}
      </Button>

      {draftQ.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading draft…
        </div>
      ) : !hasDraft ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No draft yet — generate one above.</p>
      ) : edit ? (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <SectionHeader title="SEO Title" copyText={edit.title} action="rewrite_title" onRegenerate={doRegenerate} regenerating={regenAction === "rewrite_title"} disabled={writeDisabled} />
            <Input value={edit.title} onChange={(e) => field("title", e.target.value)} disabled={!isAdmin} placeholder="No title drafted yet" />
            <p className="text-[11px] text-muted-foreground">{edit.title.length}/60 characters</p>
          </div>

          <div className="space-y-1.5">
            <SectionHeader title="H1 Heading" copyText={edit.h1} action="rewrite_title" onRegenerate={doRegenerate} regenerating={regenAction === "rewrite_title"} disabled={writeDisabled} />
            <Input value={edit.h1} onChange={(e) => field("h1", e.target.value)} disabled={!isAdmin} placeholder="No H1 drafted yet" />
          </div>

          <div className="space-y-1.5">
            <SectionHeader title="Meta Description" copyText={edit.metaDescription} action="rewrite_meta" onRegenerate={doRegenerate} regenerating={regenAction === "rewrite_meta"} disabled={writeDisabled} />
            <Textarea rows={3} value={edit.metaDescription} onChange={(e) => field("metaDescription", e.target.value)} disabled={!isAdmin} placeholder="No meta description drafted yet" />
            <p className="text-[11px] text-muted-foreground">{edit.metaDescription.length}/158 characters</p>
          </div>

          <div className="space-y-1.5">
            <SectionHeader title="Content Expansion" copyText={edit.contentExpansion} action="expand_content" onRegenerate={doRegenerate} regenerating={regenAction === "expand_content"} disabled={writeDisabled} />
            <Textarea rows={8} className="font-mono text-xs" value={edit.contentExpansion} onChange={(e) => field("contentExpansion", e.target.value)} disabled={!isAdmin} placeholder="No content drafted yet" />
          </div>

          <div className="space-y-1.5">
            <SectionHeader title="FAQ" copyText={faqText} action="generate_faq" onRegenerate={doRegenerate} regenerating={regenAction === "generate_faq"} disabled={writeDisabled} />
            {draft && draft.faq.length > 0 ? (
              <ul className="space-y-2">
                {draft.faq.map((f, i) => (
                  <li key={i} className="rounded-md border p-2.5 text-sm">
                    <p className="font-medium text-[#1e3a5f]">{f.question}</p>
                    <p className="mt-0.5 text-muted-foreground">{f.answer}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No FAQ drafted yet.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <SectionHeader title="Internal Links" copyText={linksText} action="add_internal_links" onRegenerate={doRegenerate} regenerating={regenAction === "add_internal_links"} disabled={writeDisabled} />
            {draft && draft.internalLinks.length > 0 ? (
              <ul className="space-y-2">
                {draft.internalLinks.map((l, i) => (
                  <li key={i} className="rounded-md border p-2.5 text-sm">
                    <p className="font-medium text-[#1e3a5f]">
                      {l.anchor} <span className="font-normal text-muted-foreground">→ {l.targetPath}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{l.rationale}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No internal links drafted yet.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <SectionHeader title="Service / FAQ Schema (JSON-LD)" copyText={edit.schema} action="generate_schema" onRegenerate={doRegenerate} regenerating={regenAction === "generate_schema"} disabled={writeDisabled} />
            <Textarea rows={8} className="font-mono text-xs" value={edit.schema} onChange={(e) => field("schema", e.target.value)} disabled={!isAdmin} placeholder="No schema drafted yet" />
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-3">
            {dirty && <span className="text-xs text-amber-700">Unsaved edits</span>}
            <Button type="button" size="sm" variant="outline" disabled={writeDisabled || !dirty} onClick={onSave}>
              {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Save edits
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BusinessImpactPanel({ data, loading }: { data?: BusinessImpact; loading: boolean }) {
  const [show, setShow] = useState(false);
  const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const rows = data
    ? [
        { label: "Clicks / mo", cur: data.current.clicks, proj: data.projected.clicks },
        { label: "Leads", cur: data.current.leads, proj: data.projected.leads },
        { label: "Appointments", cur: data.current.appointments, proj: data.projected.appointments },
        { label: "Estimates", cur: data.current.estimates, proj: data.projected.estimates },
      ]
    : [];
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base text-[#1e3a5f]">
              <DollarSign className="h-4 w-4 text-[#ff6b35]" /> Projected Business Impact
            </CardTitle>
            <CardDescription>Estimated upside if drafted optimizations are approved and rankings improve.</CardDescription>
          </div>
          <button onClick={() => setShow((s) => !s)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Info className="h-3.5 w-3.5" /> {show ? "Hide" : "Assumptions"}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculating…
          </div>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {rows.map((r) => (
                <div key={r.label} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{r.label}</p>
                  <p className="text-lg font-bold text-[#1e3a5f]">{fmtInt(r.proj)}</p>
                  <p className="text-[11px] text-muted-foreground">now {fmtInt(r.cur)}</p>
                </div>
              ))}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">Est. revenue / mo</p>
                <p className="text-lg font-bold text-emerald-700">{fmtMoney(data.projected.revenue)}</p>
                <p className="text-[11px] text-emerald-700">+{fmtMoney(data.deltaRevenue)}</p>
              </div>
            </div>
            {show && (
              <div className="mt-3 space-y-1 rounded-lg border bg-slate-50 p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-[#1e3a5f]">Estimate assumptions (placeholder until live CRM attribution lands):</p>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3">
                  <li>Click → lead: {fmtPct(data.conversions.clickToLead)}</li>
                  <li>Lead → appointment: {fmtPct(data.conversions.leadToAppointment)}</li>
                  <li>Appt → estimate: {fmtPct(data.conversions.appointmentToEstimate)}</li>
                  <li>Estimate → won: {fmtPct(data.conversions.estimateToWon)}</li>
                  <li>Avg job value: {fmtMoney(data.conversions.avgJobValue)}</li>
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Tags (spec §4) ──────────────────────────────────────────────────────── */

function TagMenu({ pagePath, isAdmin }: { pagePath: string; isAdmin: boolean }) {
  const utils = trpc.useUtils();
  const tagsQ = trpc.seo.getTags.useQuery({ pagePath });
  const [removeTarget, setRemoveTarget] = useState<SeoPageTagName | null>(null);
  const [removeNote, setRemoveNote] = useState("");

  const afterWrite = () => {
    utils.seo.getTags.invalidate({ pagePath });
    utils.seo.getLockStatus.invalidate();
  };

  const addTag = trpc.seo.addTag.useMutation({
    onSuccess: () => { afterWrite(); toast.success("Tag added"); },
    onError: (e) => toast.error(e.message),
  });
  const removeTag = trpc.seo.removeTag.useMutation({
    onSuccess: () => { afterWrite(); toast.success("Tag removed"); setRemoveTarget(null); setRemoveNote(""); },
    onError: (e) => toast.error(e.message),
  });

  const active = new Set((tagsQ.data ?? []).map((t) => t.tag as SeoPageTagName));
  const busy = addTag.isPending || removeTag.isPending;

  const requestRemove = (tag: SeoPageTagName) => {
    if (tag === "claims-review") {
      setRemoveTarget(tag); // claims-review requires a note — confirm inline below
      return;
    }
    removeTag.mutate({ pagePath, tag, note: null });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground" disabled={!isAdmin || busy}>
              <TagIcon className="h-3.5 w-3.5" /> Add tag
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SEO_TAG_OPTIONS.filter((t) => !active.has(t)).map((t) => (
              <DropdownMenuItem key={t} onClick={() => addTag.mutate({ pagePath, tag: t, note: null })}>
                {SEO_TAG_LABELS[t]}
              </DropdownMenuItem>
            ))}
            {SEO_TAG_OPTIONS.every((t) => active.has(t)) && (
              <DropdownMenuItem disabled>All tags applied</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {tagsQ.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading tags…</p>
      ) : active.size === 0 ? (
        <p className="text-xs text-muted-foreground">No tags on this page.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {Array.from(active).map((t) => (
            <li key={t}>
              <Badge variant="outline" className="gap-1 text-xs">
                {SEO_TAG_LABELS[t]}
                {isAdmin && (
                  <button type="button" className="ml-0.5 text-muted-foreground hover:text-foreground" disabled={busy} onClick={() => requestRemove(t)} aria-label={`Remove ${SEO_TAG_LABELS[t]}`}>
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {removeTarget === "claims-review" && (
        <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
          <p className="text-xs text-amber-800">Removing "Claims Review" requires a note (why it's now verified).</p>
          <Textarea rows={2} value={removeNote} onChange={(e) => setRemoveNote(e.target.value)} placeholder="e.g. Phone number confirmed canonical 2026-09-25" className="text-xs" />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => { setRemoveTarget(null); setRemoveNote(""); }}>Cancel</Button>
            <Button
              type="button"
              size="sm"
              disabled={!removeNote.trim() || removeTag.isPending}
              onClick={() => removeTag.mutate({ pagePath, tag: "claims-review", note: removeNote.trim() })}
            >
              Confirm removal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OpportunityDrawer({
  opportunity,
  open,
  onClose,
  isAdmin,
}: {
  opportunity: SeoOpportunity | null;
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}) {
  const o = opportunity;
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
        {o && (
          <>
            <SheetHeader className="border-b p-5">
              <div className="flex items-center gap-2">
                <PriorityBadge priority={o.priority} />
                <StatusBadge status={o.status} />
                <Badge variant="outline" className="text-xs">{SEO_CATEGORY_LABELS[o.category]}</Badge>
              </div>
              <SheetTitle className="text-[#1e3a5f] break-words">{o.page}</SheetTitle>
              <SheetDescription className="flex items-center gap-1">
                <a href={o.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#ff6b35] hover:underline break-all">
                  {o.url}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 p-5">
              {/* AI SEO Score */}
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-[#1e3a5f]">AI SEO Score</span>
                  <span className="text-xs text-muted-foreground">Placeholder</span>
                </div>
                <ScoreMeter score={o.seoScore} size="lg" />
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Problems</p>
                  {o.problems.length === 0 ? (
                    <p className="flex items-center gap-1.5 text-sm text-green-600">
                      <CheckCircle2 className="h-4 w-4" /> No outstanding problems
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {o.problems.map((p) => (
                        <li key={p} className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">
                          <AlertTriangle className="h-3 w-3" />
                          {SEO_PROBLEM_LABELS[p]}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Clicks" value={fmtInt(o.clicks)} />
                <Metric label="Impressions" value={fmtInt(o.impressions)} />
                <Metric label="CTR" value={fmtPct(o.ctr, 2)} />
                <Metric label="Avg. Position" value={fmtPos(o.position)} />
              </div>

              {/* On-page details */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">On-page</p>
                <div className="divide-y">
                  <DetailRow label="Current title">{o.title || "—"}</DetailRow>
                  <DetailRow label="Meta description">{o.metaDescription || "—"}</DetailRow>
                  <DetailRow label="H1">{o.h1 || "—"}</DetailRow>
                  <DetailRow label="Indexed status">
                    <span className={isNotIndexed(o.indexStatus) ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                      {INDEX_STATUS_LABELS[o.indexStatus]}
                    </span>
                  </DetailRow>
                  <DetailRow label="Last indexed">
                    {o.lastIndexedAt ? new Date(o.lastIndexedAt).toLocaleDateString() : "—"}
                  </DetailRow>
                  <DetailRow label="Search Console">{o.searchConsoleIssue || "—"}</DetailRow>
                </div>
              </div>

              <Separator />

              {/* Tags (spec §4) — claims-review here locks the page out of bulk-approve */}
              <TagMenu pagePath={o.page} isAdmin={isAdmin} />

              <Separator />

              {/* AI draft workspace */}
              <DraftWorkspace opportunity={o} isAdmin={isAdmin} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ── Bulk-approve modal (spec §5) ───────────────────────────────────────── */

function LintFindingList({ findings }: { findings: { severity: "block" | "warn"; code: string; message: string; field: string }[] }) {
  if (findings.length === 0) return <span className="text-xs text-emerald-700">Clean</span>;
  return (
    <ul className="space-y-1.5">
      {findings.map((f, i) => (
        <li key={i} className={`text-xs ${f.severity === "block" ? "text-red-700" : "text-amber-700"}`}>
          <div className="flex flex-wrap items-center gap-1">
            <span>{f.severity === "block" ? "⛔" : "⚠️"}</span>
            <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[10px]">{f.code}</code>
            <span className="rounded-full border border-current/30 px-1.5 py-0 text-[10px] uppercase tracking-wide opacity-80">{f.field}</span>
          </div>
          <p className="mt-0.5">{f.message}</p>
        </li>
      ))}
    </ul>
  );
}

function BulkApproveModal({
  open,
  onClose,
  pageIds: initialPageIds,
  onApproved,
  onRemovePage,
}: {
  open: boolean;
  onClose: () => void;
  pageIds: number[];
  onApproved: () => void;
  /** Keeps the table's own selection in sync when a row is deselected from inside the modal. */
  onRemovePage: (pageId: number) => void;
}) {
  const utils = trpc.useUtils();
  const [label, setLabel] = useState("");
  // Local, mutable copy of the batch — lets the reviewer deselect a
  // lint-blocked row without leaving the modal (spec: "fix or deselect").
  const [pageIds, setPageIds] = useState<number[]>(initialPageIds);
  const buildDiff = trpc.seo.buildBatchDiff.useMutation();
  const approve = trpc.seo.approveBatchToPR.useMutation();
  const initialKey = initialPageIds.join(",");

  useEffect(() => {
    if (open) {
      setLabel("");
      setPageIds(initialPageIds);
    }
    // Reseed only when the modal opens for a (possibly new) selection — not
    // on every render, since initialPageIds is a fresh array each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialKey]);

  const key = pageIds.join(",");
  useEffect(() => {
    if (open && pageIds.length > 0) {
      buildDiff.mutate({ pageIds });
    }
    // Re-run whenever the local batch changes (fresh open, or a row removed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key]);

  const rows = buildDiff.data?.rows ?? [];
  const hasBlockers = rows.some((r) => !r.lint.passes);
  const hasBodyChanges = rows.some((r) => r.hasBodyChanges);

  const removeRow = (pageId: number) => {
    setPageIds((prev) => prev.filter((id) => id !== pageId));
    onRemovePage(pageId);
  };

  const handleApprove = () => {
    if (!label.trim() || pageIds.length === 0) return;
    approve.mutate(
      { pageIds, label: label.trim() },
      {
        onSuccess: (res) => {
          toast.success(`Batch approved — PR #${res.prNumber} opened`);
          utils.seo.listBatches.invalidate();
          utils.seo.getOpportunities.invalidate();
          onApproved();
          onClose();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1e3a5f]">
            <GitPullRequest className="h-5 w-5 text-[#ff6b35]" /> Approve to PR — {pageIds.length} page{pageIds.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Title &amp; meta description only. This opens a pull request — nothing publishes until a human merges it on GitHub.
            {hasBlockers && " Pages that fail the claims linter are shown below — fix the draft or remove the row to continue."}
          </DialogDescription>
        </DialogHeader>

        {pageIds.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Every page was removed from this batch. Close and reselect from the table.</p>
        ) : buildDiff.isPending ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Building diff…
          </div>
        ) : buildDiff.isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{buildDiff.error.message}</div>
        ) : (
          <>
            {hasBodyChanges && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                Some drafts also contain body/H1/FAQ/schema changes — only title/meta will be applied here. Review those individually via the single-page Optimize flow.
              </div>
            )}
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr className="border-b">
                    <th className="p-2 text-left font-medium">Page</th>
                    <th className="p-2 text-left font-medium">Title</th>
                    <th className="p-2 text-left font-medium">Meta description</th>
                    <th className="p-2 text-left font-medium">Lint</th>
                    <th className="p-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.pageId} className={`border-b last:border-0 align-top ${!r.lint.passes ? "bg-red-50/60" : ""}`}>
                      <td className="p-2 font-medium text-[#1e3a5f] whitespace-nowrap">{r.pagePath}</td>
                      <td className="p-2 max-w-[220px]">
                        <p className="text-muted-foreground line-through decoration-muted-foreground/50">{r.before.title || "—"}</p>
                        <p>{r.after.title}</p>
                      </td>
                      <td className="p-2 max-w-[260px]">
                        <p className="text-muted-foreground line-through decoration-muted-foreground/50">{r.before.description || "—"}</p>
                        <p>{r.after.description}</p>
                      </td>
                      <td className="p-2 min-w-[180px]"><LintFindingList findings={r.lint.findings} /></td>
                      <td className="p-2 align-top">
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={() => removeRow(r.pageId)} aria-label={`Remove ${r.pagePath} from this batch`}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Batch label</label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. city-pages-essex-title-meta" />
            </div>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            className="bg-[#ff6b35] hover:bg-[#ff6b35]/90"
            disabled={pageIds.length === 0 || buildDiff.isPending || !!buildDiff.error || hasBlockers || !label.trim() || approve.isPending}
            onClick={handleApprove}
          >
            {approve.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <GitPullRequest className="mr-1.5 h-4 w-4" />}
            Approve to PR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Batch history + revert (spec §5, §6) ───────────────────────────────── */

const BATCH_STATUS_STYLE: Record<string, string> = {
  pr_open: "bg-blue-100 text-blue-800 border-blue-200",
  merged: "bg-emerald-100 text-emerald-800 border-emerald-200",
  reverted: "bg-slate-100 text-slate-700 border-slate-200",
  failed: "bg-red-100 text-red-800 border-red-200",
};

function BatchHistoryPanel() {
  const utils = trpc.useUtils();
  const batchesQ = trpc.seo.listBatches.useQuery();
  const revert = trpc.seo.revertBatch.useMutation({
    onSuccess: (res) => {
      toast.success(`Revert PR #${res.prNumber} opened`);
      utils.seo.listBatches.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const batches = [...(batchesQ.data ?? [])].reverse();
  if (batchesQ.isLoading || batches.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-[#1e3a5f]">
          <History className="h-4 w-4 text-[#ff6b35]" /> Bulk-Approve Batches
        </CardTitle>
        <CardDescription>Every batch opens a PR — merges happen on GitHub, never here.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {batches.slice(0, 10).map((b) => {
            const pages = b.pages as string[];
            return (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-[#1e3a5f]">
                    {b.label} {b.revertsBatchId ? <span className="text-xs text-muted-foreground">(reverts #{b.revertsBatchId})</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pages.length} page{pages.length === 1 ? "" : "s"} · {new Date(b.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${BATCH_STATUS_STYLE[b.status] ?? ""}`}>{b.status.replace("_", " ")}</Badge>
                  {b.prUrl && (
                    <a href={b.prUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#ff6b35] hover:underline">
                      PR #{b.prNumber} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {b.status === "merged" && (
                    <Button type="button" size="sm" variant="outline" disabled={revert.isPending} onClick={() => revert.mutate({ batchId: b.id })}>
                      {revert.isPending && revert.variables?.batchId === b.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Undo2 className="mr-1.5 h-3.5 w-3.5" />}
                      Revert
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ── Audit log (spec §7) ─────────────────────────────────────────────────── */

function AuditLogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const logQ = trpc.seo.getAuditLog.useQuery(undefined, { enabled: open });
  const utils = trpc.useUtils();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { csv } = await utils.seo.exportAuditLogCsv.fetch();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `seo-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const rows = logQ.data ?? [];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-[#1e3a5f]">
            <ListChecks className="h-5 w-5 text-[#ff6b35]" /> Audit Log
          </SheetTitle>
          <SheetDescription>Every bulk-approve action — drafts, PRs, tags, reindex.</SheetDescription>
        </SheetHeader>
        <div className="p-5 pt-0">
          <Button type="button" size="sm" variant="outline" className="mb-4" disabled={exporting} onClick={handleExport}>
            {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
            Export CSV
          </Button>
          {logQ.isLoading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No audit events yet.</p>
          ) : (
            <ul className="divide-y">
              {rows.map((r) => (
                <li key={r.id} className="py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[#1e3a5f]">{r.action.replace(/_/g, " ")}</span>
                    <span className="text-xs text-muted-foreground">{new Date(r.ts).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.pagePath ?? "—"} {r.batchId ? `· batch #${r.batchId}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── Draft management (spec §8) ─────────────────────────────────────────── */

function DiscardAllDraftsButton({ isAdmin }: { isAdmin: boolean }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const discard = trpc.seo.discardAllDrafts.useMutation({
    onSuccess: (res) => {
      utils.seo.getOpportunities.invalidate();
      utils.seo.getBusinessImpact.invalidate();
      toast.success(`Discarded ${res.discarded} draft${res.discarded === 1 ? "" : "s"}`);
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={!isAdmin}>
          <Trash2 className="h-4 w-4 mr-1.5" /> Discard All Drafts
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard all drafts?</AlertDialogTitle>
          <AlertDialogDescription>
            This clears every drafted title, meta description, and content across all pages and logs a "draft
            discarded" event for each one. Pages return to "needs review". It does not undo anything already
            approved to a PR.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={discard.isPending} onClick={() => discard.mutate()}>
            {discard.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Discard all
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function SeoIntelligence() {
  const { loading, isAuthenticated, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const overview = trpc.seo.getOverview.useQuery(undefined, { enabled: isAuthenticated });
  const opportunities = trpc.seo.getOpportunities.useQuery(undefined, { enabled: isAuthenticated });
  const syncStatus = trpc.seo.getSyncStatus.useQuery(undefined, { enabled: isAuthenticated });
  const businessImpact = trpc.seo.getBusinessImpact.useQuery(undefined, { enabled: isAuthenticated });
  const githubConfigured = trpc.seo.githubConfigured.useQuery(undefined, { enabled: isAuthenticated });
  const aiProviderStatus = trpc.seo.aiProviderStatus.useQuery(undefined, { enabled: isAuthenticated });
  // Lock status covers every synced page (not just the filtered view) so
  // selection stays correct if a filter changes after the query lands.
  const allPaths = (opportunities.data ?? []).map((o) => o.page);
  const lockStatus = trpc.seo.getLockStatus.useQuery(
    { paths: allPaths },
    { enabled: isAuthenticated && allPaths.length > 0 },
  );

  const [activeFilters, setActiveFilters] = useState<SeoFilterKey[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    succeeded: number;
    failed: number;
    failures: { pageId: number; error: string }[];
  } | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  const invalidate = () => {
    utils.seo.getOpportunities.invalidate();
    utils.seo.getOverview.invalidate();
    utils.seo.getBusinessImpact.invalidate();
  };

  const sync = trpc.seo.sync.useMutation({
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(`Synced ${res.pagesSynced} pages from Search Console`);
      } else if (res.reason === "unavailable") {
        toast.error("Search Console unavailable — connect Google in Integrations");
      } else if (res.reason === "no_db") {
        toast.error("Database not configured");
      } else if (res.reason === "already_running") {
        toast.message("A sync is already running");
      } else {
        toast.error(res.error ?? "Sync failed");
      }
      invalidate();
      utils.seo.getSyncStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const bulkGenerate = trpc.seo.bulkGenerateOptimization.useMutation({
    onSuccess: (res, vars) => {
      invalidate();
      setBulkResult({
        succeeded: res.succeeded,
        failed: res.failed,
        failures: res.results.filter((r) => !r.ok).map((r) => ({ pageId: r.pageId, error: !r.ok ? r.error : "" })),
      });
      const label = SEO_ACTION_LABELS[vars.action];
      if (res.failed === 0) {
        toast.success(`${label} · ${res.succeeded} page${res.succeeded === 1 ? "" : "s"} drafted`);
      } else {
        toast.message(`${label} · ${res.succeeded} drafted, ${res.failed} failed`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const setStatus = trpc.seo.setStatus.useMutation({
    onSuccess: ({ updated }) => {
      invalidate();
      toast.success(`Marked complete · ${updated.length} page${updated.length === 1 ? "" : "s"}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const regenerateUnlocked = trpc.seo.regenerateUnlockedDrafts.useMutation({
    onSuccess: (res) => {
      invalidate();
      const ok = res.results.filter((r) => r.ok).length;
      const failed = res.results.length - ok;
      const skipped = res.skippedLocked.length;
      toast.success(
        `Regenerated ${ok} draft${ok === 1 ? "" : "s"}${failed > 0 ? `, ${failed} failed` : ""}${skipped > 0 ? `, ${skipped} skipped (locked)` : ""}`,
      );
    },
    onError: (err) => toast.error(err.message),
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35]"></div>
      </div>
    );
  }
  if (!isAuthenticated) return null;

  const o = overview.data;
  const rows: SeoOpportunity[] = opportunities.data ?? [];
  const filtered = applySeoFilters(rows, activeFilters);
  const drawerOpportunity = drawerId ? rows.find((r) => r.id === drawerId) ?? null : null;
  const lockedByPath = lockStatus.data ?? {};
  const isPageLocked = (page: string) => !!lockedByPath[page]?.locked;

  // Selection is scoped to the currently-visible (filtered), UNLOCKED rows —
  // locked pages are unselectable everywhere (spec §2: "render them
  // unselectable ... UI hiding alone is not acceptable"), so this single
  // filter is what keeps every bulk action (Optimize, Reindex, Approve to
  // PR) off quarantined pages without a separate gate per button.
  const filteredIds = filtered.filter((r) => !isPageLocked(r.page)).map((r) => r.id);
  const selectedVisible = filteredIds.filter((id) => selectedIds.has(id));
  const allVisibleSelected = filteredIds.length > 0 && selectedVisible.length === filteredIds.length;
  const someVisibleSelected = selectedVisible.length > 0 && !allVisibleSelected;

  const toggleFilter = (key: SeoFilterKey) =>
    setActiveFilters((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleSelectAll = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filteredIds.forEach((id) => next.delete(id));
      } else {
        filteredIds.forEach((id) => next.add(id));
      }
      return next;
    });

  const clearSelection = () => setSelectedIds(new Set());

  const toIds = (ids: string[]) => ids.map(Number).filter(Number.isInteger);

  const bulkOptimize = () => {
    setBulkResult(null);
    // Selection stays put (unlike the other bulk actions below) — these are
    // exactly the rows a reviewer wants to go straight from drafting into
    // "Approve to PR" for, without re-selecting them.
    bulkGenerate.mutate({ ids: toIds(selectedVisible), action: "optimize_everything" });
  };
  const bulkReindex = () => {
    setBulkResult(null);
    bulkGenerate.mutate({ ids: toIds(selectedVisible), action: "request_reindex" });
    clearSelection();
  };
  const bulkComplete = () => {
    setStatus.mutate({ ids: selectedVisible, status: "published" });
    clearSelection();
  };
  const bulkRegenerateUnlocked = () => {
    // Selection stays put — same reasoning as bulkOptimize above.
    regenerateUnlocked.mutate({ ids: toIds(selectedVisible) });
  };
  /** "Select Drafted" shortcut — every unlocked, currently-filtered row that already has AI-drafted content (status flips to "optimizing" once a draft exists). */
  const selectDrafted = () => {
    setSelectedIds(new Set(filtered.filter((r) => r.status === "optimizing" && !isPageLocked(r.page)).map((r) => r.id)));
  };

  const handleRefresh = () => {
    overview.refetch();
    opportunities.refetch();
    toast.success("Refreshing SEO data…");
  };

  const leadsPct = o ? Math.min(100, Math.round((o.organicLeads.thisMonth / o.organicLeads.goal) * 100)) : 0;

  return (
    <div className="min-h-screen bg-secondary/30">
      <InternalNav />

      <div className="container py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-[#1e3a5f] mb-2 flex items-center gap-3">
                <Search className="h-8 w-8 text-[#ff6b35]" />
                SEO Intelligence
              </h1>
              <p className="text-muted-foreground">
                Your morning work queue — the exact pages to optimize to hit your lead goal
                {o ? ` · ${o.rangeLabel}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setAuditOpen(true)}>
                <ListChecks className="h-4 w-4 mr-1.5" />
                Audit Log
              </Button>
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button className="bg-[#ff6b35] hover:bg-[#ff6b35]/90" disabled={sync.isPending} onClick={() => sync.mutate()}>
                {sync.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <DownloadCloud className="h-4 w-4 mr-2" />}
                Sync from Google
              </Button>
            </div>
          </div>
          {aiProviderStatus.data?.isMock && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              AI drafts are placeholder mock content (provider "{aiProviderStatus.data.model}") — not researched or verified. "Approve to PR" is disabled until a real AI provider is configured.
            </div>
          )}
          {!githubConfigured.isLoading && githubConfigured.data && !githubConfigured.data.configured && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              GitHub not configured — set <code className="font-mono">SEO_GITHUB_TOKEN</code> to enable "Approve to PR".
            </div>
          )}
        </div>

        {/* Organic Leads — the metric that matters */}
        <Card className="mb-6 border-[#ff6b35]/40 bg-gradient-to-br from-[#ff6b35]/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#ff6b35]/10">
                  <Target className="h-7 w-7 text-[#ff6b35]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Organic Leads · This month</p>
                  <p className="text-4xl font-bold text-[#1e3a5f]">
                    {o ? o.organicLeads.thisMonth : "—"}
                    <span className="text-lg font-medium text-muted-foreground"> / {o ? o.organicLeads.goal : "—"} goal</span>
                  </p>
                </div>
              </div>
              <div className="min-w-[220px] flex-1">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-[#1e3a5f]">{leadsPct}% to goal</span>
                  <span className="text-muted-foreground">{o ? o.organicLeads.goal - o.organicLeads.thisMonth : "—"} to go</span>
                </div>
                <Progress value={leadsPct} className="h-2.5" />
                <p className="mt-1.5 text-xs text-muted-foreground">Clicks are a means to an end — leads are the goal. Sourced from your CRM soon.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sync status / freshness banner */}
        {(() => {
          const ss = syncStatus.data;
          if (!ss) return null;
          const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "never");
          // Warn when Search Console is unavailable, has never synced, or last run errored.
          if (!ss.connected || ss.stale || ss.lastRunStatus === "error") {
            return (
              <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <CloudOff className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {ss.connected ? "Showing the last successful sync" : "Not yet synced with Google Search Console"}
                  </p>
                  <p className="text-amber-800">
                    {ss.connected
                      ? `Live refresh is unavailable right now. Last successful sync: ${fmt(ss.lastSuccessAt)} (${ss.pagesSynced} pages).`
                      : "Connect Google in Integrations, then click “Sync from Google” to populate this dashboard."}
                    {ss.lastError ? ` Last error: ${ss.lastError}` : ""}
                  </p>
                </div>
              </div>
            );
          }
          return (
            <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Last synced from Search Console: {fmt(ss.lastSuccessAt)} · {ss.pagesSynced} pages
            </div>
          );
        })()}

        {/* KPI cards */}
        {overview.isLoading || !o ? (
          <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading SEO metrics…
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8">
            <KpiCard label="Organic Clicks" value={fmtInt(o.organicClicks)} hint="vs prev. 28 days" icon={MousePointerClick} delta={<DeltaPill value={o.deltas.organicClicks} kind="higher-better" />} />
            <KpiCard label="Impressions" value={fmtInt(o.impressions)} hint="vs prev. 28 days" icon={Eye} delta={<DeltaPill value={o.deltas.impressions} kind="higher-better" />} />
            <KpiCard label="CTR" value={fmtPct(o.ctr, 2)} hint="Click-through rate" icon={Percent} delta={<DeltaPill value={o.deltas.ctr} kind="higher-better" />} />
            <KpiCard label="Average Position" value={o.averagePosition.toFixed(1)} hint="Lower is better" icon={ArrowUpDown} delta={<DeltaPill value={o.deltas.averagePosition} kind="lower-better" />} />
            <KpiCard label="Indexed Pages" value={fmtInt(o.indexedPages)} hint="In Google's index" icon={FileCheck2} />
            <KpiCard label="Not Indexed Pages" value={fmtInt(o.notIndexedPages)} hint="Excluded / pending" icon={FileX2} />
          </div>
        )}

        {/* Projected business impact (transparent estimates) */}
        <BusinessImpactPanel data={businessImpact.data} loading={businessImpact.isLoading} />

        {/* Bulk-approve batch history + revert (spec §5, §6) */}
        <BatchHistoryPanel />

        {/* SEO Opportunities work queue */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[#ff6b35]" />
                  SEO Opportunities
                </CardTitle>
                <CardDescription>Pages with the highest upside, ranked by priority</CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs">
                {filtered.length} of {rows.length}
              </Badge>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 pt-3">
              {SEO_FILTERS.map((f) => {
                const active = activeFilters.includes(f.key);
                return (
                  <button
                    key={f.key}
                    onClick={() => toggleFilter(f.key)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "border-[#ff6b35] bg-[#ff6b35] text-white"
                        : "border-border bg-background text-foreground hover:bg-accent"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
              {activeFilters.length > 0 && (
                <button onClick={() => setActiveFilters([])} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" /> Clear filters
                </button>
              )}
              <div className="ml-auto flex items-center gap-3">
                <button onClick={selectDrafted} className="inline-flex items-center gap-1 text-xs text-[#ff6b35] hover:underline">
                  <Sparkles className="h-3 w-3" /> Select Drafted
                </button>
                <DiscardAllDraftsButton isAdmin={isAdmin} />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {/* Bulk action bar — locked pages are excluded from selection entirely (see filteredIds above), so every button here already only ever acts on unlocked rows. */}
            {selectedVisible.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#ff6b35]/30 bg-[#ff6b35]/5 p-2.5">
                <span className="text-sm font-medium text-[#1e3a5f] px-1">{selectedVisible.length} selected</span>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90" disabled={!isAdmin || bulkGenerate.isPending} onClick={bulkOptimize}>
                    {bulkGenerate.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />} Optimize Selected
                  </Button>
                  <Button size="sm" variant="outline" disabled={!isAdmin || regenerateUnlocked.isPending} onClick={bulkRegenerateUnlocked}>
                    {regenerateUnlocked.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />} Regenerate Drafts
                  </Button>
                  <Button size="sm" variant="outline" disabled={!isAdmin || bulkGenerate.isPending} onClick={bulkReindex}>
                    <RotateCw className="h-4 w-4 mr-1.5" /> Request Reindex
                  </Button>
                  <Button size="sm" variant="outline" disabled={!isAdmin || setStatus.isPending} onClick={bulkComplete}>
                    <CheckCircle2 className="h-4 w-4 mr-1.5" /> Mark Complete
                  </Button>
                  {aiProviderStatus.data?.isMock ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>
                          <Button size="sm" variant="outline" disabled>
                            <GitPullRequest className="h-4 w-4 mr-1.5" /> Approve to PR
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Drafts are placeholder mock content ({aiProviderStatus.data.model}) — configure a real AI provider before publishing</TooltipContent>
                    </Tooltip>
                  ) : !githubConfigured.data?.configured ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>
                          <Button size="sm" variant="outline" disabled>
                            <GitPullRequest className="h-4 w-4 mr-1.5" /> Approve to PR
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>GitHub not configured — set SEO_GITHUB_TOKEN</TooltipContent>
                    </Tooltip>
                  ) : selectedVisible.length > MAX_BULK_APPROVE_BATCH ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>
                          <Button size="sm" variant="outline" disabled>
                            <GitPullRequest className="h-4 w-4 mr-1.5" /> Approve to PR
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Batch cap is {MAX_BULK_APPROVE_BATCH} pages — narrow your selection</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button size="sm" variant="outline" disabled={!isAdmin} onClick={() => setApproveModalOpen(true)}>
                      <GitPullRequest className="h-4 w-4 mr-1.5" /> Approve to PR
                    </Button>
                  )}
                </div>
                {!isAdmin && <span className="text-xs text-amber-700">Admin only</span>}
                <button onClick={clearSelection} className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" /> Clear
                </button>
              </div>
            )}

            {/* Bulk run progress + per-page failures */}
            {bulkGenerate.isPending && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border bg-slate-50 p-2.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating drafts with bounded concurrency — this runs a few pages at a time.
              </div>
            )}
            {bulkResult && (
              <div className={`mb-3 rounded-lg border p-2.5 text-sm ${bulkResult.failed > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={bulkResult.failed > 0 ? "text-amber-800" : "text-emerald-800"}>
                    Bulk run complete · {bulkResult.succeeded} drafted{bulkResult.failed > 0 ? `, ${bulkResult.failed} failed` : ""}
                  </span>
                  <button onClick={() => setBulkResult(null)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" /> Dismiss
                  </button>
                </div>
                {bulkResult.failures.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-xs text-amber-800">
                    {bulkResult.failures.map((f) => (
                      <li key={f.pageId}>Page #{f.pageId}: {f.error}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {opportunities.isLoading ? (
              <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading opportunities…
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-semibold mb-1">No matching pages</p>
                <p className="text-sm">{rows.length === 0 ? "No outstanding SEO issues detected." : "Try clearing a filter to see more."}</p>
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b">
                      <th className="p-3 w-10">
                        <Checkbox
                          checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                        />
                      </th>
                      <th className="text-left p-3 font-medium">Priority</th>
                      <th className="text-left p-3 font-medium">Page</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Issue</th>
                      <th className="text-right p-3 font-medium">Clicks</th>
                      <th className="text-right p-3 font-medium">Impr.</th>
                      <th className="text-right p-3 font-medium">CTR</th>
                      <th className="text-right p-3 font-medium">Pos.</th>
                      <th className="text-right p-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const checked = selectedIds.has(r.id);
                      const lock = lockedByPath[r.page];
                      const locked = !!lock?.locked;
                      return (
                        <tr
                          key={r.id}
                          onClick={() => setDrawerId(r.id)}
                          className={`border-b last:border-0 cursor-pointer align-top transition-colors ${locked ? "bg-slate-50/80 opacity-70" : checked ? "bg-[#ff6b35]/5" : "hover:bg-slate-50"}`}
                        >
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            {locked ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span tabIndex={0} className="inline-flex">
                                    <Checkbox checked={false} disabled aria-label={`${r.page} is locked for manual review`} />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">{lock.message}</TooltipContent>
                              </Tooltip>
                            ) : (
                              <Checkbox checked={checked} onCheckedChange={() => toggleSelect(r.id)} aria-label={`Select ${r.page}`} />
                            )}
                          </td>
                          <td className="p-3"><PriorityBadge priority={r.priority} /></td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1.5 font-medium text-[#1e3a5f] whitespace-nowrap">
                              {locked && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">{lock.message}</TooltipContent>
                                </Tooltip>
                              )}
                              {r.page}
                            </span>
                          </td>
                          <td className="p-3"><StatusBadge status={r.status} /></td>
                          <td className="p-3 text-muted-foreground max-w-xs">{r.issue}</td>
                          <td className="p-3 text-right tabular-nums">{fmtInt(r.clicks)}</td>
                          <td className="p-3 text-right tabular-nums">{fmtInt(r.impressions)}</td>
                          <td className="p-3 text-right tabular-nums">{fmtPct(r.ctr, 2)}</td>
                          <td className="p-3 text-right tabular-nums">{fmtPos(r.position)}</td>
                          <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[#ff6b35] hover:text-[#ff6b35] hover:bg-[#ff6b35]/10 whitespace-nowrap"
                              onClick={() => setDrawerId(r.id)}
                            >
                              <Sparkles className="h-3.5 w-3.5 mr-1" /> Optimize
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <OpportunityDrawer
        opportunity={drawerOpportunity}
        open={drawerId !== null}
        onClose={() => setDrawerId(null)}
        isAdmin={isAdmin}
      />

      <BulkApproveModal
        open={approveModalOpen}
        onClose={() => setApproveModalOpen(false)}
        pageIds={toIds(selectedVisible)}
        onApproved={clearSelection}
        onRemovePage={(pageId) => setSelectedIds((prev) => { const next = new Set(prev); next.delete(String(pageId)); return next; })}
      />

      <AuditLogSheet open={auditOpen} onClose={() => setAuditOpen(false)} />

      <DashboardFooter />
    </div>
  );
}

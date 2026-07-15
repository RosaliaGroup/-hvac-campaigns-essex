import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
    onSuccess: () => { afterWrite(); toast.success("Draft approved for review"); },
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
        <span>Drafts only — nothing here is published to your live site. Generate, edit, then approve for human review.</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#1e3a5f]">AI Draft</span>
          {draft && (
            <Badge variant="outline" className={`text-xs ${DRAFT_STATUS_STYLE[draft.status]}`}>
              {draft.status === "edited" ? "Edited" : draft.status === "approved" ? "Approved" : "Draft"}
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
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
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

              {/* AI draft workspace */}
              <DraftWorkspace opportunity={o} isAdmin={isAdmin} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
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

  const [activeFilters, setActiveFilters] = useState<SeoFilterKey[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerId, setDrawerId] = useState<string | null>(null);
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

  // Selection is scoped to the currently-visible (filtered) rows.
  const filteredIds = filtered.map((r) => r.id);
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
    bulkGenerate.mutate({ ids: toIds(selectedVisible), action: "optimize_everything" });
    clearSelection();
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
            </div>
          </CardHeader>

          <CardContent>
            {/* Bulk action bar */}
            {selectedVisible.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#ff6b35]/30 bg-[#ff6b35]/5 p-2.5">
                <span className="text-sm font-medium text-[#1e3a5f] px-1">{selectedVisible.length} selected</span>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90" disabled={!isAdmin || bulkGenerate.isPending} onClick={bulkOptimize}>
                    {bulkGenerate.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />} Optimize Selected
                  </Button>
                  <Button size="sm" variant="outline" disabled={!isAdmin || bulkGenerate.isPending} onClick={bulkReindex}>
                    <RotateCw className="h-4 w-4 mr-1.5" /> Request Reindex
                  </Button>
                  <Button size="sm" variant="outline" disabled={!isAdmin || setStatus.isPending} onClick={bulkComplete}>
                    <CheckCircle2 className="h-4 w-4 mr-1.5" /> Mark Complete
                  </Button>
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
                      <th className="text-left p-3 font-medium">Score</th>
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
                      return (
                        <tr
                          key={r.id}
                          onClick={() => setDrawerId(r.id)}
                          className={`border-b last:border-0 cursor-pointer align-top transition-colors ${checked ? "bg-[#ff6b35]/5" : "hover:bg-slate-50"}`}
                        >
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={checked} onCheckedChange={() => toggleSelect(r.id)} aria-label={`Select ${r.page}`} />
                          </td>
                          <td className="p-3"><PriorityBadge priority={r.priority} /></td>
                          <td className="p-3"><span className="font-medium text-[#1e3a5f] whitespace-nowrap">{r.page}</span></td>
                          <td className="p-3"><StatusBadge status={r.status} /></td>
                          <td className="p-3"><ScoreMeter score={r.seoScore} /></td>
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

      <DashboardFooter />
    </div>
  );
}

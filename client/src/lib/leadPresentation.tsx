/**
 * Shared lead presentation (Task 8B). Extracted from LeadDashboard so the Lead
 * Inbox list and the full-page Lead detail render leads identically — same source
 * badges, stage styles, relationship colors, pipeline stepper and helpers. Keeping
 * one copy is the "don't fork styling" guarantee.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Globe, Mail, ClipboardCheck, Wrench, BarChart3, AlertCircle, Facebook,
  Star, CheckCircle, Handshake, ChevronRight, Trophy,
} from "lucide-react";
import {
  PIPELINE_ORDER, normalizeStage, stageLabel, stageIndex, isWon, isLost,
  deriveContactRelationship, type Relationship,
} from "@shared/leadPipeline";

export type LeadCapture = {
  id: number;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  captureType: string;
  pageUrl?: string | null;
  message?: string | null;
  status: string;
  notes?: string | null;
  assignedTo?: string | null;
  customerId?: number | null;
  /** Server-derived Lead/Prospect/Customer (unified with the Contacts page). */
  relationship?: Relationship;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export const SOURCE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  exit_popup: { label: "Exit Popup", icon: <Globe className="h-3 w-3" />, color: "bg-purple-100 text-purple-700" },
  inline_form: { label: "Inline Form", icon: <Globe className="h-3 w-3" />, color: "bg-blue-100 text-blue-700" },
  newsletter: { label: "Newsletter", icon: <Mail className="h-3 w-3" />, color: "bg-green-100 text-green-700" },
  download_gate: { label: "Download", icon: <Globe className="h-3 w-3" />, color: "bg-yellow-100 text-yellow-700" },
  quick_quote: { label: "Quick Quote", icon: <Globe className="h-3 w-3" />, color: "bg-orange-100 text-orange-700" },
  qualify_form: { label: "Qualify Form", icon: <ClipboardCheck className="h-3 w-3" />, color: "bg-teal-100 text-teal-700" },
  exit_popup_residential: { label: "Residential Popup", icon: <Globe className="h-3 w-3" />, color: "bg-purple-100 text-purple-700" },
  exit_popup_commercial: { label: "Commercial Popup", icon: <Globe className="h-3 w-3" />, color: "bg-indigo-100 text-indigo-700" },
  scroll_popup_residential: { label: "Residential Scroll", icon: <Globe className="h-3 w-3" />, color: "bg-pink-100 text-pink-700" },
  scroll_popup_commercial: { label: "Commercial Scroll", icon: <Globe className="h-3 w-3" />, color: "bg-rose-100 text-rose-700" },
  lp_heat_pump: { label: "Heat Pump LP", icon: <Wrench className="h-3 w-3" />, color: "bg-amber-100 text-amber-700" },
  lp_commercial_vrv: { label: "Commercial VRV LP", icon: <BarChart3 className="h-3 w-3" />, color: "bg-cyan-100 text-cyan-700" },
  lp_emergency: { label: "Emergency LP", icon: <AlertCircle className="h-3 w-3" />, color: "bg-red-100 text-red-700" },
  lp_fb_residential: { label: "FB Residential LP", icon: <Facebook className="h-3 w-3" />, color: "bg-blue-100 text-blue-700" },
  lp_fb_commercial: { label: "FB Commercial LP", icon: <Facebook className="h-3 w-3" />, color: "bg-blue-100 text-blue-700" },
  lp_rebate_guide: { label: "Rebate Guide LP", icon: <Star className="h-3 w-3" />, color: "bg-green-100 text-green-700" },
  lp_maintenance: { label: "Maintenance LP", icon: <CheckCircle className="h-3 w-3" />, color: "bg-teal-100 text-teal-700" },
  career_application: { label: "Career Application", icon: <ClipboardCheck className="h-3 w-3" />, color: "bg-emerald-100 text-emerald-700" },
  partnership_inquiry: { label: "Partnership Inquiry", icon: <Handshake className="h-3 w-3" />, color: "bg-violet-100 text-violet-700" },
  meta_lead_ad: { label: "Meta Lead Ad", icon: <Facebook className="h-3 w-3" />, color: "bg-blue-100 text-blue-700" },
};

export function sourceInfoFor(captureType: string) {
  return SOURCE_LABELS[captureType] || { label: captureType, icon: <Globe className="h-3 w-3" />, color: "bg-gray-100 text-gray-700" };
}

// Stage → badge styles (keyed by the NORMALIZED stage value).
export const STAGE_STYLES: Record<string, { color: string; bg: string }> = {
  new: { color: "text-blue-700", bg: "bg-blue-100" },
  contacted: { color: "text-amber-700", bg: "bg-amber-100" },
  assessment_scheduled: { color: "text-indigo-700", bg: "bg-indigo-100" },
  assessment_completed: { color: "text-cyan-700", bg: "bg-cyan-100" },
  proposal_sent: { color: "text-purple-700", bg: "bg-purple-100" },
  follow_up: { color: "text-orange-700", bg: "bg-orange-100" },
  won: { color: "text-green-700", bg: "bg-green-100" },
  lost: { color: "text-red-700", bg: "bg-red-100" },
};
export function stageStyle(status?: string | null) {
  return STAGE_STYLES[normalizeStage(status)] ?? STAGE_STYLES.new;
}

export const RELATIONSHIP_STYLE: Record<Relationship, string> = {
  lead: "bg-slate-100 text-slate-700",
  prospect: "bg-amber-100 text-amber-800",
  customer: "bg-green-100 text-green-800",
};

export const APPOINTMENT_STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  arrived: "bg-indigo-100 text-indigo-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  rescheduled: "bg-purple-100 text-purple-700",
};

export function formatLeadDate(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}
export function formatLeadDateShort(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

export function getLeadName(lead: { firstName?: string | null; lastName?: string | null; name?: string | null; email?: string | null; phone?: string | null }) {
  if (lead.firstName || lead.lastName) return [lead.firstName, lead.lastName].filter(Boolean).join(" ");
  if (lead.name) return lead.name;
  if (lead.email) return lead.email.split("@")[0];
  if (lead.phone) return lead.phone;
  return "Anonymous";
}

export function leadRelationship(lead: LeadCapture): Relationship {
  // Use the SERVER-derived relationship (same signals the Contacts page uses),
  // falling back to stage-only if an older cached row lacks it.
  return lead.relationship ?? deriveContactRelationship({ leadStages: [lead.status] });
}

/** Horizontal, clickable pipeline stepper + Won/Lost outcomes. */
export function PipelineStage({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  const current = stageIndex(status); // -1 when won/lost
  const won = isWon(status);
  const lost = isLost(status);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {PIPELINE_ORDER.map((stage, i) => {
          const done = current >= 0 && i < current;
          const active = current === i;
          return (
            <div key={stage} className="flex items-center">
              <button
                type="button"
                onClick={() => onChange(stage)}
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  active ? "bg-[#1e3a5f] text-white"
                  : done ? "bg-[#1e3a5f]/15 text-[#1e3a5f]"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {stageLabel(stage)}
              </button>
              {i < PIPELINE_ORDER.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button" size="sm"
          variant={won ? "default" : "outline"}
          className={won ? "bg-green-600 hover:bg-green-700 text-white" : "border-green-600 text-green-700"}
          onClick={() => onChange("won")}
        >
          <Trophy className="h-3.5 w-3.5 mr-1" /> Won
        </Button>
        <Button
          type="button" size="sm"
          variant={lost ? "default" : "outline"}
          className={lost ? "bg-red-600 hover:bg-red-700 text-white" : "border-red-500 text-red-600"}
          onClick={() => onChange("lost")}
        >
          Lost
        </Button>
      </div>
    </div>
  );
}

export function ActivityRow({ icon, label, when, detail }: { icon: React.ReactNode; label: string; when: string; detail?: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-xs text-muted-foreground truncate">{detail}</p>}
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{when}</span>
    </div>
  );
}

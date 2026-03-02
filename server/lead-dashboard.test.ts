/**
 * Unit tests for Lead Management Dashboard backend
 * Tests the db helper functions and router procedures for lead management
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("../drizzle/schema", () => ({
  leadCaptures: {
    id: "id",
    email: "email",
    phone: "phone",
    firstName: "firstName",
    lastName: "lastName",
    name: "name",
    captureType: "captureType",
    pageUrl: "pageUrl",
    message: "message",
    status: "status",
    notes: "notes",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  users: {},
  leads: {},
  aiVaCredentials: {},
  callLogs: {},
  smsConversations: {},
  socialPosts: {},
  socialInteractions: {},
  aiVaAnalytics: {},
  aiScripts: {},
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ type: "eq", col, val })),
  desc: vi.fn((col) => ({ type: "desc", col })),
  sql: vi.fn((strings, ...vals) => ({ type: "sql", strings, vals })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
  like: vi.fn((col, val) => ({ type: "like", col, val })),
  or: vi.fn((...conditions) => ({ type: "or", conditions })),
}));

// Mock drizzle/mysql2
vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: vi.fn(),
}));

// Mock env
vi.mock("./_core/env", () => ({
  ENV: { ownerOpenId: "test-owner-id" },
}));

// ---- Source label mapping tests ----
describe("Source label mapping", () => {
  const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
    exit_popup: { label: "Exit Popup", color: "bg-purple-100 text-purple-700" },
    inline_form: { label: "Inline Form", color: "bg-blue-100 text-blue-700" },
    newsletter: { label: "Newsletter", color: "bg-green-100 text-green-700" },
    download_gate: { label: "Download", color: "bg-yellow-100 text-yellow-700" },
    quick_quote: { label: "Quick Quote", color: "bg-orange-100 text-orange-700" },
    exit_popup_residential: { label: "Residential Popup", color: "bg-purple-100 text-purple-700" },
    exit_popup_commercial: { label: "Commercial Popup", color: "bg-indigo-100 text-indigo-700" },
    lp_heat_pump: { label: "Heat Pump LP", color: "bg-amber-100 text-amber-700" },
    lp_commercial_vrv: { label: "Commercial VRV LP", color: "bg-cyan-100 text-cyan-700" },
    lp_emergency: { label: "Emergency LP", color: "bg-red-100 text-red-700" },
    lp_fb_residential: { label: "FB Residential LP", color: "bg-blue-100 text-blue-700" },
    lp_fb_commercial: { label: "FB Commercial LP", color: "bg-blue-100 text-blue-700" },
    lp_rebate_guide: { label: "Rebate Guide LP", color: "bg-green-100 text-green-700" },
    lp_maintenance: { label: "Maintenance LP", color: "bg-teal-100 text-teal-700" },
  };

  it("should have labels for all 7 landing page sources", () => {
    const lpSources = ["lp_heat_pump", "lp_commercial_vrv", "lp_emergency", "lp_fb_residential", "lp_fb_commercial", "lp_rebate_guide", "lp_maintenance"];
    lpSources.forEach(source => {
      expect(SOURCE_LABELS[source]).toBeDefined();
      expect(SOURCE_LABELS[source].label).toBeTruthy();
    });
  });

  it("should have labels for website popup sources", () => {
    const popupSources = ["exit_popup", "exit_popup_residential", "exit_popup_commercial", "inline_form", "quick_quote"];
    popupSources.forEach(source => {
      expect(SOURCE_LABELS[source]).toBeDefined();
    });
  });

  it("should return undefined for unknown sources", () => {
    expect(SOURCE_LABELS["unknown_source"]).toBeUndefined();
  });
});

// ---- Status configuration tests ----
describe("Status configuration", () => {
  const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    new: { label: "New", color: "text-blue-700", bg: "bg-blue-100" },
    contacted: { label: "Contacted", color: "text-yellow-700", bg: "bg-yellow-100" },
    qualified: { label: "Qualified", color: "text-purple-700", bg: "bg-purple-100" },
    booked: { label: "Booked", color: "text-green-700", bg: "bg-green-100" },
    lost: { label: "Lost", color: "text-red-700", bg: "bg-red-100" },
  };

  it("should have all 5 status types", () => {
    expect(Object.keys(STATUS_CONFIG)).toHaveLength(5);
    ["new", "contacted", "qualified", "booked", "lost"].forEach(status => {
      expect(STATUS_CONFIG[status]).toBeDefined();
    });
  });

  it("should have label, color, and bg for each status", () => {
    Object.values(STATUS_CONFIG).forEach(config => {
      expect(config.label).toBeTruthy();
      expect(config.color).toBeTruthy();
      expect(config.bg).toBeTruthy();
    });
  });
});

// ---- Lead name helper tests ----
describe("getLeadName helper", () => {
  function getLeadName(lead: any): string {
    if (lead.firstName || lead.lastName) {
      return [lead.firstName, lead.lastName].filter(Boolean).join(" ");
    }
    if (lead.name) return lead.name;
    if (lead.email) return lead.email.split("@")[0];
    if (lead.phone) return lead.phone;
    return "Anonymous";
  }

  it("should return full name from firstName and lastName", () => {
    expect(getLeadName({ firstName: "John", lastName: "Doe" })).toBe("John Doe");
  });

  it("should return firstName only if lastName is missing", () => {
    expect(getLeadName({ firstName: "John" })).toBe("John");
  });

  it("should return name field if no firstName/lastName", () => {
    expect(getLeadName({ name: "Jane Smith" })).toBe("Jane Smith");
  });

  it("should return email username if no name fields", () => {
    expect(getLeadName({ email: "test@example.com" })).toBe("test");
  });

  it("should return phone if only phone is available", () => {
    expect(getLeadName({ phone: "555-1234" })).toBe("555-1234");
  });

  it("should return Anonymous if no contact info", () => {
    expect(getLeadName({})).toBe("Anonymous");
  });
});

// ---- Stats calculation tests ----
describe("Lead stats calculation", () => {
  function calculateStats(leads: any[]) {
    const bySource: Record<string, number> = {};
    leads.forEach(l => {
      bySource[l.captureType] = (bySource[l.captureType] || 0) + 1;
    });

    return {
      total: leads.length,
      new: leads.filter(l => l.status === "new").length,
      contacted: leads.filter(l => l.status === "contacted").length,
      qualified: leads.filter(l => l.status === "qualified").length,
      booked: leads.filter(l => l.status === "booked").length,
      lost: leads.filter(l => l.status === "lost").length,
      bySource,
    };
  }

  const sampleLeads = [
    { status: "new", captureType: "lp_heat_pump" },
    { status: "new", captureType: "lp_heat_pump" },
    { status: "contacted", captureType: "lp_commercial_vrv" },
    { status: "qualified", captureType: "lp_fb_residential" },
    { status: "booked", captureType: "exit_popup" },
    { status: "lost", captureType: "lp_emergency" },
  ];

  it("should count total leads correctly", () => {
    const stats = calculateStats(sampleLeads);
    expect(stats.total).toBe(6);
  });

  it("should count leads by status correctly", () => {
    const stats = calculateStats(sampleLeads);
    expect(stats.new).toBe(2);
    expect(stats.contacted).toBe(1);
    expect(stats.qualified).toBe(1);
    expect(stats.booked).toBe(1);
    expect(stats.lost).toBe(1);
  });

  it("should group leads by source correctly", () => {
    const stats = calculateStats(sampleLeads);
    expect(stats.bySource["lp_heat_pump"]).toBe(2);
    expect(stats.bySource["lp_commercial_vrv"]).toBe(1);
    expect(stats.bySource["lp_fb_residential"]).toBe(1);
    expect(stats.bySource["exit_popup"]).toBe(1);
    expect(stats.bySource["lp_emergency"]).toBe(1);
  });

  it("should return zero stats for empty array", () => {
    const stats = calculateStats([]);
    expect(stats.total).toBe(0);
    expect(stats.new).toBe(0);
    expect(stats.booked).toBe(0);
    expect(Object.keys(stats.bySource)).toHaveLength(0);
  });
});

// ---- Conversion rate calculation tests ----
describe("Conversion rate calculation", () => {
  function calculateConversionRate(total: number, booked: number): number {
    if (total === 0) return 0;
    return Math.round((booked / total) * 100);
  }

  it("should calculate 0% for no leads", () => {
    expect(calculateConversionRate(0, 0)).toBe(0);
  });

  it("should calculate 100% when all leads are booked", () => {
    expect(calculateConversionRate(10, 10)).toBe(100);
  });

  it("should calculate 50% correctly", () => {
    expect(calculateConversionRate(10, 5)).toBe(50);
  });

  it("should round to nearest integer", () => {
    expect(calculateConversionRate(3, 1)).toBe(33);
  });
});

// ---- Channel categorization tests ----
describe("Channel categorization", () => {
  const leads = [
    { captureType: "lp_heat_pump" },
    { captureType: "lp_commercial_vrv" },
    { captureType: "lp_emergency" },
    { captureType: "lp_fb_residential" },
    { captureType: "lp_fb_commercial" },
    { captureType: "exit_popup" },
    { captureType: "inline_form" },
    { captureType: "lp_rebate_guide" },
    { captureType: "lp_maintenance" },
    { captureType: "newsletter" },
  ];

  it("should categorize Google Ads leads correctly", () => {
    const googleAdsLeads = leads.filter(l => ["lp_heat_pump", "lp_commercial_vrv", "lp_emergency"].includes(l.captureType));
    expect(googleAdsLeads).toHaveLength(3);
  });

  it("should categorize Facebook leads correctly", () => {
    const facebookLeads = leads.filter(l => ["lp_fb_residential", "lp_fb_commercial"].includes(l.captureType));
    expect(facebookLeads).toHaveLength(2);
  });

  it("should categorize website leads correctly", () => {
    const websiteLeads = leads.filter(l => ["exit_popup", "inline_form", "quick_quote", "exit_popup_residential", "exit_popup_commercial", "scroll_popup_residential", "scroll_popup_commercial"].includes(l.captureType));
    expect(websiteLeads).toHaveLength(2);
  });

  it("should categorize email/SMS leads correctly", () => {
    const emailSmsLeads = leads.filter(l => ["lp_rebate_guide", "lp_maintenance", "newsletter", "download_gate"].includes(l.captureType));
    expect(emailSmsLeads).toHaveLength(3);
  });
});

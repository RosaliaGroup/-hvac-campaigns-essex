import { useState, useEffect, useCallback } from "react";

const PASSWORD = "mechanicalenterprise2026";
const TOTAL_SLIDES = 13;

/* ================================================================
   PASSWORD GATE
   ================================================================ */
function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    if (pw === PASSWORD) {
      sessionStorage.setItem("pres-auth", "1");
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", maxWidth: 400, width: "90%", textAlign: "center", boxShadow: "0 25px 50px rgba(0,0,0,.25)" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>&#9881;&#65039;</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1e3a5f", marginBottom: 4 }}>Mechanical Enterprise</h2>
        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>Partner Presentation 2026</p>
        <input
          type="password"
          placeholder="Enter password"
          value={pw}
          onChange={e => { setPw(e.target.value); setError(false); }}
          onKeyDown={e => e.key === "Enter" && submit()}
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 8,
            border: error ? "2px solid #ef4444" : "2px solid #e2e8f0",
            fontSize: 16, outline: "none", marginBottom: 16, boxSizing: "border-box",
            transition: "border-color .2s"
          }}
        />
        {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>Incorrect password</p>}
        <button
          onClick={submit}
          style={{
            width: "100%", padding: "12px", borderRadius: 8,
            background: "#ff6b35", color: "#fff", fontWeight: 700,
            fontSize: 16, border: "none", cursor: "pointer"
          }}
        >
          View Presentation
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   SLIDE WRAPPER
   ================================================================ */
function Slide({ children, bg }: { children: React.ReactNode; bg?: string }) {
  return (
    <div style={{
      minHeight: "100vh", width: "100%",
      background: bg || "#fff",
      display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "60px 40px", boxSizing: "border-box",
      overflowY: "auto",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        {children}
      </div>
    </div>
  );
}

/* helper: section heading */
function SH({ children, sub, light }: { children: React.ReactNode; sub?: string; light?: boolean }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 40 }}>
      <h1 style={{ fontSize: 36, fontWeight: 800, color: light ? "#fff" : "#1e3a5f", margin: 0, lineHeight: 1.2 }}>{children}</h1>
      {sub && <p style={{ fontSize: 18, color: light ? "rgba(255,255,255,.8)" : "#64748b", marginTop: 8 }}>{sub}</p>}
    </div>
  );
}

/* helper: card */
function InfoCard({ emoji, title, items, color }: { emoji: string; title: string; items: string[]; color: string }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: "24px 20px",
      border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,.06)",
      borderTop: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{emoji}</div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e3a5f", marginBottom: 12 }}>{title}</h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: 13, color: "#475569", marginBottom: 6, paddingLeft: 16, position: "relative" }}>
            <span style={{ position: "absolute", left: 0, color }}>&#8226;</span>{item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* helper: table */
function SimpleTable({ headers, rows, compact }: { headers: string[]; rows: string[][]; compact?: boolean }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: compact ? 13 : 14 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{
                textAlign: i === 0 ? "left" : "center", padding: compact ? "8px 10px" : "10px 14px",
                background: "#1e3a5f", color: "#fff", fontWeight: 600, fontSize: compact ? 12 : 13,
                borderBottom: "2px solid #ff6b35",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "#f8fafc" : "#fff" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  textAlign: ci === 0 ? "left" : "center", padding: compact ? "8px 10px" : "10px 14px",
                  borderBottom: "1px solid #e2e8f0", color: "#334155", fontWeight: ci === 0 ? 600 : 400,
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* helper: stat box */
function StatBox({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "20px 16px" }}>
      <div style={{ fontSize: 42, fontWeight: 800, color: color || "#ff6b35", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 14, color: "#64748b", marginTop: 8 }}>{label}</div>
    </div>
  );
}

/* helper: step */
function Step({ num, text }: { num: number; text: string }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
      <div style={{
        minWidth: 32, height: 32, borderRadius: "50%", background: "#ff6b35",
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 14, flexShrink: 0,
      }}>{num}</div>
      <p style={{ fontSize: 14, color: "#334155", margin: 0, paddingTop: 5 }}>{text}</p>
    </div>
  );
}

/* ================================================================
   SLIDE 1 — TITLE
   ================================================================ */
function Slide1() {
  return (
    <Slide bg="linear-gradient(135deg, #1e3a5f 0%, #2a5a8f 100%)">
      <div style={{ textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>&#9881;&#65039;</div>
        <h1 style={{ fontSize: 48, fontWeight: 800, marginBottom: 8, lineHeight: 1.1 }}>Mechanical Enterprise LLC</h1>
        <div style={{
          display: "inline-block", background: "#ff6b35", borderRadius: 8,
          padding: "8px 24px", fontSize: 18, fontWeight: 700, marginBottom: 32,
        }}>Partner Presentation 2026</div>
        <p style={{ fontSize: 22, color: "rgba(255,255,255,.85)", maxWidth: 700, margin: "0 auto 40px" }}>
          NJ's First AI-Powered, Rebate-Specialized HVAC Company
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
          {[
            ["116", "SEO Pages Live"],
            ["24/7", "AI Assistant"],
            ["$16K+", "Max Rebates"],
            ["8", "Landing Pages"],
          ].map(([v, l]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#ff6b35" }}>{v}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.7)" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </Slide>
  );
}

/* ================================================================
   SLIDE 2 — WHAT WE BUILT
   ================================================================ */
function Slide2() {
  return (
    <Slide>
      <SH sub="mechanicalenterprise.com">Complete Digital Platform — Built & Live</SH>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        <InfoCard emoji="&#127760;" title="Public Website" color="#1e3a5f" items={[
          "Home, About, Services, Contact",
          "Residential (Heat Pump Rebates)",
          "Commercial (VRV/VRF Systems)",
          "Maintenance Subscription Plans",
          "Testimonials",
          "Rebate Guide",
          "Qualify / Rebate Calculator",
        ]} />
        <InfoCard emoji="&#128218;" title="Courses Platform" color="#7c3aed" items={[
          "Full LMS (Learning Management System)",
          "6 categories: Certification, Rebate Sales, Specialty Systems, Business, Installation, Maintenance",
          "Levels: Technician, Contractor, Advanced, Business, Beginner, Homeowner",
          "My Courses dashboard",
          "Certificate generation",
          "Protected lessons",
        ]} />
        <InfoCard emoji="&#129309;" title="Partnerships & Careers" color="#059669" items={[
          "Partnership application system ($200-$500 referral / Property Manager / Contractor programs)",
          "Careers page with job applications",
          "Team login + access management",
        ]} />
        <InfoCard emoji="&#128640;" title="Marketing Command Center" color="#ff6b35" items={[
          "Google Ads campaign manager",
          "Facebook/Instagram campaigns",
          "Email + SMS campaign manager",
          "Campaign generator (AI-powered)",
          "Marketing Autopilot (20 leads/week goal)",
          "Campaign performance tracking",
          "Budget calculator",
        ]} />
        <InfoCard emoji="&#129302;" title="AI Virtual Assistant" color="#7c3aed" items={[
          "Jessica AI (Vapi-powered)",
          "Live chat widget on every page",
          "Inbound call handling 24/7",
          "AI VA Dashboard + Settings",
          "AI Assistant Prompts library",
          "AI Script Manager",
          "Lead capture \u2192 email notification",
        ]} />
        <InfoCard emoji="&#128202;" title="Lead Management" color="#1e3a5f" items={[
          "Lead Dashboard",
          "Lead Tracker",
          "Lead Scoring System",
          "Assessment Submissions",
          "Campaign Performance",
          "ServiceTitan CRM integration",
        ]} />
      </div>
    </Slide>
  );
}

/* ================================================================
   SLIDE 3 — LANDING PAGES & SEO
   ================================================================ */
function Slide3() {
  const lps = [
    ["\ud83d\udd25", "/lp/heat-pump-rebates", "Heat Pump Rebates"],
    ["\ud83c\udfe2", "/lp/commercial-vrv", "Commercial VRV/VRF"],
    ["\ud83d\udea8", "/lp/emergency-hvac", "Emergency HVAC"],
    ["\ud83d\udcd8", "/lp/fb-residential", "Facebook Residential"],
    ["\ud83d\udcd8", "/lp/fb-commercial", "Facebook Commercial"],
    ["\ud83d\udcd6", "/lp/rebate-guide", "Rebate Guide"],
    ["\ud83d\udd27", "/lp/maintenance-offer", "Maintenance Offer"],
    ["\ud83e\udd1d", "/lp/referral-partner", "Referral Partner"],
  ];
  const seo = [
    ["\ud83d\udccd", "49 city pages \u2014 20mi radius of Newark"],
    ["\ud83d\udccd", "23 North NJ cities (Morris, Passaic, Sussex)"],
    ["\ud83c\udfc6", "18 luxury area pages (Alpine, Saddle River, Bernardsville, Short Hills, Ridgewood, etc.)"],
    ["\u2699\ufe0f", "8 service pages (Heat Pump, Mini-Split, VRF, Full Replacement, Commercial, Financing)"],
    ["\u2694\ufe0f", "4 competitor conquest pages (AJ Perri, Gold Medal, Horizon, Hutchinson)"],
    ["\ud83d\udcdd", "Blog \u2014 launched March 31, 2026"],
  ];

  return (
    <Slide>
      <SH sub="">116 SEO Pages + 8 Targeted Landing Pages</SH>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e3a5f", marginBottom: 16 }}>Landing Pages (8)</h3>
          {lps.map(([emoji, path, label]) => (
            <div key={path} style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 14 }}>
              <span>{emoji}</span>
              <span><code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>{path}</code> &mdash; {label}</span>
            </div>
          ))}
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e3a5f", marginBottom: 16 }}>SEO City/Service Pages (116)</h3>
          {seo.map(([emoji, text], i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 14 }}>
              <span>{emoji}</span>
              <span style={{ color: "#334155" }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 40,
        background: "#1e3a5f", borderRadius: 12, padding: "20px 16px",
      }}>
        {[
          ["116", "Total Indexed Pages"],
          ["67", "Cities & Towns Covered"],
          ["4", "Competitor Pages"],
          ["8", "Targeted Landing Pages"],
        ].map(([v, l]) => (
          <div key={l} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#ff6b35" }}>{v}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.8)" }}>{l}</div>
          </div>
        ))}
      </div>
    </Slide>
  );
}

/* ================================================================
   SLIDE 4 — PAYMENT & BOOKING
   ================================================================ */
function Slide4() {
  return (
    <Slide>
      <SH sub="">Automated Booking + Payment — Live Now</SH>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e3a5f", marginBottom: 16 }}>Booking Flow</h3>
          <Step num={1} text="Visitor lands on site" />
          <Step num={2} text="Jessica AI chat engages visitor" />
          <Step num={3} text="Visitor selects service type (Residential / Commercial, specific need)" />
          <Step num={4} text="Smart form collects info: name, phone, email, address, service type, emergency toggle. Commercial adds: company, property type, sq footage, floors, current system" />
          <Step num={5} text="Stripe payment secures appointment" />
          <Step num={6} text="Email sent to sales@mechanicalenterprise.com" />
          <Step num={7} text="Team follows up" />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e3a5f", marginBottom: 16 }}>Stripe Payment Products (Live)</h3>
          <SimpleTable
            headers={["Service", "Price"]}
            rows={[
              ["Residential Standard", "$100"],
              ["Residential Emergency", "$175"],
              ["Commercial Standard", "$200"],
              ["Commercial Emergency", "$275"],
            ]}
          />
          <div style={{
            marginTop: 20, background: "#f0fdf4", border: "1px solid #bbf7d0",
            borderRadius: 8, padding: "14px 16px", fontSize: 13, color: "#166534", fontWeight: 600,
          }}>
            Payment secures appointment slot &mdash; reduces no-shows
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* ================================================================
   SLIDE 5 — MARKET OPPORTUNITY
   ================================================================ */
function Slide5() {
  return (
    <Slide>
      <SH sub="">Why Heat Pump Installations — Why Now</SH>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
        <StatBox value="$3.57B" label="North American heat pump market 2026" />
        <StatBox value="9.85%" label="CAGR projected growth through 2034" />
        <StatBox value="13M" label="US homes that would save switching" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e3a5f", marginBottom: 12 }}>NJ Rebate Programs 2026</h3>
          <SimpleTable
            headers={["Program", "Amount"]}
            rows={[
              ["NJ Whole Home Program", "Up to $7,500"],
              ["PSE&G Utility Rebate", "Up to $900"],
              ["JCP&L Utility Rebate", "Up to $1,000"],
              ["ACE Utility Rebate", "Up to $1,300"],
              ["0% Financing Available", "Up to $25,000"],
            ]}
          />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e3a5f", marginBottom: 12 }}>Key Market Facts</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {[
              "Federal 25C tax credit expired Dec 2025 \u2014 urgency to act on state rebates NOW",
              "NJ Clean Energy Master Plan mandates electrification",
              "Heat pump homes gaining higher resale values",
              "Commercial rebates cover up to 80% of costs",
              "83% of homeowners who installed heat pumps report higher satisfaction with comfort",
            ].map((t, i) => (
              <li key={i} style={{ fontSize: 13, color: "#334155", marginBottom: 10, paddingLeft: 20, position: "relative" }}>
                <span style={{ position: "absolute", left: 0, color: "#ff6b35", fontWeight: 700 }}>&#10003;</span>{t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Slide>
  );
}

/* ================================================================
   SLIDE 6 — COMPETITIVE POSITION
   ================================================================ */
function Slide6() {
  const features = [
    ["Rebate Specialization", "\u2705 Core focus", "\u26a0\ufe0f Limited", "\u26a0\ufe0f Limited"],
    ["AI Chat 24/7", "\u2705 Live", "\u274c No", "\u274c No"],
    ["Online Payment", "\u2705 Stripe live", "\u274c No", "\u274c No"],
    ["SEO Landing Pages", "\u2705 116 pages", "\u26a0\ufe0f Generic", "\u26a0\ufe0f Generic"],
    ["Course Platform", "\u2705 Full LMS", "\u274c No", "\u274c No"],
    ["WMBE/SBE Certified", "\u2705 Certified", "\u274c No", "\u274c No"],
    ["Booking Automation", "\u2705 Full flow", "\u274c No", "\u274c No"],
    ["Lead Scoring System", "\u2705 Built", "\u274c No", "\u274c No"],
  ];

  return (
    <Slide>
      <SH sub="">Our Position vs The Competition</SH>
      <SimpleTable
        headers={["Feature", "Mechanical Enterprise", "AJ Perri", "Gold Medal"]}
        rows={features}
        compact
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 24 }}>
        {[
          ["AJ Perri", "$58.7M revenue, 300 techs \u2014 NO rebate focus"],
          ["Gold Medal", "BBB complaints, NO AI, NO online payment"],
          ["Horizon/Hutchinson", "Regional chains, generic approach"],
        ].map(([name, desc]) => (
          <div key={name} style={{ background: "#fef2f2", borderRadius: 8, padding: "12px 16px", border: "1px solid #fecaca" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#991b1b" }}>{name}</div>
            <div style={{ fontSize: 12, color: "#7f1d1d", marginTop: 4 }}>{desc}</div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 24, textAlign: "center", fontSize: 16, fontWeight: 700,
        color: "#1e3a5f", fontStyle: "italic", padding: "16px",
        background: "#f0f9ff", borderRadius: 8, border: "1px solid #bae6fd",
      }}>
        "We have enterprise-level digital infrastructure that competitors 10x our size don't have."
      </div>
    </Slide>
  );
}

/* ================================================================
   SLIDE 7 — REVENUE PROJECTIONS
   ================================================================ */
function Slide7() {
  return (
    <Slide>
      <SH sub="">Revenue Potential — Installation Focus</SH>
      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e3a5f", marginBottom: 12 }}>Average Job Values</h3>
        <SimpleTable compact headers={["Service", "Value"]} rows={[
          ["Residential Heat Pump", "$8,000"],
          ["Ductless Mini-Split", "$5,000"],
          ["Full System Replacement", "$12,000"],
          ["Commercial VRV/VRF (small)", "$35,000"],
          ["Commercial VRV/VRF (large)", "$150,000"],
        ]} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {[
          { title: "Conservative", color: "#059669", bg: "#f0fdf4", border: "#bbf7d0", leads: "20 leads/week, 20% close", installs: "4 installs/week \u00d7 $8,000 = $32,000/week", monthly: "$128,000", annual: "$1.5M+" },
          { title: "Moderate", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", leads: "30 leads/week, 25% close", installs: "7-8 installs/week \u00d7 $10,000 = $75,000/week", monthly: "$300,000", annual: "$3.6M+" },
          { title: "Aggressive", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", leads: "50 leads/week, 30% close", installs: "15 installs/week \u00d7 $12,000 = $180,000/week", monthly: "$720,000", annual: "$8.6M+" },
        ].map(s => (
          <div key={s.title} style={{ background: s.bg, border: `2px solid ${s.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: s.color, marginBottom: 12 }}>{s.title}</div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>{s.leads}</div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 12 }}>{s.installs}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Monthly: {s.monthly}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, marginTop: 4 }}>Annual: {s.annual}</div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 20, textAlign: "center", fontSize: 14, fontWeight: 700,
        color: "#ff6b35", padding: "12px", background: "#fff7ed", borderRadius: 8, border: "1px solid #fed7aa",
      }}>
        "1 commercial VRV/VRF job = 10+ residential installs"
      </div>
    </Slide>
  );
}

/* ================================================================
   SLIDE 8 — SEO PROJECTIONS
   ================================================================ */
function Slide8() {
  return (
    <Slide>
      <SH sub="">SEO Timeline — 116 Pages Working for Us</SH>
      <SimpleTable
        headers={["Timeframe", "Pages Ranked", "Monthly Visitors", "Weekly Leads"]}
        rows={[
          ["Month 1", "10-20 pages", "200-500", "5-8"],
          ["Month 2", "30-50 pages", "1,000-2,000", "10-15"],
          ["Month 3", "60-80 pages", "3,000-5,000", "15-20"],
          ["Month 6", "100+ pages", "8,000-12,000", "25-40"],
          ["Month 12", "116+ pages", "15,000+", "40-60"],
        ]}
      />
      <div style={{
        marginTop: 28, textAlign: "center", fontSize: 18, fontWeight: 700,
        color: "#1e3a5f", fontStyle: "italic",
      }}>
        "Each page = a door for leads to find us.<br />116 pages = 116 doors open 24/7."
      </div>
      <div style={{ marginTop: 32, background: "#f0f9ff", borderRadius: 12, padding: 24, border: "1px solid #bae6fd" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e3a5f", marginBottom: 12 }}>Google Business Profile Impact</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {[
            ["Currently", "2 reviews, 5.0 stars"],
            ["Target", "50 reviews in 90 days"],
            ["With 50 reviews", "Top 3 map pack for NJ HVAC searches"],
            ["Map pack", "60% of all local search clicks"],
          ].map(([k, v]) => (
            <div key={k} style={{ fontSize: 14 }}>
              <span style={{ fontWeight: 700, color: "#1e3a5f" }}>{k}: </span>
              <span style={{ color: "#334155" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </Slide>
  );
}

/* ================================================================
   SLIDE 9 — STRATEGIC PIVOT
   ================================================================ */
function Slide9() {
  const moves = [
    { emoji: "\ud83c\udfc6", title: "Rebate Specialist Positioning", color: "#ff6b35", items: [
      'Primary message: "$16K in rebates \u2014 we handle everything"',
      "Action: Get BPI certification for NJ Whole Home program",
      "Why: No major competitor owns this position",
      "Revenue impact: 3x conversion rate vs generic HVAC",
    ]},
    { emoji: "\ud83d\udc8e", title: "Luxury Market Expansion", color: "#7c3aed", items: [
      "Target: Alpine, Saddle River, Bernardsville, Short Hills, Ridgewood, Peapack-Gladstone",
      "Average job: $20,000-$50,000",
      "Action: Carrier + Trane + Lennox dealer agreements",
      "18 luxury pages already live and indexed",
    ]},
    { emoji: "\ud83c\udfe2", title: "Commercial Pipeline", color: "#1e3a5f", items: [
      "Target: Property managers, office buildings, restaurants, healthcare, retail chains",
      "Average job: $35,000-$150,000",
      "Rebates: up to 80% covered",
      "Action: Commercial referral partner network",
    ]},
    { emoji: "\ud83d\udcda", title: "Courses as Revenue Stream", color: "#059669", items: [
      "Full LMS already built",
      "Target: HVAC technicians, contractors, homeowners",
      "6 categories \u00d7 multiple courses",
      "Certifications, rebate sales training",
      "Recurring revenue: course subscriptions",
    ]},
    { emoji: "\ud83e\udd16", title: "AI-First Scaling", color: "#dc2626", items: [
      "Jessica AI on phones + chat + SMS",
      "Book appointments without headcount",
      "Stripe payment before truck rolls",
      "Scale to 50+ leads/week without new hires",
    ]},
  ];

  return (
    <Slide>
      <SH sub="">2026-2027 Strategic Pivot</SH>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        {moves.map(m => (
          <div key={m.title} style={{
            background: "#fff", borderRadius: 12, padding: "20px",
            border: "1px solid #e2e8f0", borderLeft: `5px solid ${m.color}`,
          }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{m.emoji}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: m.color, marginBottom: 10 }}>{m.title}</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {m.items.map((item, i) => (
                <li key={i} style={{ fontSize: 12, color: "#475569", marginBottom: 5, paddingLeft: 14, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: m.color }}>&#8226;</span>{item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Slide>
  );
}

/* ================================================================
   SLIDE 10 — 90 DAY ACTION PLAN
   ================================================================ */
function Slide10() {
  const months = [
    { title: "Month 1 \u2014 ACTIVATE", color: "#ff6b35", items: [
      "10 Google reviews (text Thumbtack customers)",
      "Resume paused Google Ads campaign",
      "Get BPI certification",
      "Connect Vapi Jessica to phone number",
      "Publish 4 more blog posts",
      "Get Carrier/Trane/Lennox dealer agreements",
      "Launch Facebook ads for rebates",
    ]},
    { title: "Month 2 \u2014 GROW", color: "#2563eb", items: [
      "25+ Google reviews \u2014 map pack entry",
      "Launch commercial referral network",
      "First commercial VRV/VRF pipeline",
      "Add Central NJ + Shore area pages",
      "Email nurture sequence for leads",
      "Launch courses \u2014 first paid enrollment",
      "ServiceTitan full integration",
    ]},
    { title: "Month 3 \u2014 SCALE", color: "#059669", items: [
      "50 Google reviews \u2014 map pack top 3",
      "2 additional installation technicians",
      "Maintenance plan subscription launched",
      "Real estate agent partnership program",
      "Multi-family property owner targeting",
      "200+ SEO pages live",
      "$200K+ monthly revenue target",
    ]},
  ];

  return (
    <Slide>
      <SH sub="">Next 90 Days — Execution Plan</SH>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {months.map(m => (
          <div key={m.title} style={{
            background: "#fff", borderRadius: 12, padding: 24,
            border: "1px solid #e2e8f0", borderTop: `4px solid ${m.color}`,
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: m.color, marginBottom: 16 }}>{m.title}</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {m.items.map((item, i) => (
                <li key={i} style={{ fontSize: 13, color: "#334155", marginBottom: 10, paddingLeft: 22, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, fontSize: 16 }}>{"\u2610"}</span>{item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Slide>
  );
}

/* ================================================================
   SLIDE 11 — INVESTMENT NEEDED
   ================================================================ */
function Slide11() {
  return (
    <Slide>
      <SH sub="">Investment to Hit $3.6M Annual Revenue</SH>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 28 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e3a5f", marginBottom: 12 }}>Current Tech Stack Cost</h3>
          <SimpleTable compact headers={["Service", "Cost"]} rows={[
            ["Netlify Hosting", "$0-45/month"],
            ["Vapi AI Calls", "~$100/month"],
            ["Stripe Fees", "2.9% revenue"],
            ["ServiceTitan", "~$400/month"],
            ["Total Tech Stack", "~$650/month"],
          ]} />
        </div>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e3a5f", marginBottom: 12 }}>Recommended Ad Investment</h3>
          <SimpleTable compact headers={["Channel", "Budget"]} rows={[
            ["Google Ads", "$3,000/month"],
            ["Facebook/Instagram Ads", "$2,000/month"],
            ["BPI Certification", "One-time"],
            ["Total Monthly Ads", "$5,000/month"],
          ]} />
        </div>
      </div>
      <div style={{
        background: "#f0fdf4", border: "2px solid #bbf7d0", borderRadius: 12,
        padding: 24, textAlign: "center", marginBottom: 28,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#166534", marginBottom: 8 }}>ROI Calculation</h3>
        <p style={{ fontSize: 14, color: "#166534", margin: 0 }}>
          $5,000 ad spend &rarr; 25 leads &rarr; 6 installs &times; $10,000 avg = <strong>$60,000 revenue</strong>
        </p>
        <p style={{ fontSize: 22, fontWeight: 800, color: "#059669", marginTop: 8 }}>ROI: 12:1 on ad spend</p>
      </div>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e3a5f", marginBottom: 12 }}>Hiring Plan</h3>
        <SimpleTable compact headers={["Timeline", "Role", "Cost"]} rows={[
          ["Month 1", "1 Installer", "$65K/year"],
          ["Month 3", "1 BPI Auditor", "$70K/year"],
          ["Month 6", "1 Commercial Sales Rep", "$60K + commission"],
        ]} />
      </div>
    </Slide>
  );
}

/* ================================================================
   SLIDE 12 — SERVICETITAN INTEGRATION
   ================================================================ */
function Slide12() {
  const benefits = [
    { emoji: "\ud83d\udccb", title: "Job Management", color: "#1e3a5f", text: "Every lead, booking, and job tracked in one place. Dispatch, scheduling, and technician management. Real-time job status visible to the whole team. Integrates directly with our booking system." },
    { emoji: "\ud83d\udcb0", title: "Revenue Tracking", color: "#ff6b35", text: "Every invoice, payment, and job value tracked. Stripe payments sync with ServiceTitan records. Know your revenue, margins, and top technicians at any moment. Essential for scaling to 8 figures." },
    { emoji: "\ud83d\udcca", title: "Performance Analytics", color: "#7c3aed", text: "Track close rates, average job value, lead sources. Know which marketing channels drive most revenue. Identify top performers and underperforming areas. Data-driven decisions at every level." },
    { emoji: "\ud83d\udd17", title: "Platform Integration", color: "#059669", text: "ServiceTitan + Jessica AI + Stripe + our website = fully automated lead-to-payment pipeline. Customer books \u2192 ServiceTitan creates job \u2192 Tech dispatched \u2192 Invoice sent \u2192 Payment collected. Zero manual data entry." },
  ];

  return (
    <Slide>
      <SH sub="">ServiceTitan \u2014 The Operating System for Scale</SH>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, marginBottom: 28 }}>
        {benefits.map(b => (
          <div key={b.title} style={{
            background: "#fff", borderRadius: 12, padding: 20,
            border: "1px solid #e2e8f0", borderLeft: `5px solid ${b.color}`,
          }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{b.emoji}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: b.color, marginBottom: 8 }}>{b.title}</div>
            <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.6 }}>{b.text}</p>
          </div>
        ))}
      </div>
      <div style={{
        background: "#fff7ed", border: "2px solid #ff6b35", borderRadius: 12,
        padding: "20px 24px", textAlign: "center",
      }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#1e3a5f", margin: 0 }}>
          Industry data: HVAC companies using ServiceTitan report average revenue increase of <span style={{ color: "#ff6b35" }}>23% in year 1</span> and technician productivity gains of <span style={{ color: "#ff6b35" }}>20-30%</span>.
        </p>
      </div>
    </Slide>
  );
}

/* ================================================================
   SLIDE 13 — 5-YEAR PATH TO 8 FIGURES
   ================================================================ */
function Slide13() {
  const years = [
    { year: "2026", label: "BUILD THE MACHINE", color: "#ff6b35", revenue: "$1.5M-$2.4M", milestones: [
      "116 SEO pages ranking", "20+ leads/week from organic", "Google Ads generating 25+ leads/week",
      "50 Google reviews \u2014 map pack top 3", "2-3 installation technicians", "ServiceTitan fully integrated",
      "First commercial VRV/VRF jobs closed", "Courses platform generating revenue", "BPI certification secured",
    ], foundation: "Digital infrastructure live, payments automated, AI handling 24/7" },
    { year: "2027", label: "DOMINATE LOCAL MARKET", color: "#2563eb", revenue: "$3M-$5M", milestones: [
      "200+ SEO pages (add Central NJ, Shore)", "#1 map pack for NJ HVAC searches",
      "5-7 installation technicians", "Commercial pipeline: 2-3 VRF jobs/month",
      "Maintenance subscription: 500+ members", "Courses: 1,000+ enrolled students",
      "Partnership network: 50+ active referrers", "Carrier/Trane/Lennox preferred dealer status",
      "Average job value: $12,000+",
    ], foundation: "Brand authority established, recurring revenue streams active" },
    { year: "2028", label: "EXPAND GEOGRAPHY", color: "#7c3aed", revenue: "$5M-$7M", milestones: [
      "Expand to Central NJ (full coverage)", "Shore area HVAC market penetration",
      "10-15 technicians across NJ", "Second service hub (Central NJ)",
      "Commercial: target multi-family/apartments", "Government contracts (WMBE/SBE advantage)",
      "Courses: industry-recognized certification", "1,000+ Google reviews", "Revenue per technician: $400K+",
    ], foundation: "Multi-location operations, government contract pipeline" },
    { year: "2029", label: "VERTICAL INTEGRATION", color: "#059669", revenue: "$7M-$9M", milestones: [
      "Launch HVAC equipment supply/distribution", "Franchise model development",
      "Training center physical location", "20+ technicians",
      "Commercial accounts: hospitals, schools, government buildings",
      "Private label maintenance products", "Acquire 1-2 smaller NJ HVAC companies",
      "Real estate HVAC partnership program",
    ], foundation: "Beyond service \u2014 becoming an HVAC ecosystem company" },
    { year: "2030", label: "8 FIGURES", color: "#dc2626", revenue: "$10M-$15M", milestones: [
      "NJ market leadership position", "Franchise: 3-5 licensed locations",
      "Courses platform: national reach", "Equipment distribution revenue stream",
      "30+ employees", "EBITDA margin: 15-20%",
      "Strategic acquisition target OR private equity interest",
      'Brand: "The NJ Heat Pump Company"',
    ], foundation: "Multiple revenue streams, defensible market position, acquisition-ready infrastructure" },
  ];

  const reasons = [
    { emoji: "\ud83c\udfd7\ufe0f", title: "Infrastructure Already Built", text: "Most companies spend years building what we built in 30 days. We start at year 3 of most competitors' journey." },
    { emoji: "\ud83d\udcc8", title: "Market Tailwind", text: "Heat pump market growing 9.85% annually. NJ mandating electrification. Rebates creating urgency. We're in the right market at the right time." },
    { emoji: "\ud83e\udd16", title: "AI Advantage", text: "Jessica AI scales without headcount. Every new lead costs us less per unit. Competitors can't replicate this quickly." },
    { emoji: "\ud83d\udcda", title: "Courses = Defensible Moat", text: "Industry training creates brand authority, recurring revenue, and a pipeline of certified technicians who know our systems." },
    { emoji: "\ud83c\udfc6", title: "WMBE/SBE Certification", text: "Government contracts, diversity supplier programs, and preferred vendor status create revenue streams unavailable to most HVAC competitors." },
  ];

  return (
    <Slide bg="linear-gradient(135deg, #0f2744 0%, #1e3a5f 100%)">
      <div style={{ color: "#fff" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0 }}>From $0 to 8 Figures \u2014 The Roadmap</h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,.7)", marginTop: 8 }}>How Mechanical Enterprise reaches $10M+ by 2030</p>
        </div>

        {/* Timeline */}
        <div style={{ display: "flex", gap: 12, marginBottom: 32, overflowX: "auto" }}>
          {years.map(y => (
            <div key={y.year} style={{
              flex: "1 1 0", minWidth: 190, background: "rgba(255,255,255,.07)",
              borderRadius: 10, padding: "16px 14px", borderTop: `4px solid ${y.color}`,
            }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: y.color }}>{y.year}</div>
              <div style={{ fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,.6)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>{y.label}</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#fff", marginBottom: 8 }}>{y.revenue}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 8px 0" }}>
                {y.milestones.slice(0, 5).map((m, i) => (
                  <li key={i} style={{ fontSize: 10, color: "rgba(255,255,255,.75)", marginBottom: 3, paddingLeft: 10, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: y.color }}>&#8226;</span>{m}
                  </li>
                ))}
                {y.milestones.length > 5 && (
                  <li style={{ fontSize: 10, color: "rgba(255,255,255,.5)", paddingLeft: 10 }}>+{y.milestones.length - 5} more milestones</li>
                )}
              </ul>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,.5)", fontStyle: "italic", borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 6 }}>
                {y.foundation}
              </div>
            </div>
          ))}
        </div>

        {/* What makes this achievable */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#ff6b35", textAlign: "center", marginBottom: 16 }}>WHAT MAKES THIS ACHIEVABLE</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
            {reasons.map(r => (
              <div key={r.title} style={{
                background: "rgba(255,255,255,.06)", borderRadius: 8, padding: "12px 10px",
                border: "1px solid rgba(255,255,255,.1)",
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{r.emoji}</div>
                <div style={{ fontWeight: 700, fontSize: 11, color: "#ff6b35", marginBottom: 4 }}>{r.title}</div>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,.7)", margin: 0, lineHeight: 1.5 }}>{r.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <div style={{
          textAlign: "center", padding: "16px 24px",
          background: "rgba(255,107,53,.15)", borderRadius: 10, border: "1px solid rgba(255,107,53,.3)",
        }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#ff6b35", margin: 0, lineHeight: 1.6 }}>
            The question is not whether this is possible.<br />
            The infrastructure is built. The market is moving our way.<br />
            The question is: how fast do we execute?
          </p>
        </div>

        {/* Contact footer */}
        <div style={{ textAlign: "center", marginTop: 24, borderTop: "1px solid rgba(255,255,255,.15)", paddingTop: 20 }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>&#9881;&#65039;</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Mechanical Enterprise LLC</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap", fontSize: 12, color: "rgba(255,255,255,.7)" }}>
            <span>&#128222; (862) 419-1763</span>
            <span>&#128231; sales@mechanicalenterprise.com</span>
            <span>&#127760; mechanicalenterprise.com</span>
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* ================================================================
   SLIDES ARRAY
   ================================================================ */
const SLIDES = [Slide1, Slide2, Slide3, Slide4, Slide5, Slide6, Slide7, Slide8, Slide9, Slide10, Slide11, Slide12, Slide13];

/* ================================================================
   MAIN PRESENTATION COMPONENT
   ================================================================ */
export default function Presentation() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("pres-auth") === "1");
  const [current, setCurrent] = useState(0);

  const go = useCallback((dir: number) => {
    setCurrent(c => Math.max(0, Math.min(TOTAL_SLIDES - 1, c + dir)));
  }, []);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") go(1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(-1);
    else if (e.key === "Escape") {
      sessionStorage.removeItem("pres-auth");
      setAuthed(false);
    }
  }, [go]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  if (!authed) return <PasswordGate onUnlock={() => setAuthed(true)} />;

  const SlideComponent = SLIDES[current];

  return (
    <>
      <style>{`
        @media print {
          .pres-controls { display: none !important; }
          .pres-slide { min-height: auto !important; page-break-after: always; }
        }
        body { margin: 0; }
      `}</style>
      <div style={{ position: "relative", minHeight: "100vh", background: "#f8fafc" }}>
        {/* Slide */}
        <div className="pres-slide">
          <SlideComponent />
        </div>

        {/* Controls */}
        <div className="pres-controls" style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "rgba(30,58,95,.95)", backdropFilter: "blur(8px)",
          padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
          zIndex: 100,
        }}>
          {/* Left arrow */}
          <button
            onClick={() => go(-1)}
            disabled={current === 0}
            style={{
              background: current === 0 ? "rgba(255,255,255,.1)" : "#ff6b35",
              border: "none", borderRadius: 8, padding: "8px 16px",
              color: "#fff", fontWeight: 700, fontSize: 16, cursor: current === 0 ? "default" : "pointer",
              opacity: current === 0 ? 0.4 : 1,
            }}
          >&#8592; Prev</button>

          {/* Dots */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                style={{
                  width: i === current ? 24 : 10, height: 10, borderRadius: 5,
                  background: i === current ? "#ff6b35" : "rgba(255,255,255,.3)",
                  border: "none", cursor: "pointer", transition: "all .2s", padding: 0,
                }}
              />
            ))}
          </div>

          {/* Counter + Export */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ color: "rgba(255,255,255,.7)", fontSize: 13, fontWeight: 600 }}>
              {current + 1} of {TOTAL_SLIDES}
            </span>
            <button
              onClick={() => window.print()}
              style={{
                background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.2)",
                borderRadius: 6, padding: "6px 12px", color: "#fff", fontSize: 12,
                cursor: "pointer", fontWeight: 600,
              }}
            >Export PDF</button>
            {/* Right arrow */}
            <button
              onClick={() => go(1)}
              disabled={current === TOTAL_SLIDES - 1}
              style={{
                background: current === TOTAL_SLIDES - 1 ? "rgba(255,255,255,.1)" : "#ff6b35",
                border: "none", borderRadius: 8, padding: "8px 16px",
                color: "#fff", fontWeight: 700, fontSize: 16,
                cursor: current === TOTAL_SLIDES - 1 ? "default" : "pointer",
                opacity: current === TOTAL_SLIDES - 1 ? 0.4 : 1,
              }}
            >Next &#8594;</button>
          </div>
        </div>
      </div>
    </>
  );
}

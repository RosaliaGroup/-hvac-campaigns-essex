import { useState, useEffect, useCallback } from "react";

const PASSWORD = "mechanicalenterprise2026";
const TOTAL_SLIDES = 19;

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
                  verticalAlign: "middle",
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
          "Lead capture → email notification",
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
    ["🔥", "/lp/heat-pump-rebates", "Heat Pump Rebates"],
    ["🏢", "/lp/commercial-vrv", "Commercial VRV/VRF"],
    ["🚨", "/lp/emergency-hvac", "Emergency HVAC"],
    ["📘", "/lp/fb-residential", "Facebook Residential"],
    ["📘", "/lp/fb-commercial", "Facebook Commercial"],
    ["📖", "/lp/rebate-guide", "Rebate Guide"],
    ["🔧", "/lp/maintenance-offer", "Maintenance Offer"],
    ["🤝", "/lp/referral-partner", "Referral Partner"],
  ];
  const seo = [
    ["📍", "49 city pages — 20mi radius of Newark"],
    ["📍", "23 North NJ cities (Morris, Passaic, Sussex)"],
    ["🏆", "18 luxury area pages (Alpine, Saddle River, Bernardsville, Short Hills, Ridgewood, etc.)"],
    ["\u2699️", "8 service pages (Heat Pump, Mini-Split, VRF, Full Replacement, Commercial, Financing)"],
    ["\u2694️", "4 competitor conquest pages (AJ Perri, Gold Medal, Horizon, Hutchinson)"],
    ["📝", "Blog — launched March 31, 2026"],
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
              ["PSE&G Clean Heat — Non LMI (50%)", "Up to $10,000"],
              ["PSE&G Clean Heat — LMI (60%)", "Up to $12,000"],
              ["Decommissioning Adder", "Up to $2,000"],
              ["Re-ducting Adder (Manual D)", "Up to $2,000"],
              ["Additional ccASHP Unit", "$2,000 per unit"],
              ["PSE&G OBR Financing — Non LMI", "0% / 84 months"],
              ["PSE&G OBR Financing — LMI", "0% / 120 months"],
              ["Maximum Possible (LMI + all adders)", "Up to $18,000"],
            ]}
          />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e3a5f", marginBottom: 12 }}>Key Market Facts</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {[
              "Federal 25C tax credit expired Dec 2025 — urgency to act on state rebates NOW",
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
    ["Rebate Specialization", "✅ Core focus", "⚠️ Limited", "⚠️ Limited"],
    ["AI Chat 24/7", "✅ Live", "❌ No", "❌ No"],
    ["Online Payment", "✅ Stripe live", "❌ No", "❌ No"],
    ["SEO Landing Pages", "✅ 116 pages", "⚠️ Generic", "⚠️ Generic"],
    ["Course Platform", "✅ Full LMS", "❌ No", "❌ No"],
    ["WMBE/SBE Certified", "✅ Certified", "❌ No", "❌ No"],
    ["Booking Automation", "✅ Full flow", "❌ No", "❌ No"],
    ["Lead Scoring System", "✅ Built", "❌ No", "❌ No"],
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
          ["AJ Perri", "$58.7M revenue, 300 techs — NO rebate focus"],
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
      <SH sub="">Revenue Model — $350K Per Installer Per Year</SH>
      <div style={{ marginBottom: 20 }}>
        <SimpleTable headers={["Year", "Installers", "Installer Revenue", "Monthly Run Rate"]} rows={[
          ["2026", "4-8", "$1.4M-$2.8M", "$116K-$233K"],
          ["2027", "12", "$4,200,000", "$350,000"],
          ["2028", "20", "$7,000,000", "$583,333"],
          ["2029", "30", "$10,500,000", "$875,000"],
          ["2030", "50+", "$17,500,000+", "$1,458,333+"],
        ]} compact />
      </div>
      <div style={{
        marginBottom: 20, fontSize: 12, color: "#475569", padding: "10px 14px",
        background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0",
      }}>
        Revenue model based on $350K per installer per year. Does NOT include commercial VRV/VRF jobs, courses revenue, maintenance subscriptions, or partnership income — all of which are additive.
      </div>
      {/* Pipeline highlight */}
      <div style={{
        background: "#ff6b35", borderRadius: 10, padding: "14px 20px",
        textAlign: "center", marginBottom: 20,
      }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{"🎯"} 2026: 4 INSTALLERS NOW {"→"} 8 BY Q4 = $1.4M-$2.8M</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {[
          { title: "Conservative", subtitle: "4 installers + confirmed contracts", color: "#059669", bg: "#f0fdf4", border: "#bbf7d0", lines: ["4 installers × $350K = $1.4M", "+ $88K confirmed contracts"], total: "2026 Total: $1.4M+" },
          { title: "Moderate", subtitle: "6 installers + PSE&G pipeline", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", lines: ["6 installers × $350K = $2.1M", "+ PSE&G Clean Heat pipeline"], total: "2026 Total: $2.1M+" },
          { title: "Aggressive (TARGET)", subtitle: "8 installers + full marketing", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", lines: ["8 installers × $350K = $2.8M", "+ Commercial Engineered Solutions"], total: "2026 Total: $2.8M+" },
        ].map(s => (
          <div key={s.title} style={{ background: s.bg, border: `2px solid ${s.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: s.color, marginBottom: 4 }}>{s.title}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>{s.subtitle}</div>
            {s.lines.map((l, i) => (
              <div key={i} style={{ fontSize: 13, color: i === 0 ? "#334155" : "#475569", marginBottom: 4, fontWeight: i === 0 ? 600 : 400 }}>{l}</div>
            ))}
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, marginTop: 8 }}>{s.total}</div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 20, textAlign: "center", fontSize: 14, fontWeight: 700,
        color: "#ff6b35", padding: "12px", background: "#fff7ed", borderRadius: 8, border: "1px solid #fed7aa",
      }}>
        "1 new installer hired = $350K added to top line. Hiring is the highest ROI investment we can make."
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
    { emoji: "🏆", title: "Rebate Specialist Positioning", color: "#ff6b35", items: [
      'Primary message: "$16K in rebates — we handle everything"',
      "Action: Scale PSE&G Clean Heat Trade Ally program (PN#136)",
      "Why: No major competitor owns this position",
      "Revenue impact: 3x conversion rate vs generic HVAC",
    ]},
    { emoji: "💎", title: "Luxury Market Expansion", color: "#7c3aed", items: [
      "Target: Alpine, Saddle River, Bernardsville, Short Hills, Ridgewood, Peapack-Gladstone",
      "Average job: $20,000-$50,000",
      "Action: Carrier + Trane + Lennox dealer agreements",
      "18 luxury pages already live and indexed",
    ]},
    { emoji: "🏢", title: "Commercial Pipeline", color: "#1e3a5f", items: [
      "Target: Property managers, office buildings, restaurants, healthcare, retail chains",
      "Average job: $35,000-$150,000",
      "Rebates: up to 80% covered",
      "Action: Commercial referral partner network",
    ]},
    { emoji: "📚", title: "Courses as Revenue Stream", color: "#059669", items: [
      "Full LMS already built",
      "Target: HVAC technicians, contractors, homeowners",
      "6 categories × multiple courses",
      "Certifications, rebate sales training",
      "Recurring revenue: course subscriptions",
    ]},
    { emoji: "🤖", title: "AI-First Scaling", color: "#dc2626", items: [
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
   SLIDE 10 — MARKETING STRATEGY
   ================================================================ */
function Slide10() {
  const channels = [
    ["PSE&G Program (PN#136)", "✅ Active", "1-2", "Scale up"],
    ["SEO — 116 pages", "✅ Live", "0-2", "Growing"],
    ["Google Business Profile", "✅ Live", "0-1", "Need reviews"],
    ["Chat Widget (Jessica AI)", "✅ Live", "0-1", "Optimizing"],
    ["Google Ads", "⏳ Paused", "0", "LAUNCH NOW"],
    ["Facebook/Instagram Ads", "⏳ Needed", "0", "LAUNCH NOW"],
    ["Referral Partners", "⏳ Needed", "0", "BUILD NOW"],
    ["Thumbtack/Angi", "⏳ Needed", "0", "ACTIVATE"],
    ["Real Estate Agents", "⏳ Needed", "0", "BUILD NOW"],
  ];

  const campaigns = [
    { emoji: "🔍", title: "Google Ads — PSE&G Rebate Keywords", color: "#1e3a5f", items: [
      "Budget: $1,500/month",
      'Keywords: "PSE&G heat pump rebate", "heat pump installation NJ", "replace gas furnace NJ", "free HVAC assessment NJ"',
      "Expected: 8-12 leads/week",
      "Close rate: 25% = 2-3 installs/week",
      "ROI: $1,500 spend → $21,000+ revenue",
    ]},
    { emoji: "📘", title: "Facebook/Instagram — Homeowner Rebate Ads", color: "#2563eb", items: [
      "Budget: $1,000/month",
      "Target: NJ homeowners 35-65, own home, income $60K+",
      'Ad angle: "NJ is paying up to $18,000 to replace your old furnace. Find out if you qualify — free."',
      "Expected: 15-20 leads/week",
      "Close rate: 15% = 2-3 installs/week",
    ]},
    { emoji: "🤝", title: "PSE&G Program — Referral Network", color: "#059669", items: [
      "Budget: $0 (referral fees from job revenue)",
      "Partners: Real estate agents, property managers, plumbers, electricians, roofers",
      "Referral fee: $200-$500 per closed install",
      "Expected: 3-5 referrals/week from 20 active partners",
      "Close rate: 40% = 1-2 installs/week",
    ]},
    { emoji: "⭐", title: "Google Reviews — Map Pack Domination", color: "#ff6b35", items: [
      "Budget: $0",
      "Action: Text all past customers for Google reviews",
      "Goal: 10 reviews in 30 days → 50 in 90 days",
      "Impact: Top 3 map pack = 60% of all local HVAC clicks",
      "Expected: 3-5 additional leads/week at $0 ad cost",
    ]},
    { emoji: "📋", title: "Thumbtack + Angi + HomeAdvisor", color: "#7c3aed", items: [
      "Budget: $300-$500/month",
      "Action: Create profiles, upload photos, get reviews",
      "Target: NJ homeowners searching for HVAC replacement",
      "Expected: 3-5 leads/week",
      "Close rate: 20% = 1 install/week",
    ]},
  ];

  return (
    <Slide>
      <SH sub="The math: 3 installs/week × $350K avg × 52 weeks = $1.05M/year per installer">How We Get to 3 Installations Per Week</SH>

      {/* HOW WE GET LEADS NOW */}
      <div style={{ background: "#fef2f2", border: "2px solid #dc2626", borderRadius: 10, padding: "10px 14px", marginBottom: 14, textAlign: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#dc2626" }}>{"🚨"} HOW WE GET LEADS STARTING THIS WEEK</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 14 }}>
        {[
          { when: "TODAY — $0", title: "Text Past Customers", text: '"PSE&G is now offering up to $18,000 to replace gas furnaces — no catch, no upfront cost. Want a free 10-min assessment?" Expected: 2-5 leads from 20 texts' },
          { when: "THIS WEEK — $0", title: "Google Business Profile", text: "Post daily. Upload before/after photos. Request reviews from completed jobs. Expected: 1-3 leads/week within 30 days" },
          { when: "THIS WEEK — $300", title: "Facebook Boost", text: "Boost best post $10/day. Target: NJ homeowners 35-65, 20mi of Newark. Expected: 5-10 leads first week" },
          { when: "THIS WEEK — $0", title: "Nextdoor + FB Groups", text: '"We\'re PSE&G approved. PSE&G paying up to $18,000. Free assessment — no obligation." Expected: 3-8 leads/week' },
          { when: "THIS WEEK — $0", title: "Call 10 RE Agents", text: '"When buyers ask about HVAC, we offer $18,000 in rebates. Can we be your preferred HVAC contractor?" Expected: 1-2 referrals/week in 60 days' },
        ].map(a => (
          <div key={a.title} style={{ background: "#fff", borderRadius: 8, padding: "10px 8px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 8, fontWeight: 800, color: "#dc2626", marginBottom: 3 }}>{a.when}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#1e3a5f", marginBottom: 4 }}>{a.title}</div>
            <div style={{ fontSize: 8, color: "#475569", lineHeight: 1.4 }}>{a.text}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 14, background: "#1e3a5f", borderRadius: 8, padding: "10px 8px" }}>
        {[["Week 1", "5-15 leads"], ["Week 2", "10-20 leads"], ["Week 3", "15-25 leads"], ["Week 4", "20-30 leads"], ["Month 2", "30-50/week"]].map(([w, l]) => (
          <div key={w} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#ff6b35" }}>{w}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,.8)" }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Goal stat bar */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20,
        background: "#ff6b35", borderRadius: 10, padding: "14px 12px",
      }}>
        {[["3", "Installs/Week"], ["$1,050", "Billed/Day"], ["$87,500", "Monthly Revenue"], ["$1.05M", "Annual/Installer"]].map(([v, l]) => (
          <div key={l} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{v}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.8)" }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Current channels table */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e3a5f", marginBottom: 8 }}>Current Lead Sources & Gaps</h3>
        <SimpleTable compact headers={["Channel", "Status", "Leads/wk", "Action"]} rows={channels} />
      </div>

      {/* 5 campaigns */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e3a5f", marginBottom: 10 }}>5 Campaigns to Launch Immediately</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
        {campaigns.map(c => (
          <div key={c.title} style={{
            background: "#fff", borderRadius: 10, padding: "12px 10px",
            border: "1px solid #e2e8f0", borderTop: `3px solid ${c.color}`,
          }}>
            <div style={{ fontSize: 18, marginBottom: 2 }}>{c.emoji}</div>
            <div style={{ fontWeight: 700, fontSize: 10, color: c.color, marginBottom: 6 }}>{c.title}</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {c.items.map((item, i) => (
                <li key={i} style={{ fontSize: 9, color: "#475569", marginBottom: 3, paddingLeft: 8, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: c.color }}>&#8226;</span>{item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Combined projection */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", marginBottom: 8 }}>Combined: How We Hit 3+ Installs/Week</h3>
          <SimpleTable compact headers={["Channel", "Leads/wk", "Installs/wk"]} rows={[
            ["Google Ads", "8-12", "2-3"],
            ["Facebook Ads", "15-20", "2-3"],
            ["PSE&G Referral Network", "3-5", "1-2"],
            ["Google Reviews/Maps", "3-5", "1"],
            ["Thumbtack/Angi", "3-5", "1"],
            ["SEO organic (growing)", "5-10", "1-2"],
            ["TOTAL", "37-57/week", "8-12/week"],
          ]} />
          <div style={{ fontSize: 10, color: "#475569", marginTop: 6, lineHeight: 1.5 }}>
            At 3 installs/week we need 1 installer. At 6/week we need 2. At 12/week we need 4. Marketing scales before hiring scales.
          </div>
        </div>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", marginBottom: 8 }}>Total Marketing Budget Needed</h3>
          <SimpleTable compact headers={["Channel", "Cost"]} rows={[
            ["Google Ads", "$1,500/month"],
            ["Facebook/Instagram Ads", "$1,000/month"],
            ["Thumbtack/Angi", "$400/month"],
            ["Referral fees (per job)", "~$300/install"],
            ["Total Monthly Ad Spend", "$2,900/month"],
            ["Revenue at 3 installs/wk", "$87,500/month"],
            ["ROI on ad spend", "30:1"],
          ]} />
        </div>
      </div>

      {/* Bottom highlight */}
      <div style={{
        background: "#fff7ed", border: "2px solid #ff6b35", borderRadius: 10,
        padding: "12px 16px", textAlign: "center",
      }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", margin: 0 }}>
          3 installs/week requires $2,900/month in ads. 3 installs/week generates $87,500/month in revenue. Every $1 spent on ads returns <span style={{ color: "#ff6b35" }}>$30 in revenue</span>. This is the highest ROI use of capital available to us.
        </p>
      </div>
    </Slide>
  );
}

/* ================================================================
   SLIDE 11 — BLOG + SEO CONTENT STRATEGY
   ================================================================ */
function Slide11() {
  return (
    <Slide>
      <SH sub="Every blog post is a 24/7 salesperson that never sleeps">Content Strategy — 1 Blog Per Day Compounds Growth</SH>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", marginBottom: 8 }}>SEO Impact Timeline (116 pages already indexed)</h3>
          <SimpleTable compact headers={["Timeframe", "Traffic", "Leads"]} rows={[
            ["Month 1-2", "Pages indexed, near zero", "0"],
            ["Month 3-4", "First rankings — 5-10 visits/day", "1-2/week"],
            ["Month 6", "50-100 visits/day", "2-3/week"],
            ["Month 9", "200+ visits/day", "5-8/week"],
            ["Month 12", "500+ visits/day", "10-15/week organic"],
          ]} />
          <div style={{ fontSize: 10, color: "#475569", marginTop: 6, fontStyle: "italic" }}>
            WITHOUT any additional blogs. 1 blog/day ACCELERATES this dramatically.
          </div>
        </div>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", marginBottom: 8 }}>1 Blog/Day (7/week) Compound Effect</h3>
          <SimpleTable compact headers={["Month", "Total Articles", "Visits/day", "Leads/mo (2%)"]} rows={[
            ["Month 1", "30 + 116", "50-80", "5-10"],
            ["Month 3", "90 + 116", "200-350", "20-40"],
            ["Month 6", "180 + 116", "600-900", "60-100"],
            ["Month 12", "365 + 116", "2,000+", "200+"],
          ]} />
          <div style={{ marginTop: 8, background: "#f0fdf4", borderRadius: 6, padding: "8px 10px", fontSize: 10, color: "#166534", fontWeight: 600 }}>
            At 200 organic leads/month + 25% close = 50 installs/month from SEO alone. At $29K avg = $1,450,000/month from content.
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 14, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", border: "1px solid #fecaca", fontSize: 10, color: "#991b1b", fontWeight: 600, textAlign: "center" }}>
        1 blog/day vs competitors who post monthly = 365 articles/year vs their 12. Google rewards consistent fresh content. This is an unfair advantage we build starting today.
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", marginBottom: 8 }}>Sample Week — 7 Posts</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 14 }}>
        {[
          { day: "Mon", title: "Does My NJ Home Qualify for PSE&G $18,000 Rebate?" },
          { day: "Tue", title: "Gas Furnace vs Heat Pump NJ: Real Cost Comparison 2026" },
          { day: "Wed", title: "PSE&G Clean Heat: What Newark Homeowners Need to Know" },
          { day: "Thu", title: "Top Signs Your NJ Boiler Needs Replacement Now" },
          { day: "Fri", title: "West Orange HVAC Replacement: Complete Guide + Rebates" },
          { day: "Sat", title: "PSE&G OBR: Pay $0 Upfront for Your Heat Pump" },
          { day: "Sun", title: "NJ Commercial Buildings: How PSE&G Covers 80% of HVAC" },
        ].map(d => (
          <div key={d.day} style={{ background: "#f8fafc", borderRadius: 6, padding: "8px 6px", border: "1px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 10, color: "#ff6b35", marginBottom: 3 }}>{d.day}</div>
            <div style={{ fontSize: 8, color: "#475569", lineHeight: 1.3 }}>{d.title}</div>
          </div>
        ))}
      </div>

      <div style={{
        background: "#fff7ed", border: "2px solid #ff6b35", borderRadius: 10,
        padding: "12px 16px", textAlign: "center",
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#1e3a5f", margin: 0 }}>
          116 existing pages + 365 new blogs/year = <span style={{ color: "#ff6b35" }}>481 pages working 24/7</span>. Competitors post once a month. We post every single day. This is how we own NJ HVAC search.
        </p>
      </div>
    </Slide>
  );
}

/* ================================================================
   SLIDE 12 — SOCIAL MEDIA: NO CATCH CAMPAIGN
   ================================================================ */
function Slide12() {
  return (
    <Slide>
      <SH sub='Most NJ homeowners don&apos;t know they can get $18,000 to replace their furnace. We&apos;re going to tell them.'>Social Media Strategy — The No Catch Campaign</SH>

      {/* Campaign concept */}
      <div style={{
        background: "#ff6b35", borderRadius: 10, padding: "16px 20px",
        textAlign: "center", marginBottom: 16, color: "#fff",
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>THE MESSAGE:</div>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>
          PSE&G will pay up to $18,000 to replace your gas furnace with a heat pump.<br />
          No catch. No trick. No gimmick. Just fill out a form and we do the rest.
        </div>
      </div>

      {/* 4 platform cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        {[
          { title: "Facebook/Instagram", sub: "$1,000/month", color: "#2563eb", items: ["NJ homeowners 35-65, own home, income $50K+", 'Video: "We replaced this family\'s furnace for $0"', "Carousel: Before/After with rebate overlay", "3 posts/week organic + paid boosting", "Goal: 15-20 leads/week"] },
          { title: "Google Search Ads", sub: "$1,500/month", color: "#059669", items: ['"PSE&G heat pump rebate", "replace gas furnace NJ"', '"$18000 heat pump rebate NJ"', 'Ad: "NJ Pays Up to $18,000 — See If You Qualify"', "Goal: 8-12 leads/week"] },
          { title: "TikTok/Reels", sub: "$0 — Organic", color: "#7c3aed", items: ["30-60 second job site walkthroughs", '"We just saved this family $18,000"', '"PSE&G rebate explained in 60 seconds"', "3-5 reels/week", "Goal: 5-10 inbound DMs/week"] },
          { title: "Google Business Profile", sub: "$0 — Free", color: "#ff6b35", items: ["Weekly updates with job completions", "Before/after photos every job", "Customer review requests post-install", "Q&A for PSE&G rebate questions", "Goal: Map pack top 3"] },
        ].map(p => (
          <div key={p.title} style={{ background: "#fff", borderRadius: 8, padding: "12px 10px", border: "1px solid #e2e8f0", borderTop: `3px solid ${p.color}` }}>
            <div style={{ fontWeight: 800, fontSize: 11, color: p.color, marginBottom: 2 }}>{p.title}</div>
            <div style={{ fontSize: 9, color: "#64748b", marginBottom: 6 }}>{p.sub}</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {p.items.map((t, i) => (
                <li key={i} style={{ fontSize: 9, color: "#334155", marginBottom: 2, paddingLeft: 8, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: p.color }}>{"•"}</span>{t}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Ad concepts */}
      <h3 style={{ fontSize: 12, fontWeight: 700, color: "#1e3a5f", marginBottom: 8 }}>Ad Concepts</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        {[
          { name: "No Catch", headline: "PSE&G Is Paying Up to $18,000 to Replace Your Furnace", sub: "No catch. No trick. Just a free assessment + we handle all the paperwork." },
          { name: "Do The Math", headline: "Your Gas Bill: $300+. Heat Pump Bill: $80.", sub: "PSE&G pays up to $18K toward the switch. Monthly payment: as low as $0 with OBR." },
          { name: "Neighbors Did It", headline: "[City] Family Replaced Their Furnace for $0 Out of Pocket", sub: "PSE&G Clean Heat covers up to $18,000. We handled every form." },
          { name: "Commercial", headline: "PSE&G Will Cover 80% of Your Building’s HVAC Upgrade", sub: "Free audit. Free design. PSE&G funds construction. You pay 0% over 5 years." },
        ].map(a => (
          <div key={a.name} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 700, fontSize: 10, color: "#ff6b35", marginBottom: 4 }}>{a.name}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#1e3a5f", marginBottom: 3 }}>{a.headline}</div>
            <div style={{ fontSize: 9, color: "#475569" }}>{a.sub}</div>
          </div>
        ))}
      </div>

      {/* Combined lead projection + bottom box */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <SimpleTable compact headers={["Channel", "Leads/wk", "Cost/mo"]} rows={[
          ["Facebook/Instagram Ads", "15-20", "$1,000"],
          ["Google Search Ads", "8-12", "$1,500"],
          ["Organic SEO (growing)", "5-10", "$0"],
          ["TikTok/Reels organic", "3-5", "$0"],
          ["Google Business Profile", "3-5", "$0"],
          ["Referral network", "2-4", "$300/install"],
          ["TOTAL", "36-56/week", "$2,500/month"],
        ]} />
        <div style={{
          background: "#fff7ed", border: "2px solid #ff6b35", borderRadius: 10,
          padding: "12px 14px", display: "flex", flexDirection: "column", justifyContent: "center",
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#1e3a5f", margin: "0 0 6px 0", lineHeight: 1.5 }}>
            At 25% close: 9-14 installs/week<br />
            At 4 installers doing 3/week: 12 installs/week capacity<br />
            Marketing matches capacity perfectly.
          </p>
          <p style={{ fontSize: 12, fontWeight: 800, color: "#ff6b35", margin: 0 }}>
            $2,500/mo {"→"} 12 installs/week {"→"} $348K/week {"→"} $17.5M+ annual potential
          </p>
        </div>
      </div>
    </Slide>
  );
}

/* ================================================================
   SLIDE 13 — 90 DAY ACTION PLAN
   ================================================================ */
function Slide13() {
  const months = [
    { title: "Month 1 — LAUNCH MARKETING", color: "#ff6b35", items: [
      "Launch Google Ads ($1,500/month) — rebate keywords",
      "Launch Facebook Ads ($1,000/month) — homeowner rebate angle",
      "Create Thumbtack + Angi profiles",
      "Text ALL past customers for Google reviews (goal: 10)",
      "Build referral network — 10 real estate agents this month",
      "Hire 1 additional installer immediately",
      "Activate PSE&G program marketing — door knocking areas",
      "Connect Vapi Jessica to phone number",
    ]},
    { title: "Month 2 — SCALE TO 3 INSTALLS/WEEK", color: "#2563eb", items: [
      "25+ Google reviews — enter map pack",
      "Optimize Google Ads based on Month 1 data",
      "20 active referral partners",
      "Hire 2nd installer when hitting 6 installs/week",
      "ServiceTitan fully tracking all jobs and leads",
      "Blog posts targeting PSE&G rebate keywords",
    ]},
    { title: "Month 3 — HIT $87K/MONTH", color: "#059669", items: [
      "3+ installs/week consistently",
      "50 Google reviews — map pack top 3",
      "3 installers working",
      "$87,500/month revenue run rate",
      "Expand to North NJ PSE&G territory",
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
                  <span style={{ position: "absolute", left: 0, fontSize: 16 }}>{"☐"}</span>{item}
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
   SLIDE 14 — INVESTMENT NEEDED
   ================================================================ */
function Slide14() {
  return (
    <Slide>
      <SH sub="">Investment to Scale on $3M Pipeline</SH>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 28 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e3a5f", marginBottom: 12 }}>Current Tech Stack Cost</h3>
          <SimpleTable compact headers={["Service", "Cost"]} rows={[
            ["Netlify Hosting", "$0-45/month"],
            ["Vapi AI Calls", "~$100/month"],
            ["Stripe Fees", "2.9% revenue"],
            ["ServiceTitan CRM", "$1,300/month"],
            ["Total Tech Stack", "~$1,500/month"],
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
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#166534", marginBottom: 8 }}>Tech Stack ROI</h3>
        <p style={{ fontSize: 14, color: "#166534", margin: 0 }}>
          $1,500/month tech stack on $3M confirmed pipeline = <strong>0.6% overhead</strong>
        </p>
        <p style={{ fontSize: 14, color: "#166534", marginTop: 4 }}>
          Industry standard is 8-12% for tech/admin overhead
        </p>
        <p style={{ fontSize: 22, fontWeight: 800, color: "#059669", marginTop: 8 }}>Ad ROI: 12:1 on $5K/month spend</p>
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
   SLIDE 15 — SERVICETITAN INTEGRATION
   ================================================================ */
function Slide15() {
  const benefits = [
    { emoji: "📋", title: "Job Management", color: "#1e3a5f", text: "Every lead, booking, and job tracked in one place. Dispatch, scheduling, and technician management. Real-time job status visible to the whole team. Integrates directly with our booking system." },
    { emoji: "\ud83d\udcb0", title: "Revenue Tracking", color: "#ff6b35", text: "Every invoice, payment, and job value tracked. Stripe payments sync with ServiceTitan records. Know your revenue, margins, and top technicians at any moment. Essential for scaling to 8 figures." },
    { emoji: "\ud83d\udcca", title: "Performance Analytics", color: "#7c3aed", text: "Track close rates, average job value, lead sources. Know which marketing channels drive most revenue. Identify top performers and underperforming areas. Data-driven decisions at every level." },
    { emoji: "\ud83d\udd17", title: "Platform Integration", color: "#059669", text: "ServiceTitan + Jessica AI + Stripe + our website = fully automated lead-to-payment pipeline. Customer books → ServiceTitan creates job → Tech dispatched → Invoice sent → Payment collected. Zero manual data entry." },
  ];

  return (
    <Slide>
      <SH sub="">ServiceTitan — The Operating System for Scale</SH>
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
   SLIDE 16 — CAPITAL STRATEGY
   ================================================================ */
function Slide16() {
  const cards = [
    { emoji: "✅", title: "PSE&G Instant Rebate", color: "#059669", text: "Rebate applied directly on invoice at installation. Customer pays net amount. PSE&G reimburses us through distributor same day. This IS our job financing — built into the program." },
    { emoji: "🏦", title: "Supplier Credit Lines Active", color: "#2563eb", text: "Ferguson HVAC + Johnstone Supply net-30/60 terms already established. Materials ordered today, paid after job completion. Zero cash out of pocket." },
    { emoji: "💳", title: "Acorn Finance — Customer Option", color: "#7c3aed", text: "Customers who need financing apply through Acorn Finance. We get paid in 48 hours. Free to set up. Increases close rates. Works alongside PSE&G rebate." },
    { emoji: "🏢", title: "Commercial — PSE&G Covers 80%", color: "#ff6b35", text: "Engineered Solutions Program funds up to 80% of commercial HVAC projects. PSE&G releases funds during construction. Customer pays 0% over 60 months." },
  ];

  return (
    <Slide>
      <SH sub="">No Dilution. No Debt. Self-Funded Growth.</SH>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, marginBottom: 28 }}>
        {cards.map(c => (
          <div key={c.title} style={{
            background: "#fff", borderRadius: 12, padding: 20,
            border: "1px solid #e2e8f0", borderLeft: `5px solid ${c.color}`,
          }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{c.emoji}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: c.color, marginBottom: 8 }}>{c.title}</div>
            <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.6 }}>{c.text}</p>
          </div>
        ))}
      </div>
      <div style={{
        background: "#fff7ed", border: "2px solid #ff6b35", borderRadius: 12,
        padding: "20px 24px",
      }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#1e3a5f", margin: "0 0 12px 0" }}>
          The #1 constraint is not money — it is hiring speed and marketing execution. PSE&G funds residential jobs through instant rebates. PSE&G funds commercial jobs up to 80%. We need installers and leads — in that order.
        </p>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#ff6b35", margin: 0 }}>
          Action: Begin hiring immediately. Every week without a technician = $15,000-$25,000 in unbilled capacity.
        </p>
      </div>
      <div style={{
        marginTop: 16, background: "#eff6ff", border: "2px solid #bfdbfe", borderRadius: 12,
        padding: "16px 20px",
      }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#1e3a5f", margin: 0 }}>
          {"💡"} Cost to hire 1 installer: ~$65,000/year. Revenue generated: $350,000/year. Net return per hire: <span style={{ color: "#059669" }}>$285,000</span>. Every month without a new installer = <span style={{ color: "#dc2626" }}>$29,166 in lost revenue</span>.
        </p>
      </div>
    </Slide>
  );
}

/* ================================================================
   SLIDE 17 — PROJECT FINANCING STRATEGY
   ================================================================ */
function Slide17() {
  const fLayer = (emoji: string, title: string, sub: string, color: string, items: string[], note?: string) => (
    <div style={{ background: "#fff", borderRadius: 10, padding: "14px 12px", border: `2px solid ${color}`, borderTop: `4px solid ${color}` }}>
      <div style={{ fontSize: 22, marginBottom: 2 }}>{emoji}</div>
      <div style={{ fontWeight: 800, fontSize: 11, color, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 9, color: "#64748b", marginBottom: 6 }}>{sub}</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((t, i) => (
          <li key={i} style={{ fontSize: 9, color: "#334155", marginBottom: 2, paddingLeft: 9, position: "relative" }}>
            <span style={{ position: "absolute", left: 0, color }}>{"•"}</span>{t}
          </li>
        ))}
      </ul>
      {note && <div style={{ fontSize: 9, color: "#64748b", marginTop: 4 }}>{note}</div>}
    </div>
  );

  const stepList = (title: string, steps: string[]) => (
    <div>
      <h3 style={{ fontSize: 12, fontWeight: 700, color: "#1e3a5f", marginBottom: 8 }}>{title}</h3>
      {steps.map((t, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "flex-start" }}>
          <div style={{ minWidth: 18, height: 18, borderRadius: "50%", background: i === steps.length - 1 ? "#059669" : "#ff6b35", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 9, flexShrink: 0 }}>{i + 1}</div>
          <p style={{ fontSize: 9, color: "#334155", margin: 0, paddingTop: 2, fontWeight: i === steps.length - 1 ? 800 : 400 }}>{t}</p>
        </div>
      ))}
    </div>
  );

  return (
    <Slide>
      <SH sub="">How Every Job Gets Paid — Zero Cash Upfront</SH>

      {/* 4-Layer Stack */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        {fLayer("🌱", "PSE&G Instant Rebate — Built-in Financing", "Rebate applied at installation on invoice", "#059669", [
          "Customer pays NET amount after rebate",
          "PSE&G reimburses contractor through distributor same day",
          "No deposit needed — rebate covers the gap",
          "Residential: up to $18,000 instant",
          "This IS the financing for PSE&G jobs ✅",
        ])}
        {fLayer("🏦", "Supplier Credit Lines — Already Active", "Materials on net-30/60 terms", "#2563eb", [
          "Ferguson HVAC + Johnstone Supply",
          "Net-30/60 terms already established ✅",
          "Materials ordered → paid after job completion",
          "Covers full material cost on every job",
        ])}
        {fLayer("💳", "Acorn Finance — Customer Financing", "Customer gets loan, you get paid in 48hrs", "#ff6b35", [
          "Offer to customers who need to finance their share",
          "Customer approved in minutes",
          "You get paid in 48 hours",
          "Free to set up — no monthly fees",
          "Works alongside PSE&G rebate",
        ], "acornfinance.com")}
        {fLayer("🏢", "PSE&G Engineered Solutions — Commercial", "PSE&G funds up to 80% of commercial jobs", "#1e3a5f", [
          "PSE&G FUNDS UP TO 80% OF COMMERCIAL JOBS",
          "Free audit, free design documents",
          "PSE&G releases funds during construction",
          "Customer pays 0% over 60 months",
          "Zero financing needed from you",
        ])}
      </div>

      {/* Two payment flows side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {stepList("How a Residential PSE&G Job Gets Paid:", [
          "Win PSE&G Clean Heat job ($40K-$50K)",
          "Order materials on supplier credit (net-30)",
          "Complete installation (3-4 days)",
          "Apply $10K-$18K instant rebate on invoice",
          "Customer pays net balance at completion",
          "PSE&G reimburses you through distributor same day",
          "Pay supplier from proceeds (net-30 not yet due)",
          "NET PROFIT: $8K-$15K — zero cash invested",
        ])}
        {stepList("How a Commercial Engineered Solutions Job Works:", [
          "Identify commercial building (school, hospital, multifamily)",
          "Contact PSE&G — they do free energy audit",
          "PSE&G produces bid-ready design documents",
          "You win installation contract",
          "PSE&G releases funds during construction milestones",
          "PSE&G covers up to 80% of project cost",
          "Customer pays remaining 20% at 0% over 60 months",
          "You get paid by PSE&G throughout construction",
        ])}
      </div>

      {/* Bottom box */}
      <div style={{
        background: "#fff7ed", border: "2px solid #ff6b35", borderRadius: 10,
        padding: "12px 16px", textAlign: "center",
      }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", margin: 0, lineHeight: 1.6 }}>
          We don't need outside financing. <span style={{ color: "#ff6b35" }}>PSE&G IS the financing</span> — on both residential and commercial jobs.<br />
          Residential: instant rebate at install. Commercial: PSE&G funds up to 80% of the project.
        </p>
      </div>
    </Slide>
  );
}

/* ================================================================
   SLIDE 18 — ACTIVE PIPELINE
   ================================================================ */
function Slide18() {
  const contracts = [
    {
      border: "#ff6b35",
      badge: "✅ PSE&G CLEAN HEAT — COMPLETED",
      badgeBg: "#059669",
      project: "Modern Building Group — 18 Whitman St, West Orange NJ",
      client: "Modern Building Group LLC / Fair Lawn NJ",
      type: "PSE&G Clean Heat Decarbonization",
      value: "$39,950",
      date: "Original: $12,218 → Updated: $39,950",
      lines: [
        "Program: PSE&G Clean Heat (PN#136)",
        "PSE&G Rebate: $16,000",
        "Full heat pump installation, re-ducting",
        "Decommissioning — 2 zones",
      ],
    },
    {
      border: "#059669",
      badge: "✅ RESIDENTIAL PSE&G — COMPLETED",
      badgeBg: "#2563eb",
      project: "Ufredo Molina — 175 Sunset Ave, North Arlington NJ",
      client: "Residential Homeowner",
      type: "PSE&G Heat Pump + Electrical + Water Heater",
      value: "$49,036",
      date: "February 27, 2026",
      lines: [
        "PSE&G Rebate: Up to $18,000 (LMI) / $16,000 (Non-LMI)",
        "OBR Financing: 0% for 84-120 months available",
        "2 heat pump systems + panel upgrade",
        "Tankless water heater",
      ],
    },
  ];

  return (
    <Slide>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#1e3a5f", margin: 0 }}>Real Contracts. Real Revenue. Right Now.</h1>
        <p style={{ fontSize: 16, color: "#64748b", marginTop: 8 }}>Recent PSE&G Project Examples — Our Track Record</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, marginBottom: 24 }}>
        {contracts.map(c => (
          <div key={c.project} style={{
            background: "#fff", borderRadius: 12, padding: "18px 16px",
            border: `2px solid ${c.border}`, display: "flex", flexDirection: "column",
          }}>
            <div style={{
              display: "inline-block", background: c.badgeBg, color: "#fff",
              borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 800,
              marginBottom: 10, alignSelf: "flex-start", letterSpacing: 0.5,
            }}>{c.badge}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", marginBottom: 4 }}>{c.project}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{c.client}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{c.type}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: c.border, marginBottom: 4 }}>{c.value}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>{c.date}</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {c.lines.map((l, i) => (
                <li key={i} style={{ fontSize: 11, color: "#475569", marginBottom: 3, paddingLeft: 12, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: c.border }}>&#8226;</span>{l}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Totals table */}
      <SimpleTable compact headers={["Contract", "Value"]} rows={[
        ["Modern Building Group (PSE&G Clean Heat)", "$39,950"],
        ["Ufredo Molina (PSE&G Residential)", "$49,036"],
        ["CONFIRMED PIPELINE TOTAL", "$88,986"],
      ]} />

      {/* Insight box */}
      <div style={{
        marginTop: 16, background: "#fff7ed", border: "2px solid #ff6b35", borderRadius: 12,
        padding: "14px 18px",
      }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", margin: 0, lineHeight: 1.6 }}>
          {"💡"} These completed projects demonstrate our PSE&G Clean Heat execution capability. As approved Trade Ally PN#136, we replicate this model at scale — every NJ gas customer is a prospect.
        </p>
      </div>

      {/* PSE&G box */}
      <div style={{
        marginTop: 12, background: "#f0fdf4", border: "2px solid #059669", borderRadius: 12,
        padding: "14px 18px",
      }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#166534", margin: 0, lineHeight: 1.6 }}>
          {"🌱"} <strong>PSE&G CLEAN HEAT ADVANTAGE:</strong> We are an approved PSE&G Trade Ally. Every residential gas customer in NJ is a potential PSE&G decarbonization job. PSE&G covers up to $18,000 in rebates (LMI with adders). 0% OBR financing available for customers. We handle all paperwork and program enrollment.
        </p>
      </div>
    </Slide>
  );
}

/* ================================================================
   SLIDE 19 — 5-YEAR PATH
   ================================================================ */
function Slide19() {
  const years = [
    { year: "2026", label: "4 NOW → 8 BY Q4", color: "#ff6b35", revenue: "$1.4M-$2.8M", highlight: "⚡ 4 INSTALLERS NOW → 8 BY Q4", milestones: [
      "4 installers operating — $1.4M baseline", "PSE&G Clean Heat — instant rebate model",
      "3 blogs/week — SEO compounding", "No Catch social campaign launched",
      "Target: 8 installers by Q4 2026", "50 Google reviews — map pack top 3",
    ], foundation: "PSE&G funds jobs, suppliers cover materials, hire + market" },
    { year: "2027", label: "DOMINATE LOCAL MARKET", color: "#2563eb", revenue: "$4.2M-$6M", highlight: "", milestones: [
      "12 installers × $350K = $4.2M", "Engineered Solutions — first school/hospital job",
      "SEO generating 50+ organic leads/month", "Map pack top 3 → 40+ leads/week",
      "200+ SEO pages (Central NJ, Shore)", "Carrier/Trane/Lennox preferred dealer",
      "Maintenance subscription: 500+ members", "Partnership network: 50+ referrers",
    ], foundation: "Brand authority established, recurring revenue streams active" },
    { year: "2028", label: "EXPAND GEOGRAPHY", color: "#7c3aed", revenue: "$7M-$10M", highlight: "", milestones: [
      "20-25 installers × $350K = $7M-$8.75M", "2nd service hub Central NJ",
      "Government contracts (WMBE advantage)", "Commercial VRV/VRF: 2-3 jobs/month",
      "Shore area HVAC market penetration", "1,000+ Google reviews",
    ], foundation: "Multi-location operations, government contract pipeline" },
    { year: "2029", label: "VERTICAL INTEGRATION", color: "#059669", revenue: "$10.5M-$14M", highlight: "", milestones: [
      "30-40 installers × $350K = $10.5M-$14M", "Franchise model launched",
      "Equipment distribution revenue", "Courses: national reach",
      "Training center physical location", "Acquire 1-2 smaller NJ HVAC companies",
    ], foundation: "Beyond service — becoming an HVAC ecosystem company" },
    { year: "2030", label: "$17.5M+ REVENUE", color: "#dc2626", revenue: "$17.5M-$25M+", highlight: "", milestones: [
      "50+ installers × $350K = $17.5M+", "Multiple revenue streams additive",
      "3-5 franchise locations", "EBITDA margin: 15-20%",
      "Acquisition target or PE interest", 'Brand: "The NJ Heat Pump Company"',
    ], foundation: "Multiple revenue streams, defensible market position, acquisition-ready" },
  ];

  const reasons = [
    { emoji: "🏗️", title: "Infrastructure Already Built", text: "Most companies spend years building what we built in 30 days. We start at year 3 of most competitors' journey." },
    { emoji: "📈", title: "Market Tailwind", text: "Heat pump market growing 9.85% annually. NJ mandating electrification. Rebates creating urgency. We're in the right market at the right time." },
    { emoji: "🤖", title: "AI Advantage", text: "Jessica AI scales without headcount. Every new lead costs us less per unit. Competitors can't replicate this quickly." },
    { emoji: "📚", title: "Courses = Defensible Moat", text: "Industry training creates brand authority, recurring revenue, and a pipeline of certified technicians who know our systems." },
    { emoji: "🏆", title: "WMBE/SBE Certification", text: "Government contracts, diversity supplier programs, and preferred vendor status create revenue streams unavailable to most HVAC competitors." },
  ];

  return (
    <Slide bg="linear-gradient(135deg, #0f2744 0%, #1e3a5f 100%)">
      <div style={{ color: "#fff" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0 }}>From 1 Installer to 50 — The Path to $17.5M+</h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,.7)", marginTop: 8 }}>5-Year Path — Built on $350K Per Installer</p>
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
              {y.highlight && (
                <div style={{ background: "#ff6b35", borderRadius: 6, padding: "6px 8px", marginBottom: 8, textAlign: "center" }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: "#fff" }}>{y.highlight}</span>
                </div>
              )}
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
          <p style={{ fontSize: 15, fontWeight: 700, color: "#ff6b35", margin: "0 0 8px 0", lineHeight: 1.6 }}>
            The math is simple: Every installer we hire = $350,000 in annual revenue.<br />
            Hire fast. Train right. Scale the model.
          </p>
          <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,.8)", margin: 0 }}>
            2026 Goal: 4 installers now {"→"} 8 by Q4 = $1.4M-$2.8M revenue
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
const SLIDES = [Slide1, Slide2, Slide3, Slide4, Slide5, Slide6, Slide7, Slide8, Slide9, Slide10, Slide11, Slide12, Slide13, Slide14, Slide15, Slide16, Slide17, Slide18, Slide19];

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

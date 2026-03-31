import { useState } from "react";

const SLIDES_COUNT = 16;

const pw = "mechanicalenterprise2026";

export default function Presentation() {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [slide, setSlide] = useState(0);
  const [error, setError] = useState("");

  const check = () => {
    if (input === pw) { setUnlocked(true); setError(""); }
    else setError("Incorrect password");
  };

  if (!unlocked) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f8fafc", fontFamily:"'Inter',sans-serif" }}>
      <div style={{ background:"#fff", borderRadius:16, padding:48, boxShadow:"0 4px 32px rgba(0,0,0,0.10)", textAlign:"center", maxWidth:400, width:"90%" }}>
        <div style={{ fontSize:40, marginBottom:16 }}>🔒</div>
        <h2 style={{ color:"#1e3a5f", marginBottom:8, fontSize:22 }}>Partner Presentation</h2>
        <p style={{ color:"#666", marginBottom:24, fontSize:14 }}>Mechanical Enterprise LLC — Confidential</p>
        <input
          type="password"
          placeholder="Enter password"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && check()}
          style={{ width:"100%", padding:"12px 16px", borderRadius:8, border:"1px solid #ddd", fontSize:16, marginBottom:12, boxSizing:"border-box" }}
        />
        {error && <p style={{ color:"#e53e3e", fontSize:13, marginBottom:8 }}>{error}</p>}
        <button onClick={check} style={{ width:"100%", padding:"12px", background:"#e8602c", color:"#fff", border:"none", borderRadius:8, fontSize:16, fontWeight:700, cursor:"pointer" }}>
          Enter
        </button>
      </div>
    </div>
  );

  const nav = (dir: number) => setSlide(s => Math.max(0, Math.min(SLIDES_COUNT - 1, s + dir)));

  const slides = [s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15];

  return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"'Inter',sans-serif" }}>
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"24px 16px" }}>
        {/* Progress */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <span style={{ color:"#666", fontSize:13 }}>Slide {slide + 1} of {SLIDES_COUNT}</span>
          <div style={{ display:"flex", gap:4 }}>
            {Array.from({length: SLIDES_COUNT}).map((_, i) => (
              <div key={i} onClick={() => setSlide(i)} style={{ width:8, height:8, borderRadius:"50%", background: i === slide ? "#e8602c" : i < slide ? "#1e3a5f" : "#ddd", cursor:"pointer" }} />
            ))}
          </div>
          <span style={{ color:"#666", fontSize:13 }}>mechanicalenterprise.com</span>
        </div>

        {/* Slide */}
        <div style={{ background:"#fff", borderRadius:20, padding:"48px 48px", boxShadow:"0 4px 24px rgba(0,0,0,0.08)", minHeight:600 }}>
          {slides[slide]()}
        </div>

        {/* Nav */}
        <div style={{ display:"flex", justifyContent:"center", gap:16, marginTop:24 }}>
          <button onClick={() => nav(-1)} disabled={slide === 0} style={{ padding:"12px 32px", borderRadius:8, border:"2px solid #1e3a5f", background:"#fff", color:"#1e3a5f", fontWeight:700, fontSize:15, cursor: slide === 0 ? "not-allowed" : "pointer", opacity: slide === 0 ? 0.4 : 1 }}>
            Previous
          </button>
          <button onClick={() => nav(1)} disabled={slide === SLIDES_COUNT - 1} style={{ padding:"12px 32px", borderRadius:8, border:"none", background:"#e8602c", color:"#fff", fontWeight:700, fontSize:15, cursor: slide === SLIDES_COUNT - 1 ? "not-allowed" : "pointer", opacity: slide === SLIDES_COUNT - 1 ? 0.4 : 1 }}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

// ── COLORS ──────────────────────────────────────────
const C = { navy:"#1e3a5f", orange:"#e8602c", green:"#16a34a", red:"#dc2626", gray:"#64748b", light:"#f8fafc" };

// ── SHARED COMPONENTS ────────────────────────────────
const H1 = ({ children }: { children: React.ReactNode }) => <h1 style={{ fontSize:36, fontWeight:800, color:C.navy, textAlign:"center", marginBottom:8 }}>{children}</h1>;
const Sub = ({ children }: { children: React.ReactNode }) => <p style={{ fontSize:16, color:C.gray, textAlign:"center", marginBottom:32 }}>{children}</p>;
const Card = ({ children, border="#e2e8f0", bg="#fff" }: { children: React.ReactNode; border?: string; bg?: string }) => <div style={{ border:`2px solid ${border}`, borderRadius:12, padding:24, background:bg }}>{children}</div>;
const Orange = ({ children }: { children: React.ReactNode }) => <div style={{ background:C.orange, borderRadius:12, padding:"16px 24px", textAlign:"center", color:"#fff", fontWeight:700, fontSize:16, marginBottom:24 }}>{children}</div>;
const Row = ({ children }: { children: React.ReactNode }) => <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px,1fr))", gap:20, marginBottom:24 }}>{children}</div>;
const Stat = ({ value, label }: { value: string; label: string }) => <div style={{ textAlign:"center" }}><div style={{ fontSize:42, fontWeight:900, color:C.orange }}>{value}</div><div style={{ color:C.gray, fontSize:14, marginTop:4 }}>{label}</div></div>;
const Check = () => <span style={{ color:C.green, fontWeight:700 }}>Yes</span>;
const Cross = () => <span style={{ color:C.red, fontWeight:700 }}>No</span>;
const Warn = () => <span style={{ color:"#d97706", fontWeight:700 }}>Limited</span>;
const Tag = ({ children, color=C.orange }: { children: React.ReactNode; color?: string }) => <span style={{ background:color, color:"#fff", borderRadius:6, padding:"3px 10px", fontSize:12, fontWeight:700 }}>{children}</span>;

// ── TABLE ─────────────────────────────────────────────
const Table = ({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) => (
  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
    <thead>
      <tr style={{ background:C.navy }}>
        {headers.map((h,i) => <th key={i} style={{ padding:"10px 16px", color:"#fff", textAlign: i===0 ? "left" : "center", fontWeight:700 }}>{h}</th>)}
      </tr>
    </thead>
    <tbody>
      {rows.map((row,i) => (
        <tr key={i} style={{ background: i%2===0 ? "#f8fafc" : "#fff" }}>
          {row.map((cell,j) => <td key={j} style={{ padding:"10px 16px", textAlign: j===0 ? "left" : "center", borderBottom:"1px solid #e2e8f0", verticalAlign:"middle" }}>{cell}</td>)}
        </tr>
      ))}
    </tbody>
  </table>
);

// ══════════════════════════════════════════════════════
// SLIDE 0 — TITLE
// ══════════════════════════════════════════════════════
function s0() { return (
  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:500, textAlign:"center" }}>
    <div style={{ fontSize:56, marginBottom:16 }}>🔥</div>
    <h1 style={{ fontSize:48, fontWeight:900, color:C.navy, marginBottom:8 }}>Mechanical Enterprise LLC</h1>
    <h2 style={{ fontSize:24, fontWeight:600, color:C.orange, marginBottom:24 }}>Partner Presentation — March 2026</h2>
    <p style={{ fontSize:18, color:C.gray, maxWidth:600, lineHeight:1.6 }}>
      Newark, NJ's fastest-growing HVAC company.<br/>
      PSE&G Trade Ally PN#136 · WMBE/SBE Certified<br/>
      Serving 15 counties across New Jersey
    </p>
    <div style={{ display:"flex", gap:32, marginTop:40 }}>
      <Stat value="4" label="Active Installers" />
      <Stat value="$350K" label="Revenue Per Installer" />
      <Stat value="116" label="SEO Pages Live" />
      <Stat value="PN#136" label="PSE&G Trade Ally" />
    </div>
  </div>
);}

// ══════════════════════════════════════════════════════
// SLIDE 1 — MARKET OPPORTUNITY
// ══════════════════════════════════════════════════════
function s1() { return (
  <div>
    <H1>Why Heat Pumps — Why Now</H1>
    <Sub>NJ mandates electrification. PSE&G pays for it. We install it.</Sub>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:32, marginBottom:32 }}>
      <div>
        <h3 style={{ color:C.navy, fontWeight:700, marginBottom:16 }}>PSE&G Residential — Clean Heat PN#136</h3>
        <Table
          headers={["Program", "Amount"]}
          rows={[
            ["Gas to Heat Pump (Non-LMI, 50%)", "Up to $10,000"],
            ["Gas to Heat Pump (LMI, 60%)", "Up to $12,000"],
            ["Decommissioning adder", "Up to $2,000"],
            ["Re-ducting adder (Manual D)", "Up to $2,000"],
            ["Additional ccASHP unit", "$2,000 per unit"],
            ["OBR Financing (Non-LMI)", "0% / 84 months"],
            ["OBR Financing (LMI)", "0% / 120 months"],
            ["MAXIMUM (LMI + all adders)", "$18,000"],
          ]}
        />
        <p style={{ fontSize:12, color:C.gray, marginTop:8 }}>Instant rebate applied on invoice at installation. No tax on adders.</p>
      </div>
      <div>
        <h3 style={{ color:C.navy, fontWeight:700, marginBottom:16 }}>PSE&G Commercial — Engineered Solutions</h3>
        <Table
          headers={["Program", "Coverage"]}
          rows={[
            ["Energy audit", "Free to customer"],
            ["Bid-ready design documents", "Free to customer"],
            ["Project cost coverage", "Up to ~80%"],
            ["Customer repayment", "0% / 60 months"],
            ["Multifamily repayment", "0% / 120 months"],
          ]}
        />
        <p style={{ fontSize:12, color:C.gray, marginTop:8 }}>PSE&G buys down project payback by up to 6 years. Targets: schools, hospitals, multifamily, municipalities.</p>
        <div style={{ marginTop:16, padding:16, background:"#f0fdf4", borderRadius:8, border:"1px solid #86efac" }}>
          <p style={{ color:C.green, fontWeight:700, fontSize:14, margin:0 }}>PSE&G funds construction milestones directly. Customer pays 0% over 60 months. We get paid throughout construction.</p>
        </div>
      </div>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
      <Stat value="$3.57B" label="North American heat pump market 2026" />
      <Stat value="9.85%" label="CAGR growth through 2034" />
      <Stat value="13M" label="US homes that would save switching" />
    </div>
  </div>
);}

// ══════════════════════════════════════════════════════
// SLIDE 2 — COMPETITIVE POSITION
// ══════════════════════════════════════════════════════
function s2() { return (
  <div>
    <H1>Our Position vs The Competition</H1>
    <Sub>Enterprise-level infrastructure. Boutique-level execution.</Sub>
    <Table
      headers={["Feature", "Mechanical Enterprise", "AJ Perri", "Gold Medal", "Horizon/Hutchinson"]}
      rows={[
        ["PSE&G Rebate Specialization", <Check/>, <Warn/>, <Warn/>, <Cross/>],
        ["AI Chat Assistant 24/7", <Check/>, <Cross/>, <Cross/>, <Cross/>],
        ["Online Booking + Payment", <Check/>, <Cross/>, <Cross/>, <Cross/>],
        ["116 SEO Landing Pages", <Check/>, <Warn/>, <Warn/>, <Cross/>],
        ["WMBE/SBE Certified", <Check/>, <Cross/>, <Cross/>, <Cross/>],
        ["Course Platform (LMS)", <Check/>, <Cross/>, <Cross/>, <Cross/>],
        ["Booking Automation", <Check/>, <Cross/>, <Cross/>, <Cross/>],
      ]}
    />
    <div style={{ marginTop:24, padding:16, background:"#eff6ff", borderRadius:8, border:"1px solid #93c5fd", textAlign:"center" }}>
      <p style={{ color:C.navy, fontWeight:700, margin:0 }}>"We have enterprise-level digital infrastructure that competitors 10x our size don't have."</p>
    </div>
  </div>
);}

// ══════════════════════════════════════════════════════
// SLIDE 3 — DIGITAL PLATFORM
// ══════════════════════════════════════════════════════
function s3() { return (
  <div>
    <H1>Complete Digital Platform</H1>
    <Sub>Built in 30 days. Most competitors don't have this after 10 years.</Sub>
    <Row>
      <Card border={C.orange}>
        <div style={{ fontSize:28, marginBottom:8 }}>🤖</div>
        <h3 style={{ color:C.orange, fontWeight:700, marginBottom:8 }}>Jessica AI Assistant</h3>
        <p style={{ color:C.gray, fontSize:14 }}>24/7 AI chat on every page. Qualifies leads, books assessments, answers PSE&G rebate questions instantly. Powered by Claude.</p>
      </Card>
      <Card border={C.navy}>
        <div style={{ fontSize:28, marginBottom:8 }}>💳</div>
        <h3 style={{ color:C.navy, fontWeight:700, marginBottom:8 }}>Stripe Payments Live</h3>
        <p style={{ color:C.gray, fontSize:14 }}>Residential $100/$175, Commercial $200/$275. Customers pay before appointment confirmed. Zero collection issues.</p>
      </Card>
      <Card border={C.green}>
        <div style={{ fontSize:28, marginBottom:8 }}>📚</div>
        <h3 style={{ color:C.green, fontWeight:700, marginBottom:8 }}>Course Platform (LMS)</h3>
        <p style={{ color:C.gray, fontSize:14 }}>Full learning management system for HVAC certification training. Creates recurring revenue and builds industry authority.</p>
      </Card>
    </Row>
    <Row>
      <Card border="#7c3aed">
        <div style={{ fontSize:28, marginBottom:8 }}>📊</div>
        <h3 style={{ color:"#7c3aed", fontWeight:700, marginBottom:8 }}>116 SEO Pages Live</h3>
        <p style={{ color:C.gray, fontSize:14 }}>49 city pages, 18 luxury area pages, 8 service pages, 4 competitor pages, blog system. All indexed by Google.</p>
      </Card>
      <Card border="#0891b2">
        <div style={{ fontSize:28, marginBottom:8 }}>🔧</div>
        <h3 style={{ color:"#0891b2", fontWeight:700, marginBottom:8 }}>ServiceTitan Integration</h3>
        <p style={{ color:C.gray, fontSize:14 }}>Full CRM, dispatch, invoicing, and reporting. Connected to Johnstone Supply for instant material ordering.</p>
      </Card>
      <Card border={C.orange}>
        <div style={{ fontSize:28, marginBottom:8 }}>📍</div>
        <h3 style={{ color:C.orange, fontWeight:700, marginBottom:8 }}>Google Business Optimized</h3>
        <p style={{ color:C.gray, fontSize:14 }}>15 NJ counties service area, 5.0 stars, PSE&G rebate keywords. Sitemap submitted to Search Console.</p>
      </Card>
    </Row>
  </div>
);}

// ══════════════════════════════════════════════════════
// SLIDE 4 — REVENUE MODEL
// ══════════════════════════════════════════════════════
function s4() { return (
  <div>
    <H1>Revenue Model — $350K Per Installer Per Year</H1>
    <Sub>Simple. Scalable. Proven.</Sub>
    <Table
      headers={["Year", "Installers", "Installer Revenue", "Monthly Run Rate"]}
      rows={[
        ["2026 (now)", "4 → 8", "$1.4M → $2.8M", "$116K → $233K"],
        ["2027", "12", "$4,200,000", "$350,000"],
        ["2028", "20", "$7,000,000", "$583,333"],
        ["2029", "30", "$10,500,000", "$875,000"],
        ["2030", "50+", "$17,500,000+", "$1,458,333+"],
      ]}
    />
    <p style={{ fontSize:12, color:C.gray, margin:"8px 0 24px", fontStyle:"italic" }}>Based on $350K per installer per year. Does NOT include commercial Engineered Solutions, courses revenue, or maintenance subscriptions.</p>
    <Orange>2026 TARGET: $1.4M-$2.8M — 4 INSTALLERS NOW, TARGETING 8 BY Q4</Orange>
    <Row>
      <Card border={C.green} bg="#f0fdf4">
        <h4 style={{ color:C.green, fontWeight:700, marginBottom:8 }}>Conservative</h4>
        <p style={{ fontSize:13, color:C.gray, marginBottom:8 }}>4 installers × $350K + confirmed PSE&G contracts</p>
        <p style={{ fontSize:22, fontWeight:800, color:C.green }}>2026 Total: $1.4M-$1.5M</p>
      </Card>
      <Card border={C.navy} bg="#eff6ff">
        <h4 style={{ color:C.navy, fontWeight:700, marginBottom:8 }}>Moderate</h4>
        <p style={{ fontSize:13, color:C.gray, marginBottom:8 }}>6 installers × $350K + growing PSE&G pipeline</p>
        <p style={{ fontSize:22, fontWeight:800, color:C.navy }}>2026 Total: $2M+</p>
      </Card>
      <Card border={C.orange} bg="#fff7ed">
        <h4 style={{ color:C.orange, fontWeight:700, marginBottom:8 }}>Aggressive (Target)</h4>
        <p style={{ fontSize:13, color:C.gray, marginBottom:8 }}>8 installers × $350K + commercial Engineered Solutions</p>
        <p style={{ fontSize:22, fontWeight:800, color:C.orange }}>2026 Total: $2.8M+</p>
      </Card>
    </Row>
    <div style={{ background:"#fff7ed", border:`1px solid ${C.orange}`, borderRadius:8, padding:12, textAlign:"center" }}>
      <p style={{ color:C.orange, fontWeight:700, margin:0 }}>1 new installer hired = $350K added to top line. Hiring is the highest ROI investment we can make.</p>
    </div>
  </div>
);}

// ══════════════════════════════════════════════════════
// SLIDE 5 — COMPLETED PROJECTS
// ══════════════════════════════════════════════════════
function s5() { return (
  <div>
    <H1>Completed PSE&G Projects — Our Track Record</H1>
    <Sub>Real jobs. Real rebates. Real execution.</Sub>
    <Row>
      <Card border={C.orange}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
          <Tag>PSE&G CLEAN HEAT — COMPLETED</Tag>
        </div>
        <h3 style={{ color:C.navy, fontWeight:700, marginBottom:4 }}>Modern Building Group</h3>
        <p style={{ color:C.gray, fontSize:13, marginBottom:12 }}>18 Whitman St, West Orange NJ — PSE&G Clean Heat Decarbonization</p>
        <div style={{ fontSize:32, fontWeight:900, color:C.orange, marginBottom:12 }}>$39,950</div>
        <ul style={{ color:C.gray, fontSize:13, paddingLeft:16, margin:0 }}>
          <li>Program: PSE&G Clean Heat (PN#136)</li>
          <li>PSE&G Rebate: $16,000</li>
          <li>Full heat pump installation + re-ducting</li>
          <li>Decommissioning — 2 zones</li>
          <li>Original contract $12,218 → grew to $39,950</li>
        </ul>
      </Card>
      <Card border={C.green}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
          <Tag color={C.green}>RESIDENTIAL PSE&G — COMPLETED</Tag>
        </div>
        <h3 style={{ color:C.navy, fontWeight:700, marginBottom:4 }}>Ufredo Molina</h3>
        <p style={{ color:C.gray, fontSize:13, marginBottom:12 }}>175 Sunset Ave, North Arlington NJ — PSE&G Heat Pump + Electrical + Water Heater</p>
        <div style={{ fontSize:32, fontWeight:900, color:C.green, marginBottom:12 }}>$49,036</div>
        <ul style={{ color:C.gray, fontSize:13, paddingLeft:16, margin:0 }}>
          <li>PSE&G Rebate: Up to $18,000 (LMI) / $16,000 (Non-LMI)</li>
          <li>OBR Financing: 0% for 84-120 months</li>
          <li>2 heat pump systems + panel upgrade</li>
          <li>Tankless water heater</li>
        </ul>
      </Card>
    </Row>
    <Table
      headers={["Contract", "Value", "PSE&G Rebate", "Status"]}
      rows={[
        ["Modern Building Group (PSE&G Clean Heat)", "$39,950", "$16,000", "Completed"],
        ["Ufredo Molina (PSE&G Residential)", "$49,036", "Up to $18,000", "Completed"],
        ["Confirmed Total", "$88,986", "$34,000+", ""],
        ["Promised Pipeline", "$1,500,000", "Growing", "In Progress"],
      ]}
    />
    <div style={{ marginTop:16, padding:12, background:"#f0fdf4", border:"1px solid #86efac", borderRadius:8, textAlign:"center" }}>
      <p style={{ color:C.green, fontWeight:700, margin:0 }}>Both completed jobs are PSE&G Clean Heat program jobs (PN#136). As approved Trade Ally, every NJ gas customer is a potential project.</p>
    </div>
  </div>
);}

// ══════════════════════════════════════════════════════
// SLIDE 6 — HOW WE GET LEADS NOW
// ══════════════════════════════════════════════════════
function s6() { return (
  <div>
    <H1>How We Get Leads — Starting This Week</H1>
    <Sub>No budget needed for the first 50 leads. We start today.</Sub>
    <div style={{ background:"#fff7ed", border:`2px solid ${C.orange}`, borderRadius:12, padding:20, marginBottom:24 }}>
      <h3 style={{ color:C.orange, fontWeight:800, marginBottom:4 }}>IMMEDIATE ACTIONS — This Week</h3>
    </div>
    <Row>
      <Card border={C.green}>
        <Tag color={C.green}>TODAY — $0</Tag>
        <h4 style={{ color:C.navy, fontWeight:700, margin:"8px 0" }}>Text Past Customers</h4>
        <p style={{ fontSize:13, color:C.gray }}>Message: "PSE&G is offering up to $18,000 to replace gas furnaces — no catch, no upfront cost. Want a free assessment?" Send to 20 contacts. Expected: 2-5 leads.</p>
      </Card>
      <Card border={C.navy}>
        <Tag color={C.navy}>THIS WEEK — $0</Tag>
        <h4 style={{ color:C.navy, fontWeight:700, margin:"8px 0" }}>Google Business + Nextdoor</h4>
        <p style={{ fontSize:13, color:C.gray }}>Post before/after photos from completed jobs daily. Post in every NJ neighborhood Facebook group. Request reviews from completed clients. Expected: 3-8 leads/week.</p>
      </Card>
      <Card border={C.orange}>
        <Tag>THIS WEEK — $300</Tag>
        <h4 style={{ color:C.navy, fontWeight:700, margin:"8px 0" }}>Boost Facebook Post $10/day</h4>
        <p style={{ fontSize:13, color:C.gray }}>Take best organic post, target NJ homeowners 35-65 within 20 miles of Newark. No Catch messaging. Expected: 5-10 leads first week.</p>
      </Card>
    </Row>
    <Row>
      <Card border="#7c3aed">
        <Tag color="#7c3aed">THIS WEEK — $0</Tag>
        <h4 style={{ color:C.navy, fontWeight:700, margin:"8px 0" }}>Call 10 Real Estate Agents</h4>
        <p style={{ fontSize:13, color:C.gray }}>Script: "We're PSE&G approved. We offer buyers $18,000 in rebates. Be our preferred HVAC contractor?" Expected: 1-2 referrals/week within 60 days.</p>
      </Card>
      <Card border="#0891b2">
        <Tag color="#0891b2">WEEK 2 — $1,500/mo</Tag>
        <h4 style={{ color:C.navy, fontWeight:700, margin:"8px 0" }}>Google Ads — PSE&G Keywords</h4>
        <p style={{ fontSize:13, color:C.gray }}>Target: "PSE&G heat pump rebate", "replace gas furnace NJ", "$18000 heat pump rebate NJ". Ad: "NJ Pays Up to $18,000 — See If You Qualify". Expected: 8-12 leads/week.</p>
      </Card>
      <Card border={C.green}>
        <Tag color={C.green}>ONGOING — $1,000/mo</Tag>
        <h4 style={{ color:C.navy, fontWeight:700, margin:"8px 0" }}>Facebook/Instagram Ads</h4>
        <p style={{ fontSize:13, color:C.gray }}>Target NJ homeowners, rebate angle. Video: "We replaced this family's furnace for $0 out of pocket." Expected: 15-20 leads/week when running.</p>
      </Card>
    </Row>
    <Table
      headers={["Week", "Leads Expected", "Cost"]}
      rows={[
        ["Week 1 (texts + Nextdoor + GBP)", "5-15", "$0"],
        ["Week 2 (+ Facebook boost)", "10-20", "$300"],
        ["Week 3 (+ referral network)", "15-25", "$300"],
        ["Week 4 (+ Google Ads)", "20-35", "$1,800"],
        ["Month 2 (fully ramped)", "30-50/week", "$2,500/mo"],
      ]}
    />
    <div style={{ marginTop:16, padding:12, background:"#fff7ed", border:`1px solid ${C.orange}`, borderRadius:8, textAlign:"center" }}>
      <p style={{ color:C.orange, fontWeight:700, margin:0 }}>At 25% close rate on 30 leads/week = 7-8 installs/week. More than 4 installers can handle. Start marketing before hiring more.</p>
    </div>
  </div>
);}

// ══════════════════════════════════════════════════════
// SLIDE 7 — NO CATCH CAMPAIGN
// ══════════════════════════════════════════════════════
function s7() { return (
  <div>
    <H1>Social Media — The No Catch Campaign</H1>
    <Sub>Most NJ homeowners don't know they can get $18,000 to replace their furnace. We're going to tell them.</Sub>
    <div style={{ background:C.navy, borderRadius:12, padding:24, marginBottom:24, textAlign:"center" }}>
      <h2 style={{ color:"#fff", fontWeight:900, fontSize:24, marginBottom:8 }}>THE MESSAGE</h2>
      <p style={{ color:"#fff", fontSize:20, fontWeight:700, marginBottom:8 }}>PSE&G will pay up to $18,000 to replace your gas furnace with a heat pump.</p>
      <p style={{ color:C.orange, fontSize:18, fontWeight:800 }}>No catch. No trip. No gimmick. Just say yes — we do the rest.</p>
    </div>
    <Row>
      <Card border={C.navy}>
        <h4 style={{ color:C.navy, fontWeight:700, marginBottom:8 }}>Ad 1 — No Catch</h4>
        <p style={{ fontSize:13, color:C.gray, fontStyle:"italic", marginBottom:8 }}>"PSE&G Is Paying Up to $18,000 to Replace Your Furnace. No catch. No trip. No salesperson. Just a free assessment and we handle all the paperwork."</p>
        <p style={{ fontSize:12, color:C.orange, fontWeight:700 }}>CTA: See If You Qualify</p>
      </Card>
      <Card border={C.orange}>
        <h4 style={{ color:C.orange, fontWeight:700, marginBottom:8 }}>Ad 2 — Do The Math</h4>
        <p style={{ fontSize:13, color:C.gray, fontStyle:"italic", marginBottom:8 }}>"Your gas bill this winter: $300+. Your heat pump bill: $80. PSE&G pays up to $18,000 toward the switch. Monthly payment: as low as $0 with OBR financing."</p>
        <p style={{ fontSize:12, color:C.orange, fontWeight:700 }}>CTA: Get Free Assessment</p>
      </Card>
      <Card border={C.green}>
        <h4 style={{ color:C.green, fontWeight:700, marginBottom:8 }}>Ad 3 — Neighbors Did It</h4>
        <p style={{ fontSize:13, color:C.gray, fontStyle:"italic", marginBottom:8 }}>"West Orange family replaced their furnace for $0 out of pocket. PSE&G Clean Heat Program covers up to $18,000. We handled every form. They just said yes."</p>
        <p style={{ fontSize:12, color:C.orange, fontWeight:700 }}>CTA: You Could Qualify Too</p>
      </Card>
    </Row>
    <Table
      headers={["Platform", "Budget/mo", "Leads/week", "Content Type"]}
      rows={[
        ["Facebook/Instagram Ads", "$1,000", "15-20", "Video, carousel, static — rebate angle"],
        ["Google Search Ads", "$1,500", "8-12", "PSE&G rebate keywords"],
        ["TikTok/Reels (organic)", "$0", "3-5", "Job walkthroughs, rebate explainers"],
        ["Google Business Profile", "$0", "3-5", "Before/after photos, weekly posts"],
        ["Nextdoor + FB Groups", "$0", "3-8", "No Catch messaging"],
        ["TOTAL", "$2,500", "32-50", ""],
      ]}
    />
    <div style={{ marginTop:16, padding:12, background:"#fff7ed", border:`1px solid ${C.orange}`, borderRadius:8, textAlign:"center" }}>
      <p style={{ color:C.orange, fontWeight:700, margin:0 }}>$2,500/month in ads. At 25% close rate on 40 leads/week = 10 installs/week. Every $1 in ads returns $30+ in revenue.</p>
    </div>
  </div>
);}

// ══════════════════════════════════════════════════════
// SLIDE 8 — BLOG + SEO STRATEGY
// ══════════════════════════════════════════════════════
function s8() { return (
  <div>
    <H1>Content Strategy — 1 Blog Per Day</H1>
    <Sub>Every blog post is a 24/7 salesperson that never sleeps</Sub>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, marginBottom:24 }}>
      <div>
        <h3 style={{ color:C.navy, fontWeight:700, marginBottom:12 }}>SEO Impact Timeline (116 pages already live)</h3>
        <Table
          headers={["Timeframe", "Traffic", "Leads"]}
          rows={[
            ["Month 1-2", "Pages indexed, near zero", "0"],
            ["Month 3-4", "First rankings — 10-20/day", "1-2/week"],
            ["Month 6", "100-200 visits/day", "5-8/week"],
            ["Month 9", "400+ visits/day", "10-15/week"],
            ["Month 12", "1,000+ visits/day", "25-30/week"],
          ]}
        />
        <p style={{ fontSize:12, color:C.gray, marginTop:8, fontStyle:"italic" }}>WITHOUT any additional blogs. 1 blog/day ACCELERATES this 3x.</p>
      </div>
      <div>
        <h3 style={{ color:C.navy, fontWeight:700, marginBottom:12 }}>1 Blog/Day Compound Effect</h3>
        <Table
          headers={["Month", "Articles", "Visits/day", "Leads/mo"]}
          rows={[
            ["Month 1", "30 + 116", "50-80", "5-10"],
            ["Month 3", "90 + 116", "200-350", "20-40"],
            ["Month 6", "180 + 116", "600-900", "60-100"],
            ["Month 12", "365 + 116", "2,000+", "200+"],
          ]}
        />
        <div style={{ marginTop:12, padding:12, background:"#f0fdf4", borderRadius:8, border:"1px solid #86efac" }}>
          <p style={{ color:C.green, fontWeight:700, fontSize:13, margin:0 }}>200 organic leads/month × 25% close = 50 installs from SEO alone. At $29K avg = $1.45M/month from content.</p>
        </div>
      </div>
    </div>
    <h3 style={{ color:C.navy, fontWeight:700, marginBottom:12 }}>Sample Week — 7 Topics</h3>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:8, marginBottom:24 }}>
      {([
        ["Mon", "Does My NJ Home Qualify for the PSE&G $18,000 Rebate?"],
        ["Tue", "Gas Furnace vs Heat Pump NJ: Real Cost Comparison 2026"],
        ["Wed", "PSE&G Clean Heat: What Newark Homeowners Need to Know"],
        ["Thu", "Top Signs Your NJ Boiler Needs Replacement Now"],
        ["Fri", "West Orange HVAC: Complete Guide + PSE&G Rebates"],
        ["Sat", "PSE&G OBR: Pay $0 Upfront for Your Heat Pump"],
        ["Sun", "How NJ Commercial Buildings Get 80% HVAC Costs Covered"],
      ] as const).map(([day, topic]) => (
        <div key={day} style={{ background:"#f8fafc", borderRadius:8, padding:10, textAlign:"center" }}>
          <div style={{ color:C.orange, fontWeight:800, fontSize:12, marginBottom:4 }}>{day}</div>
          <div style={{ color:C.gray, fontSize:11, lineHeight:1.4 }}>{topic}</div>
        </div>
      ))}
    </div>
    <div style={{ padding:16, background:C.navy, borderRadius:8, textAlign:"center" }}>
      <p style={{ color:"#fff", fontWeight:700, margin:0 }}>116 existing pages + 365 new blogs/year = 481 pages working 24/7. Competitors post once a month. We post every day. This is how we own NJ HVAC search.</p>
    </div>
  </div>
);}

// ══════════════════════════════════════════════════════
// SLIDE 9 — HOW JOBS GET FINANCED
// ══════════════════════════════════════════════════════
function s9() { return (
  <div>
    <H1>How We Finance Jobs — PSE&G IS the Financing</H1>
    <Sub>No outside capital needed. The program pays for itself.</Sub>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:32, marginBottom:24 }}>
      <div>
        <h3 style={{ color:C.navy, fontWeight:700, marginBottom:16, textAlign:"center" }}>Residential PSE&G Job</h3>
        {([
          ["1", "Win PSE&G Clean Heat job ($40K-$50K)"],
          ["2", "Order materials on supplier credit (net-30)"],
          ["3", "Complete installation in 3-4 days"],
          ["4", "Apply $10K-$18K instant rebate on invoice"],
          ["5", "Customer pays net balance at completion"],
          ["6", "PSE&G reimburses us through distributor same day"],
          ["7", "Pay supplier from proceeds (net-30 not yet due)"],
          ["8", "Net profit: $8K-$15K — zero cash invested"],
        ] as const).map(([n, text]) => (
          <div key={n} style={{ display:"flex", gap:12, marginBottom:10, alignItems:"flex-start" }}>
            <div style={{ minWidth:28, height:28, borderRadius:"50%", background:C.orange, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:13 }}>{n}</div>
            <p style={{ color:C.gray, fontSize:14, margin:0, paddingTop:4 }}>{text}</p>
          </div>
        ))}
      </div>
      <div>
        <h3 style={{ color:C.navy, fontWeight:700, marginBottom:16, textAlign:"center" }}>Commercial Engineered Solutions Job</h3>
        {([
          ["1", "Identify commercial building (school, hospital, multifamily)"],
          ["2", "Contact PSE&G — they do free energy audit"],
          ["3", "PSE&G produces bid-ready design documents"],
          ["4", "You win the installation contract"],
          ["5", "PSE&G releases funds during construction milestones"],
          ["6", "PSE&G covers up to 80% of project cost"],
          ["7", "Customer pays remaining 20% at 0% over 60 months"],
          ["8", "You get paid by PSE&G throughout construction"],
        ] as const).map(([n, text]) => (
          <div key={n} style={{ display:"flex", gap:12, marginBottom:10, alignItems:"flex-start" }}>
            <div style={{ minWidth:28, height:28, borderRadius:"50%", background:C.navy, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:13 }}>{n}</div>
            <p style={{ color:C.gray, fontSize:14, margin:0, paddingTop:4 }}>{text}</p>
          </div>
        ))}
      </div>
    </div>
    <Row>
      <Card border={C.green} bg="#f0fdf4">
        <h4 style={{ color:C.green, fontWeight:700, marginBottom:8 }}>PSE&G Instant Rebate</h4>
        <p style={{ fontSize:13, color:C.gray }}>Applied directly on invoice at installation. PSE&G reimburses us same day through distributor. This IS our job financing — built into the program.</p>
      </Card>
      <Card border={C.navy} bg="#eff6ff">
        <h4 style={{ color:C.navy, fontWeight:700, marginBottom:8 }}>Supplier Credit Lines Active</h4>
        <p style={{ fontSize:13, color:C.gray }}>Ferguson HVAC + Johnstone Supply net-30/60 terms already established. Materials ordered today, paid after job completion.</p>
      </Card>
      <Card border={C.orange} bg="#fff7ed">
        <h4 style={{ color:C.orange, fontWeight:700, marginBottom:8 }}>Acorn Finance — Customer Option</h4>
        <p style={{ fontSize:13, color:C.gray }}>Customers who need to finance their share apply through Acorn. We get paid in 48 hours. Free to set up as contractor.</p>
      </Card>
    </Row>
    <div style={{ padding:16, background:C.navy, borderRadius:8, textAlign:"center" }}>
      <p style={{ color:"#fff", fontWeight:700, margin:0 }}>We don't need outside financing. PSE&G IS the financing — on both residential and commercial jobs. Residential: instant rebate at install. Commercial: PSE&G funds up to 80% of the project.</p>
    </div>
  </div>
);}

// ══════════════════════════════════════════════════════
// SLIDE 10 — CAPITAL STRATEGY
// ══════════════════════════════════════════════════════
function s10() { return (
  <div>
    <H1>Capital Strategy — Self-Funded Growth</H1>
    <Sub>No dilution. No debt. PSE&G funds the work.</Sub>
    <Row>
      <Card border={C.green} bg="#f0fdf4">
        <div style={{ fontSize:24, marginBottom:8 }}>✅</div>
        <h4 style={{ color:C.green, fontWeight:700, marginBottom:8 }}>PSE&G Trade Ally PN#136</h4>
        <p style={{ fontSize:13, color:C.gray }}>Approved since 2025. Every NJ gas heating customer qualifies. We handle all paperwork, rebate filing, and program enrollment. No upfront cash required.</p>
      </Card>
      <Card border={C.navy} bg="#eff6ff">
        <div style={{ fontSize:24, marginBottom:8 }}>🏦</div>
        <h4 style={{ color:C.navy, fontWeight:700, marginBottom:8 }}>Supplier Credit Lines</h4>
        <p style={{ fontSize:13, color:C.gray }}>Ferguson HVAC + Johnstone Supply credit already active. Materials on net-30/60. Pay after job payment received. Zero cash gap on materials.</p>
      </Card>
      <Card border="#7c3aed" bg="#faf5ff">
        <div style={{ fontSize:24, marginBottom:8 }}>💳</div>
        <h4 style={{ color:"#7c3aed", fontWeight:700, marginBottom:8 }}>Acorn Finance — Free</h4>
        <p style={{ fontSize:13, color:C.gray }}>Offer financing to customers at no cost. They apply, get approved, Acorn pays us in 48 hours. Increases close rates and removes price objection.</p>
      </Card>
      <Card border={C.orange} bg="#fff7ed">
        <div style={{ fontSize:24, marginBottom:8 }}>🏗️</div>
        <h4 style={{ color:C.orange, fontWeight:700, marginBottom:8 }}>Commercial — PSE&G Covers 80%</h4>
        <p style={{ fontSize:13, color:C.gray }}>Engineered Solutions Program funds up to 80% of commercial HVAC projects. PSE&G releases funds during construction milestones. No upfront capital needed.</p>
      </Card>
    </Row>
    <div style={{ background:"#fff7ed", border:`2px solid ${C.orange}`, borderRadius:12, padding:20, marginBottom:16 }}>
      <p style={{ color:C.navy, fontWeight:700, margin:0, fontSize:15 }}>The #1 constraint is not money — it is hiring speed and marketing execution. PSE&G funds residential jobs through instant rebates. PSE&G funds commercial jobs up to 80%. We need installers and leads — in that order.</p>
      <p style={{ color:C.orange, fontWeight:700, margin:"8px 0 0", fontSize:14 }}>Action: Begin hiring immediately. Every week without a new technician = $29,166 in lost revenue.</p>
    </div>
    <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:8, padding:12 }}>
      <p style={{ color:C.gray, fontSize:13, margin:0 }}>Cost to hire 1 installer: ~$65,000/year. Revenue generated: $350,000/year. Net return per hire: <strong style={{ color:C.green }}>$285,000</strong>. Every month we delay hiring = <strong style={{ color:C.orange }}>$29,166 in lost revenue</strong>.</p>
    </div>
  </div>
);}

// ══════════════════════════════════════════════════════
// SLIDE 11 — MARKETING PLAN
// ══════════════════════════════════════════════════════
function s11() { return (
  <div>
    <H1>How We Get to 3+ Installations Per Week</H1>
    <Sub>3 installs/week × $29K avg × 52 weeks = $4.5M/year from one team</Sub>
    <Orange>GOAL: 3 INSTALLS/WEEK = $87,500/MONTH = $1.05M/YEAR PER INSTALLER</Orange>
    <Table
      headers={["Channel", "Status", "Leads/week", "Cost/month", "Action"]}
      rows={[
        ["PSE&G Program (PN#136)", "✅ Active", "1-2", "$0", "Scale up"],
        ["SEO — 116 pages + blogs", "✅ Live", "0-5 (growing)", "$0", "1 blog/day"],
        ["Google Business Profile", "✅ Live", "0-3", "$0", "Daily posts"],
        ["Jessica AI Chat", "✅ Live", "0-2", "$0", "Optimizing"],
        ["Google Ads", "⏳ Needed", "8-12", "$1,500", "LAUNCH NOW"],
        ["Facebook/Instagram Ads", "⏳ Needed", "15-20", "$1,000", "LAUNCH NOW"],
        ["Referral Partners (RE agents)", "⏳ Needed", "2-4", "$0", "BUILD NOW"],
        ["Thumbtack/Angi", "⏳ Needed", "2-5", "$400", "ACTIVATE"],
        ["Nextdoor + FB Groups", "⏳ Needed", "3-8", "$0", "THIS WEEK"],
      ]}
    />
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginTop:20 }}>
      <div>
        <h4 style={{ color:C.navy, fontWeight:700, marginBottom:12 }}>Combined Projection at Full Scale</h4>
        <Table
          headers={["Channel", "Installs/week"]}
          rows={[
            ["Google Ads", "2-3"],
            ["Facebook Ads", "2-3"],
            ["PSE&G Referral Network", "1-2"],
            ["SEO Organic (month 6+)", "1-2"],
            ["Google Reviews/Maps", "1"],
            ["Total", "7-11/week"],
          ]}
        />
      </div>
      <div>
        <h4 style={{ color:C.navy, fontWeight:700, marginBottom:12 }}>Total Marketing Budget</h4>
        <Table
          headers={["Item", "Monthly"]}
          rows={[
            ["Google Ads", "$1,500"],
            ["Facebook/Instagram", "$1,000"],
            ["Thumbtack/Angi", "$400"],
            ["Referral fees", "~$300/install"],
            ["TOTAL AD SPEND", "$2,900/mo"],
            ["Revenue at 3 inst/wk", "$87,500/mo"],
            ["ROI on ad spend", "30:1"],
          ]}
        />
      </div>
    </div>
    <div style={{ marginTop:16, padding:12, background:"#fff7ed", border:`1px solid ${C.orange}`, borderRadius:8, textAlign:"center" }}>
      <p style={{ color:C.orange, fontWeight:700, margin:0 }}>$2,900/month in ads generates $87,500/month in revenue. Every $1 spent on ads returns $30 in revenue.</p>
    </div>
  </div>
);}

// ══════════════════════════════════════════════════════
// SLIDE 12 — 90-DAY ACTION PLAN
// ══════════════════════════════════════════════════════
function s12() { return (
  <div>
    <H1>90-Day Action Plan</H1>
    <Sub>Specific. Measurable. Starting this week.</Sub>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
      {[
        {
          month: "Month 1 — LAUNCH",
          color: C.orange,
          items: [
            "Launch Google Ads ($1,500/mo) — rebate keywords",
            "Launch Facebook Ads ($1,000/mo) — No Catch campaign",
            "Start 1 blog/day — PSE&G rebate topics",
            "Text all past customers — free assessment offer",
            "Post daily on Google Business Profile",
            "Create Thumbtack + Angi profiles",
            "Contact 10 real estate agents for referral partnership",
            "Hire 1 additional installer immediately",
            "Set up Acorn Finance contractor account",
          ]
        },
        {
          month: "Month 2 — SCALE",
          color: C.navy,
          items: [
            "25+ Google reviews — enter map pack",
            "Optimize Google Ads based on Month 1 data",
            "20 active referral partners",
            "90 blog posts live — organic traffic growing",
            "Hire 2nd additional installer at 6 installs/week",
            "ServiceTitan tracking all jobs and leads",
            "First TikTok/Reels — job walkthroughs",
            "Approach 3 commercial Engineered Solutions targets",
            "Submit first commercial PSE&G application",
          ]
        },
        {
          month: "Month 3 — HIT TARGET",
          color: C.green,
          items: [
            "3+ installs/week consistently",
            "50 Google reviews — map pack top 3",
            "6-8 installers working",
            "$87,500/month revenue run rate",
            "First commercial Engineered Solutions job won",
            "180 blog posts live — 200+ visits/day",
            "Expand to North NJ PSE&G territory",
            "Register DOL Apprenticeship Program",
            "Register on NJSTART for public works",
          ]
        }
      ].map(({ month, color, items }) => (
        <Card key={month} border={color}>
          <h3 style={{ color, fontWeight:800, marginBottom:12, fontSize:15 }}>{month}</h3>
          {items.map((item, i) => (
            <div key={i} style={{ display:"flex", gap:8, marginBottom:8, alignItems:"flex-start" }}>
              <span style={{ color, fontWeight:800, fontSize:14, minWidth:16 }}>□</span>
              <span style={{ fontSize:12, color:C.gray, lineHeight:1.4 }}>{item}</span>
            </div>
          ))}
        </Card>
      ))}
    </div>
  </div>
);}

// ══════════════════════════════════════════════════════
// SLIDE 13 — 5-YEAR ROADMAP
// ══════════════════════════════════════════════════════
function s13() { return (
  <div style={{ background:C.navy, borderRadius:16, padding:32, color:"#fff" }}>
    <h1 style={{ fontSize:32, fontWeight:900, textAlign:"center", marginBottom:8 }}>From 4 Installers to 50 — The Path to $17.5M+</h1>
    <p style={{ textAlign:"center", color:"rgba(255,255,255,0.7)", marginBottom:32 }}>5-Year Path — Built on $350K Per Installer</p>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:16 }}>
      {[
        { year:"2026", label:"EXECUTE", revenue:"$1.4M-$2.8M", color:"#e8602c", badge:"4 INSTALLERS NOW → 8 BY Q4",
          items:["4 installers operating — $1.4M baseline","PSE&G Clean Heat — instant rebate model","No Catch social campaign launched","1 blog/day — SEO compounding","Target: 8 installers by Q4 2026"] },
        { year:"2027", label:"DOMINATE LOCAL", revenue:"$4.2M-$6M", color:"#7c3aed",
          items:["12 installers × $350K = $4.2M","Commercial pipeline growing","First Engineered Solutions job","Map pack top 3 — 40+ leads/week","200+ SEO pages","Courses revenue starting"] },
        { year:"2028", label:"EXPAND NJ", revenue:"$7M-$10M", color:"#0891b2",
          items:["20-25 installers × $350K","2nd service hub Central NJ","Government contracts (WMBE advantage)","Commercial VRV/VRF: 2-3 jobs/month","Shore area market penetration"] },
        { year:"2029", label:"VERTICAL INTEGRATION", revenue:"$10.5M-$14M", color:"#16a34a",
          items:["30-40 installers","Franchise model launched","Equipment distribution revenue","Courses: national reach","Training center physical location"] },
        { year:"2030", label:"$17.5M+ REVENUE", revenue:"$17.5M-$25M+", color:"#dc2626",
          items:["50+ installers × $350K","Multiple revenue streams","3-5 franchise locations","EBITDA margin: 15-20%","Acquisition target or PE interest"] },
      ].map(({ year, label, revenue, color, badge, items }) => (
        <div key={year} style={{ background:"rgba(255,255,255,0.08)", borderRadius:12, padding:16, borderTop:`4px solid ${color}` }}>
          <div style={{ fontWeight:800, fontSize:16, color }}>{year}</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.6)", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>{label}</div>
          <div style={{ fontWeight:800, fontSize:18, color:"#fff", marginBottom:8 }}>{revenue}</div>
          {badge && <div style={{ background:color, borderRadius:6, padding:"4px 8px", fontSize:9, fontWeight:800, color:"#fff", textAlign:"center", marginBottom:8 }}>{badge}</div>}
          {items.map((item, i) => <div key={i} style={{ fontSize:11, color:"rgba(255,255,255,0.8)", marginBottom:4, lineHeight:1.4 }}>• {item}</div>)}
        </div>
      ))}
    </div>
  </div>
);}

// ══════════════════════════════════════════════════════
// SLIDE 14 — APPRENTICESHIP + PUBLIC WORKS
// ══════════════════════════════════════════════════════
function s14() { return (
  <div>
    <H1>Future Growth — Apprenticeship + Public Works</H1>
    <Sub>Two programs that unlock government contracts and reduce labor costs</Sub>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:32 }}>
      <div>
        <h3 style={{ color:C.navy, fontWeight:700, marginBottom:16 }}>DOL Apprenticeship Program</h3>
        <Table
          headers={["Benefit", "Value"]}
          rows={[
            ["Apprentice wage vs journeyman", "50-60% of journeyman rate"],
            ["NJ State pays tuition", "$0 training cost to us"],
            ["Federal WOTC tax credit", "$1,500-$3,000 per apprentice"],
            ["Savings vs journeyman/year", "$25,000-$35,000 per person"],
            ["Required for public works", "Jobs over $250K"],
          ]}
        />
        <div style={{ marginTop:12, padding:12, background:"#f0fdf4", borderRadius:8, border:"1px solid #86efac" }}>
          <p style={{ color:C.green, fontWeight:700, fontSize:13, margin:0 }}>Start via NJ PHCC: academy@nj-phcc.org — 7-10 days to enroll first apprentice.</p>
        </div>
      </div>
      <div>
        <h3 style={{ color:C.navy, fontWeight:700, marginBottom:16 }}>Public Works — WMBE Advantage</h3>
        <Table
          headers={["Program", "Opportunity"]}
          rows={[
            ["NJ SBE Set-aside", "25% of all NJ state contracts"],
            ["NJSDA School grants", "FY2026 allocation — HVAC priority"],
            ["PSE&G Engineered Solutions", "Up to 80% project funding"],
            ["RETROFIT NJ", "$2.5M-$12.5M per project"],
            ["Newark/Essex preference", "Local WMBE priority"],
          ]}
        />
        <div style={{ marginTop:12, padding:12, background:"#eff6ff", borderRadius:8, border:"1px solid #93c5fd" }}>
          <p style={{ color:C.navy, fontWeight:700, fontSize:13, margin:0 }}>Register on NJSTART.gov + SAM.gov. One public school contract = entire year of residential revenue.</p>
        </div>
      </div>
    </div>
    <div style={{ marginTop:24, padding:16, background:C.navy, borderRadius:8, textAlign:"center" }}>
      <p style={{ color:"#fff", fontWeight:700, margin:0 }}>A $500K school HVAC contract: Materials $200K (supplier credit), Labor $120K (mix of journeymen + apprentices at 50% rate), Profit $150K+. Government pays in 30 days guaranteed. Zero cash upfront with WMBE contractor financing.</p>
    </div>
  </div>
);}

// ══════════════════════════════════════════════════════
// SLIDE 15 — CONCLUSION
// ══════════════════════════════════════════════════════
function s15() { return (
  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:500, textAlign:"center" }}>
    <h1 style={{ fontSize:40, fontWeight:900, color:C.navy, marginBottom:16 }}>The Math Is Simple</h1>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:24, marginBottom:32, width:"100%" }}>
      <Card border={C.orange} bg="#fff7ed">
        <Stat value="$350K" label="Revenue per installer per year" />
        <p style={{ fontSize:13, color:C.gray, marginTop:8 }}>Proven model. 4 installers operating now.</p>
      </Card>
      <Card border={C.navy} bg="#eff6ff">
        <Stat value="$18,000" label="PSE&G max rebate per residential job" />
        <p style={{ fontSize:13, color:C.gray, marginTop:8 }}>Instant rebate. No upfront cash. We handle everything.</p>
      </Card>
      <Card border={C.green} bg="#f0fdf4">
        <Stat value="80%" label="PSE&G covers commercial projects" />
        <p style={{ fontSize:13, color:C.gray, marginTop:8 }}>Schools, hospitals, multifamily. PSE&G funds it.</p>
      </Card>
    </div>
    <Orange>2026 GOAL: 8 INSTALLERS × $350K = $2.8M REVENUE</Orange>
    <p style={{ fontSize:18, color:C.gray, maxWidth:700, lineHeight:1.7, marginBottom:32 }}>
      Every installer we hire adds $350,000 to the top line.<br/>
      PSE&G funds the jobs. Suppliers cover materials.<br/>
      The No Catch campaign generates the leads.<br/>
      <strong style={{ color:C.navy }}>We just need to execute.</strong>
    </p>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:16, width:"100%", maxWidth:600 }}>
      <div style={{ padding:16, background:C.navy, borderRadius:8, color:"#fff" }}>
        <div style={{ fontWeight:700, marginBottom:4 }}>Mechanical Enterprise LLC</div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.8)" }}>(862) 419-1763</div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.8)" }}>sales@mechanicalenterprise.com</div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.8)" }}>mechanicalenterprise.com</div>
      </div>
      <div style={{ padding:16, background:C.orange, borderRadius:8, color:"#fff" }}>
        <div style={{ fontWeight:700, marginBottom:4 }}>PSE&G Trade Ally PN#136</div>
        <div style={{ fontSize:13 }}>WMBE/SBE Certified</div>
        <div style={{ fontSize:13 }}>Newark, NJ · 15 Counties</div>
        <div style={{ fontSize:13 }}>March 31, 2026</div>
      </div>
    </div>
  </div>
);}

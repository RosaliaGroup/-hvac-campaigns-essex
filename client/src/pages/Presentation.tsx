import { useState, useEffect } from "react";

const SLIDES = 17;
const PASSWORD = "mechanicalenterprise2026";

export default function Presentation() {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [slide, setSlide] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!unlocked) return;
      if (e.key === "ArrowRight") setSlide(s => Math.min(SLIDES-1, s+1));
      if (e.key === "ArrowLeft") setSlide(s => Math.max(0, s-1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [unlocked]);

  if (!unlocked) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0a1628",fontFamily:"Inter,sans-serif"}}>
      <div style={{background:"#fff",borderRadius:16,padding:48,boxShadow:"0 8px 40px rgba(0,0,0,0.3)",textAlign:"center",maxWidth:420,width:"90%"}}>
        <div style={{fontSize:48,marginBottom:16}}>⚙️</div>
        <h2 style={{color:"#0a1628",marginBottom:4,fontSize:24,fontWeight:800}}>Mechanical Enterprise LLC</h2>
        <p style={{color:"#64748b",marginBottom:24,fontSize:14}}>Partner Presentation — Confidential</p>
        <input type="password" placeholder="Enter access password" value={input}
          onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){if(input===PASSWORD){setUnlocked(true);setError("")}else{setError("Incorrect password");setInput("")}}}}
          style={{width:"100%",padding:"12px 16px",borderRadius:8,border:"2px solid #e2e8f0",fontSize:16,marginBottom:12,boxSizing:"border-box",outline:"none"}}/>
        {error&&<p style={{color:"#e53e3e",fontSize:13,marginBottom:8}}>{error}</p>}
        <button onClick={()=>{if(input===PASSWORD){setUnlocked(true);setError("")}else{setError("Incorrect password");setInput("")}}}
          style={{width:"100%",padding:14,background:"#e8813a",color:"#fff",border:"none",borderRadius:8,fontSize:16,fontWeight:700,cursor:"pointer"}}>
          Enter Presentation
        </button>
      </div>
    </div>
  );

  const slides = [Slide0,Slide1,Slide2,Slide3,Slide4,Slide5,Slide6,Slide7,Slide8,Slide9,Slide10,Slide11,Slide12,Slide13,Slide14,Slide15,Slide16];
  const SlideComponent = slides[slide];

  return (
    <div style={{minHeight:"100vh",background:"#f0f4f8",fontFamily:"Inter,sans-serif"}}>
      <div style={{maxWidth:1280,margin:"0 auto",padding:"20px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{color:"#64748b",fontSize:13,fontWeight:600}}>Mechanical Enterprise LLC — Confidential</span>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {Array.from({length:SLIDES}).map((_,i)=>(
              <button key={i} onClick={()=>setSlide(i)}
                style={{width:i===slide?24:8,height:8,borderRadius:4,border:"none",background:i===slide?"#e8813a":i<slide?"#0a1628":"#cbd5e1",cursor:"pointer",transition:"all 0.2s",padding:0}}/>
            ))}
          </div>
          <span style={{color:"#64748b",fontSize:13}}>{slide+1} / {SLIDES}</span>
        </div>
        <div style={{background:"#fff",borderRadius:20,boxShadow:"0 4px 24px rgba(0,0,0,0.08)",minHeight:620,overflow:"hidden"}}>
          <SlideComponent/>
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:12,marginTop:20}}>
          <button onClick={()=>setSlide(s=>Math.max(0,s-1))} disabled={slide===0}
            style={{padding:"12px 36px",borderRadius:8,border:"2px solid #0a1628",background:"#fff",color:"#0a1628",fontWeight:700,fontSize:15,cursor:slide===0?"not-allowed":"pointer",opacity:slide===0?0.4:1}}>
            ← Previous
          </button>
          <button onClick={()=>setSlide(s=>Math.min(SLIDES-1,s+1))} disabled={slide===SLIDES-1}
            style={{padding:"12px 36px",borderRadius:8,border:"none",background:"#e8813a",color:"#fff",fontWeight:700,fontSize:15,cursor:slide===SLIDES-1?"not-allowed":"pointer",opacity:slide===SLIDES-1?0.4:1}}>
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

const navy = "#0a1628";
const orange = "#e8813a";
const green = "#16a34a";
const gray = "#64748b";

const slideWrap: React.CSSProperties = {padding:"48px 56px",minHeight:620,fontFamily:"Inter,sans-serif"};
const navySlide: React.CSSProperties = {...slideWrap,background:navy,color:"#fff"};

function H1({children,light=false}:{children:React.ReactNode;light?:boolean}){return <h1 style={{fontSize:34,fontWeight:900,color:light?"#fff":navy,textAlign:"center",marginBottom:8,marginTop:0}}>{children}</h1>}
function Sub({children}:{children:React.ReactNode}){return <p style={{fontSize:16,color:gray,textAlign:"center",marginBottom:32,marginTop:0}}>{children}</p>}
function OrangeBar({children}:{children:React.ReactNode}){return <div style={{background:orange,borderRadius:10,padding:"14px 24px",textAlign:"center",color:"#fff",fontWeight:700,fontSize:16,marginBottom:24}}>{children}</div>}
function Card({children,border=orange,bg="#fff"}:{children:React.ReactNode;border?:string;bg?:string}){return <div style={{border:`2px solid ${border}`,borderRadius:12,padding:20,background:bg,height:"100%"}}>{children}</div>}
function Grid({cols=3,children}:{cols?:number;children:React.ReactNode}){return <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:20,marginBottom:24}}>{children}</div>}
function Tag({children,color=orange}:{children:React.ReactNode;color?:string}){return <span style={{background:color,color:"#fff",borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700,display:"inline-block",marginBottom:8}}>{children}</span>}
function Table({headers,rows}:{headers:string[];rows:React.ReactNode[][]}){return(
  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,marginBottom:16}}>
    <thead><tr style={{background:navy}}>{headers.map((h,i)=><th key={i} style={{padding:"10px 14px",color:"#fff",textAlign:i===0?"left":"center",fontWeight:700,fontSize:13}}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((row,i)=><tr key={i} style={{background:i%2===0?"#f8fafc":"#fff"}}>{row.map((cell,j)=><td key={j} style={{padding:"9px 14px",textAlign:j===0?"left":"center",borderBottom:"1px solid #e2e8f0",fontSize:13,verticalAlign:"middle"}}>{cell}</td>)}</tr>)}</tbody>
  </table>
)}

function Slide0(){return(
  <div style={{...navySlide,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",minHeight:620}}>
    <div style={{fontSize:64,marginBottom:20}}>⚙️</div>
    <h1 style={{fontSize:52,fontWeight:900,color:"#fff",margin:"0 0 12px"}}>Mechanical Enterprise LLC</h1>
    <h2 style={{fontSize:26,fontWeight:600,color:orange,margin:"0 0 28px"}}>2026 Business Partner Presentation</h2>
    <p style={{fontSize:18,color:"rgba(255,255,255,0.75)",maxWidth:640,lineHeight:1.7,margin:"0 0 40px"}}>Digital Platform · Market Position · Growth Strategy<br/>PSE&G Trade Ally · WMBE/SBE Certified · Newark, NJ</p>
    <div style={{display:"flex",gap:48}}>
      {([["4","Active Installers"],["$350K","Revenue Per Installer"],["116","SEO Pages Live"],["15","NJ Counties Served"]] as const).map(([v,l])=>(<div key={l} style={{textAlign:"center"}}><div style={{fontSize:40,fontWeight:900,color:orange}}>{v}</div><div style={{fontSize:13,color:"rgba(255,255,255,0.6)",marginTop:4}}>{l}</div></div>))}
    </div>
    <p style={{fontSize:13,color:"rgba(255,255,255,0.4)",marginTop:40}}>March 31, 2026 · Confidential</p>
  </div>
)}

function Slide1(){return(
  <div style={slideWrap}>
    <H1>Complete Digital Platform — Built & Live</H1>
    <Sub>mechanicalenterprise.com · Built in 30 days. Most competitors don't have this after 10 years.</Sub>
    <Grid cols={3}>
      {[
        {icon:"🌐",title:"Website + 116 SEO Pages",color:orange,items:["49 city pages — 20mi radius of Newark","23 North NJ cities (Morris, Passaic, Sussex)","18 luxury area pages (Alpine, Saddle River)","8 service-specific pages","4 competitor conquest pages","Blog system launched","Google Search Console — 116 URLs indexed"]},
        {icon:"🤖",title:"Jessica AI + Chat Widget",color:navy,items:["AI chat on every page — 24/7","Qualifies leads, books assessments","Answers PSE&G rebate questions instantly","Lead capture: name + phone + email","Email notification to sales@ on every lead","5-category quick reply menu","Powered by Claude AI"]},
        {icon:"💳",title:"Stripe Payments Live",color:green,items:["Residential Standard: $100","Residential Emergency: $175","Commercial Standard: $200","Commercial Emergency: $275","Payment secures appointment slot","Zero collection issues","Reduces no-shows to near zero"]},
        {icon:"📚",title:"Course Platform (LMS)",color:"#7c3aed",items:["Full learning management system","6 categories: Certification, Sales, Systems","Technician to Homeowner levels","Certificate generation","My Courses dashboard","Protected lesson content","Recurring revenue stream"]},
        {icon:"📊",title:"Lead Management System",color:"#0891b2",items:["Lead Dashboard + Lead Tracker","Lead Scoring System built","Assessment submissions tracked","Campaign performance analytics","ServiceTitan CRM integration","HubSpot connector available","AI-powered campaign generator"]},
        {icon:"🏆",title:"WMBE/SBE Certified",color:orange,items:["Minority & Women-Owned Business","Small Business Enterprise certified","25% NJ state contract set-aside","Government contract access","Diversity supplier programs","Preferred vendor status","Newark local preference"]},
      ].map(({icon,title,color,items})=>(<Card key={title} border={color}><div style={{fontSize:28,marginBottom:8}}>{icon}</div><h3 style={{color,fontWeight:800,fontSize:15,marginBottom:12,marginTop:0}}>{title}</h3>{items.map(item=><div key={item} style={{display:"flex",gap:6,marginBottom:5,alignItems:"flex-start"}}><span style={{color:green,fontWeight:700,fontSize:12,minWidth:14}}>✓</span><span style={{fontSize:12,color:gray,lineHeight:1.4}}>{item}</span></div>)}</Card>))}
    </Grid>
  </div>
)}

function Slide2(){return(
  <div style={slideWrap}>
    <H1>116 SEO Pages + 8 Targeted Landing Pages</H1>
    <Sub>116 doors open 24/7 — every page targeting a different NJ customer</Sub>
    <Grid cols={2}>
      <div>
        <h3 style={{color:navy,fontWeight:800,marginBottom:16,marginTop:0}}>SEO City & Service Pages (116)</h3>
        <Table headers={["Category","Pages","Target"]} rows={[["City pages — 20mi radius of Newark","49","Residential heat pump leads"],["North NJ (Morris, Passaic, Sussex)","23","North NJ homeowners"],["Luxury areas (Alpine, Saddle River, etc)","18","High-ticket $20K-$50K jobs"],["Service pages (heat pump, VRF, etc)","8","High-intent buyers"],["Competitor conquest pages","4","Steal competitor traffic"],["Blog system","Active","Long-tail PSE&G keywords"],["TOTAL","116","All indexed by Google"]]}/>
      </div>
      <div>
        <h3 style={{color:navy,fontWeight:800,marginBottom:16,marginTop:0}}>8 Targeted Landing Pages</h3>
        {([["🔥","/lp/heat-pump-rebates","Heat Pump Rebates — PSE&G"],["🏢","/lp/commercial-vrv","Commercial VRV/VRF Systems"],["🚨","/lp/emergency-hvac","Emergency HVAC Service"],["📘","/lp/fb-residential","Facebook — Residential"],["📘","/lp/fb-commercial","Facebook — Commercial"],["📖","/lp/rebate-guide","PSE&G Rebate Guide"],["🔧","/lp/maintenance-offer","Maintenance Plan Offer"],["🤝","/lp/referral-partner","Referral Partner Program"]] as const).map(([icon,path,desc])=>(<div key={path} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:"1px solid #f1f5f9",alignItems:"center"}}><span style={{fontSize:16}}>{icon}</span><span style={{fontSize:12,color:orange,fontFamily:"monospace",minWidth:160}}>{path}</span><span style={{fontSize:12,color:gray}}>{desc}</span></div>))}
        <div style={{marginTop:20,padding:16,background:"#fff7ed",borderRadius:8,border:`1px solid ${orange}`}}><p style={{color:orange,fontWeight:700,fontSize:13,margin:0}}>116 pages + 8 landing pages = 124 unique entry points for leads to find Mechanical Enterprise.</p></div>
      </div>
    </Grid>
  </div>
)}

function Slide3(){return(
  <div style={slideWrap}>
    <H1>Automated Booking + Payment System</H1>
    <Sub>From visitor to paying customer — fully automated</Sub>
    <Grid cols={2}>
      <div>
        <h3 style={{color:navy,fontWeight:800,marginBottom:16,marginTop:0}}>Booking Flow</h3>
        {([["1","Visitor lands on any of 124 pages"],["2","Jessica AI chat engages within 3 seconds"],["3","Visitor selects: Residential or Commercial"],["4","Smart form collects all required info"],["5","Stripe payment link secures appointment"],["6","Email sent to sales@ with all details"],["7","Team follows up within 1 business hour"]] as const).map(([n,text])=>(<div key={n} style={{display:"flex",gap:12,marginBottom:12,alignItems:"flex-start"}}><div style={{minWidth:28,height:28,borderRadius:"50%",background:orange,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13}}>{n}</div><p style={{color:gray,fontSize:14,margin:0,paddingTop:4}}>{text}</p></div>))}
      </div>
      <div>
        <h3 style={{color:navy,fontWeight:800,marginBottom:16,marginTop:0}}>4 Stripe Products Live</h3>
        <Table headers={["Service","Price","Payment"]} rows={[["Residential Standard","$100","Secures slot"],["Residential Emergency","$175","Priority dispatch"],["Commercial Standard","$200","Secures assessment"],["Commercial Emergency","$275","Same-day response"]]}/>
        <h3 style={{color:navy,fontWeight:800,marginBottom:12,marginTop:16}}>Data Collected Per Lead</h3>
        <Grid cols={2}>
          <Card border="#e2e8f0"><h4 style={{color:orange,fontWeight:700,marginBottom:8,marginTop:0,fontSize:13}}>Residential</h4>{["Name, phone, email","Service address","Service type + emergency flag","Appointment preference"].map(i=><div key={i} style={{fontSize:12,color:gray,marginBottom:4}}>✓ {i}</div>)}</Card>
          <Card border="#e2e8f0"><h4 style={{color:navy,fontWeight:700,marginBottom:8,marginTop:0,fontSize:13}}>Commercial</h4>{["Company + contact info","Property type + sq footage","Current system details","Decision maker confirmed"].map(i=><div key={i} style={{fontSize:12,color:gray,marginBottom:4}}>✓ {i}</div>)}</Card>
        </Grid>
      </div>
    </Grid>
  </div>
)}

function Slide4(){return(
  <div style={slideWrap}>
    <H1>Why Heat Pumps — Why Now</H1>
    <Sub>NJ mandates electrification. PSE&G pays for it. We install it.</Sub>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20,marginBottom:32,textAlign:"center"}}>{([["$3.57B","North American heat pump market 2026"],["9.85%","CAGR projected growth through 2034"],["13M","US homes that would save switching"]] as const).map(([v,l])=>(<div key={l} style={{padding:24,background:"#f8fafc",borderRadius:12,border:"1px solid #e2e8f0"}}><div style={{fontSize:40,fontWeight:900,color:orange}}>{v}</div><div style={{fontSize:13,color:gray,marginTop:8}}>{l}</div></div>))}</div>
    <Grid cols={2}>
      <div>
        <h3 style={{color:navy,fontWeight:800,marginBottom:12,marginTop:0}}>PSE&G Residential — Clean Heat Program</h3>
        <Table headers={["Incentive","Amount"]} rows={[["Gas to Heat Pump (Non-LMI, 50%)","Up to $10,000"],["Gas to Heat Pump (LMI, 60%)","Up to $12,000"],["Decommissioning adder","Up to $2,000"],["Re-ducting adder (Manual D)","Up to $2,000"],["Additional ccASHP unit","$2,000 per unit"],["OBR Financing — Non LMI","0% / 84 months"],["OBR Financing — LMI","0% / 120 months"],["MAXIMUM (LMI + all adders)","$18,000"]]}/>
        <p style={{fontSize:11,color:gray,marginTop:4}}>PSE&G pays after project completion via OBR. Timeline: 8-9 weeks from job start.</p>
      </div>
      <div>
        <h3 style={{color:navy,fontWeight:800,marginBottom:12,marginTop:0}}>PSE&G Commercial — Engineered Solutions</h3>
        <Table headers={["Program","Coverage"]} rows={[["Energy audit","Free to building owner"],["Bid-ready design documents","Free to building owner"],["Project cost coverage","Up to ~80%"],["Customer repayment","0% / 60 months"],["Multifamily repayment","0% / 120 months"]]}/>
        <div style={{padding:12,background:"#f0fdf4",borderRadius:8,border:"1px solid #86efac",marginTop:8}}><p style={{color:green,fontWeight:700,fontSize:13,margin:0}}>PSE&G funds construction milestones directly. Customer pays 0% over 60 months. We get paid throughout construction.</p></div>
        <div style={{padding:12,background:"#fff7ed",borderRadius:8,border:`1px solid ${orange}`,marginTop:8}}><p style={{color:orange,fontWeight:700,fontSize:13,margin:0}}>Federal 25C tax credit expired Dec 2025 — urgency now. NJ Clean Energy Plan mandates electrification. Commercial rebates cover up to 80%.</p></div>
      </div>
    </Grid>
  </div>
)}

function Slide5(){return(
  <div style={slideWrap}>
    <H1>Our Position vs The Competition</H1>
    <Sub>Enterprise-level digital infrastructure — competitors 10x our size don't have this</Sub>
    <Table headers={["Feature","Mechanical Enterprise","AJ Perri","Gold Medal","Horizon/Hutchinson"]} rows={[
      ["PSE&G Rebate Specialization",<span style={{color:green,fontWeight:700}}>✅ Core focus</span>,<span style={{color:"#d97706",fontWeight:700}}>⚠️ Limited</span>,<span style={{color:"#d97706",fontWeight:700}}>⚠️ Limited</span>,"❌ No"],
      ["AI Chat 24/7",<span style={{color:green,fontWeight:700}}>✅ Live</span>,"❌ No","❌ No","❌ No"],
      ["Online Booking + Payment",<span style={{color:green,fontWeight:700}}>✅ Stripe live</span>,"❌ No","❌ No","❌ No"],
      ["116 SEO Landing Pages",<span style={{color:green,fontWeight:700}}>✅ 116 pages</span>,<span style={{color:"#d97706",fontWeight:700}}>⚠️ Generic</span>,<span style={{color:"#d97706",fontWeight:700}}>⚠️ Generic</span>,"❌ No"],
      ["Course Platform (LMS)",<span style={{color:green,fontWeight:700}}>✅ Full LMS</span>,"❌ No","❌ No","❌ No"],
      ["WMBE/SBE Certified",<span style={{color:green,fontWeight:700}}>✅ Certified</span>,"❌ No","❌ No","❌ No"],
      ["Booking Automation",<span style={{color:green,fontWeight:700}}>✅ Full flow</span>,"❌ No","❌ No","❌ No"],
      ["Lead Scoring System",<span style={{color:green,fontWeight:700}}>✅ Built</span>,"❌ No","❌ No","❌ No"],
    ]}/>
    <Grid cols={3}>
      <Card border="#fee2e2" bg="#fff5f5"><h4 style={{color:"#dc2626",fontWeight:700,marginBottom:8,marginTop:0}}>AJ Perri</h4><p style={{fontSize:12,color:gray,margin:0}}>$58.7M revenue, 300 techs — NO rebate focus, NO AI, NO online payment.</p></Card>
      <Card border="#fee2e2" bg="#fff5f5"><h4 style={{color:"#dc2626",fontWeight:700,marginBottom:8,marginTop:0}}>Gold Medal Service</h4><p style={{fontSize:12,color:gray,margin:0}}>BBB complaints, NO AI, NO online payment. Generic HVAC.</p></Card>
      <Card border="#fee2e2" bg="#fff5f5"><h4 style={{color:"#dc2626",fontWeight:700,marginBottom:8,marginTop:0}}>Horizon/Hutchinson</h4><p style={{fontSize:12,color:gray,margin:0}}>Regional chains with generic approach. No WMBE. No innovation.</p></Card>
    </Grid>
  </div>
)}

function Slide6(){return(
  <div style={slideWrap}>
    <H1>Revenue Model — $350K Per Installer Per Year</H1>
    <Sub>4 installers operating now. Target: 8 by Q4 2026.</Sub>
    <Table headers={["Year","Installers","Annual Revenue","Monthly Run Rate"]} rows={[["2026 (current)","4 → 8","$1.4M → $2.8M","$116K → $233K"],["2027","12","$4,200,000","$350,000"],["2028","20","$7,000,000","$583,333"],["2029","30","$10,500,000","$875,000"],["2030","50+","$17,500,000+","$1,458,333+"]]}/>
    <p style={{fontSize:11,color:gray,fontStyle:"italic",margin:"4px 0 20px"}}>Does NOT include commercial Engineered Solutions, courses, or maintenance subscriptions — all additive.</p>
    <OrangeBar>2026 TARGET: $1.4M-$2.8M — 4 INSTALLERS NOW → 8 BY Q4</OrangeBar>
    <Grid cols={3}>
      <Card border={green} bg="#f0fdf4"><h4 style={{color:green,fontWeight:700,marginBottom:8,marginTop:0}}>Conservative</h4><p style={{fontSize:12,color:gray,marginBottom:8}}>4 installers × $350K + confirmed PSE&G</p><p style={{fontSize:22,fontWeight:900,color:green,margin:0}}>$1.4M-$1.5M</p></Card>
      <Card border={navy} bg="#eff6ff"><h4 style={{color:navy,fontWeight:700,marginBottom:8,marginTop:0}}>Moderate</h4><p style={{fontSize:12,color:gray,marginBottom:8}}>6 installers × $350K + PSE&G pipeline</p><p style={{fontSize:22,fontWeight:900,color:navy,margin:0}}>$2M+</p></Card>
      <Card border={orange} bg="#fff7ed"><h4 style={{color:orange,fontWeight:700,marginBottom:8,marginTop:0}}>Aggressive (Target)</h4><p style={{fontSize:12,color:gray,marginBottom:8}}>8 installers × $350K + commercial</p><p style={{fontSize:22,fontWeight:900,color:orange,margin:0}}>$2.8M+</p></Card>
    </Grid>
    <div style={{padding:12,background:"#fff7ed",border:`1px solid ${orange}`,borderRadius:8,textAlign:"center"}}><p style={{color:orange,fontWeight:700,margin:0}}>1 new installer = $350K top line. Scaling requires bridging the 8-9 week PSE&G payment cycle.</p></div>
  </div>
)}

function Slide7(){return(
  <div style={slideWrap}>
    <H1>SEO Timeline — 116 Pages Working 24/7</H1>
    <Sub>Each page = a door for leads. 116 pages = 116 doors open forever.</Sub>
    <Grid cols={2}>
      <div>
        <Table headers={["Timeframe","Pages Ranked","Monthly Visits","Weekly Leads"]} rows={[["Month 1","10-20 pages","200-500","5-8"],["Month 2","30-50 pages","1,000-2,000","10-15"],["Month 3","60-80 pages","3,000-5,000","15-20"],["Month 6","100+ pages","8,000-12,000","25-40"],["Month 12","116+ pages","15,000+","40-60"]]}/>
        <div style={{padding:12,background:"#f0fdf4",borderRadius:8,border:"1px solid #86efac",marginTop:8}}><p style={{color:green,fontWeight:700,fontSize:13,margin:0}}>Month 12: 40-60 organic leads/week at $0 ad cost. 25% close = 10-15 installs/week from SEO alone.</p></div>
      </div>
      <div>
        <h3 style={{color:navy,fontWeight:800,marginBottom:16,marginTop:0}}>Google Business Profile + Map Pack</h3>
        <div style={{padding:16,background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0",marginBottom:16}}>
          {([["Current reviews","2 reviews — 5.0 stars"],["30-day target","10+ reviews"],["90-day target","50+ reviews"],["Map pack entry","Top 3 NJ HVAC searches"]] as const).map(([k,v])=>(<div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:13,color:gray}}>{k}</span><span style={{fontSize:13,fontWeight:700,color:navy}}>{v}</span></div>))}
        </div>
        <div style={{padding:16,background:"#fff7ed",borderRadius:8,border:`1px solid ${orange}`}}><p style={{color:orange,fontWeight:800,fontSize:14,margin:"0 0 8px"}}>Map Pack = 60% of all local search clicks</p><p style={{fontSize:12,color:gray,margin:0}}>Top 3 map results get 60% of all clicks for "HVAC repair Newark NJ". We take it with 50+ reviews.</p></div>
        <div style={{padding:12,background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0",marginTop:12}}><p style={{color:navy,fontWeight:700,fontSize:13,margin:"0 0 4px"}}>1 blog/day = 365 articles/year</p><p style={{fontSize:12,color:gray,margin:0}}>116 pages + 365 blogs = 481 pages by end of 2026. Competitors post monthly. We post daily.</p></div>
      </div>
    </Grid>
  </div>
)}

function Slide8(){return(
  <div style={slideWrap}>
    <H1>How We Get Leads — Starting This Week</H1>
    <Sub>No Catch Campaign — PSE&G will pay up to $18,000 to replace your gas furnace</Sub>
    <div style={{padding:16,background:navy,borderRadius:12,marginBottom:24,textAlign:"center"}}><p style={{color:"#fff",fontWeight:900,fontSize:20,margin:"0 0 8px"}}>THE MESSAGE: PSE&G will pay up to $18,000 to replace your gas furnace with a heat pump.</p><p style={{color:orange,fontWeight:800,fontSize:18,margin:0}}>No catch. No trip. No gimmick. Just say yes — we do the rest.</p></div>
    <Grid cols={3}>
      {[
        {tag:"TODAY — $0",color:green,title:"Text Past Customers",text:"'PSE&G is offering up to $18,000 to replace gas furnaces — no catch.' Send to 20 contacts. Expected: 2-5 leads."},
        {tag:"THIS WEEK — $0",color:navy,title:"Google Business + Nextdoor",text:"Post before/after photos daily. Post in NJ neighborhood Facebook groups. Request reviews. Expected: 3-8 leads/week."},
        {tag:"THIS WEEK — $300",color:orange,title:"Boost Facebook Post $10/day",text:"Target NJ homeowners 35-65 within 20 miles of Newark. No Catch messaging. Expected: 5-10 leads first week."},
        {tag:"THIS WEEK — $0",color:"#7c3aed",title:"Call 10 Real Estate Agents",text:"'We offer buyers $18,000 in PSE&G rebates. Be our preferred HVAC contractor?' Expected: 1-2 referrals/week."},
        {tag:"WEEK 2 — $1,500/mo",color:"#0891b2",title:"Google Ads — PSE&G Keywords",text:"'PSE&G heat pump rebate NJ', 'replace gas furnace NJ'. Ad: 'NJ Pays Up to $18,000.' Expected: 8-12 leads/week."},
        {tag:"ONGOING — $1,000/mo",color:green,title:"Facebook/Instagram Ads",text:"Video: 'We replaced this family's furnace for $0.' Target NJ homeowners, rebate angle. Expected: 15-20 leads/week."},
      ].map(({tag,color,title,text})=>(<Card key={title} border={color}><Tag color={color}>{tag}</Tag><h4 style={{color:navy,fontWeight:700,margin:"8px 0",fontSize:14}}>{title}</h4><p style={{fontSize:12,color:gray,margin:0,lineHeight:1.5}}>{text}</p></Card>))}
    </Grid>
    <Table headers={["Timeline","Leads/Week","Cost"]} rows={[["Week 1 — texts + Nextdoor + GBP","5-15","$0"],["Week 2 — + Facebook boost","10-20","$300"],["Week 3 — + referral network","15-25","$300"],["Week 4 — + Google Ads","20-35","$1,800"],["Month 2 — fully ramped","30-50","$2,500/mo"]]}/>
  </div>
)}

function Slide9(){return(
  <div style={slideWrap}>
    <H1>Social Media — The No Catch Campaign</H1>
    <Sub>$2,500/month → 40 leads/week → 10 installs/week → 30:1 ROI</Sub>
    <Grid cols={3}>
      {[
        {title:"Ad 1 — No Catch",color:navy,copy:'"PSE&G Is Paying Up to $18,000 to Replace Your Furnace. No catch. No salesperson. Just a free assessment."',cta:"See If You Qualify →"},
        {title:"Ad 2 — Do The Math",color:orange,copy:'"Gas bill: $300+. Heat pump: $80. PSE&G pays up to $18,000. Monthly payment: as low as $0 with OBR."',cta:"Get Free Assessment →"},
        {title:"Ad 3 — Neighbors Did It",color:green,copy:'"West Orange family replaced their furnace for $0. PSE&G covers up to $18,000. We handled every form."',cta:"You Could Qualify Too →"},
      ].map(({title,color,copy,cta})=>(<Card key={title} border={color}><h4 style={{color,fontWeight:700,marginBottom:8,marginTop:0}}>{title}</h4><p style={{fontSize:12,color:gray,fontStyle:"italic",marginBottom:8,lineHeight:1.5}}>{copy}</p><p style={{fontSize:12,color:orange,fontWeight:700,margin:0}}>CTA: {cta}</p></Card>))}
    </Grid>
    <Table headers={["Platform","Budget/Mo","Leads/Wk","Content"]} rows={[["Facebook/Instagram Ads","$1,000","15-20","Video + carousel — rebate angle"],["Google Search Ads","$1,500","8-12","PSE&G rebate keywords"],["TikTok/Reels (organic)","$0","3-5","Job walkthroughs"],["Google Business Profile","$0","3-5","Before/after photos"],["Nextdoor + FB Groups","$0","3-8","No Catch messaging"],["Referral partners","$300/install","2-4","$200-$500 per closed job"],["TOTAL","$2,500/mo","34-54/week",""]]}/>
    <div style={{padding:12,background:"#fff7ed",border:`1px solid ${orange}`,borderRadius:8,textAlign:"center"}}><p style={{color:orange,fontWeight:700,margin:0}}>$2,500/month → 40 leads/week → 10 installs/week → $87,500/week revenue. Every $1 returns $35.</p></div>
  </div>
)}

function Slide10(){return(
  <div style={slideWrap}>
    <H1>How Jobs Get Financed — The Cash Flow Reality</H1>
    <Sub>PSE&G jobs take 8-9 weeks to pay. Here's how we bridge the gap at every stage.</Sub>
    <Grid cols={2}>
      <div>
        <h3 style={{color:navy,fontWeight:800,marginBottom:16,marginTop:0}}>PSE&G Payment Timeline</h3>
        {([["1","Win PSE&G Clean Heat job ($40K-$50K)"],["2","Order materials on supplier credit (net-30)"],["3","Complete installation in 3-4 days"],["4","Submit PSE&G rebate application"],["5","Customer chooses payment option"],["6","PSE&G processes — 8-9 weeks from start"],["7","Receive payment via OBR or 3rd party"],["8","Pay supplier — net-30 usually covers gap"]] as const).map(([n,text])=>(<div key={n} style={{display:"flex",gap:10,marginBottom:10,alignItems:"flex-start"}}><div style={{minWidth:26,height:26,borderRadius:"50%",background:orange,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12}}>{n}</div><p style={{color:gray,fontSize:13,margin:0,paddingTop:4}}>{text}</p></div>))}
      </div>
      <div>
        <h3 style={{color:navy,fontWeight:800,marginBottom:12,marginTop:0}}>4 Customer Payment Tiers</h3>
        {[
          {opt:"Option 1 — 3rd Party Financing",tag:"BEST PRICE",color:orange,you:"You get paid IMMEDIATELY",detail:"3rd party lender pays us in full. Customer finances at 0%. Best cash flow for us."},
          {opt:"Option 2 — Deposit",tag:"COMMON",color:navy,you:"Deposit upfront + balance at completion",detail:"Customer pays deposit today, finances rest at 0% via PSE&G OBR."},
          {opt:"Option 3 — Finance Balance",tag:"FLEXIBLE",color:green,you:"$0 upfront — 3rd party finances net",detail:"Customer pays $0 upfront. Rebates reduce balance. 3rd party privately finances remainder."},
          {opt:"Option 4 — NJ Clean Heat OBR",tag:"WAIT 8-9 WKS",color:gray,you:"Paid via PSE&G after completion",detail:"100% covered by NJ Clean Heat program. We wait 8-9 weeks for PSE&G payment."},
        ].map(({opt,tag,color,you,detail})=>(<div key={opt} style={{border:`1px solid ${color}`,borderRadius:8,padding:10,marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{fontSize:12,fontWeight:700,color:navy}}>{opt}</span><Tag color={color}>{tag}</Tag></div><p style={{fontSize:12,fontWeight:700,color,margin:"0 0 2px"}}>{you}</p><p style={{fontSize:11,color:gray,margin:0}}>{detail}</p></div>))}
      </div>
    </Grid>
  </div>
)}

function Slide11(){return(
  <div style={slideWrap}>
    <H1>Capital Strategy — Path to Project Financing</H1>
    <Sub>Current: bridge with supplier credit. Target: $2.5M gross → Mobilization Funding unlocks.</Sub>
    <Grid cols={2}>
      <div>
        <h3 style={{color:navy,fontWeight:800,marginBottom:16,marginTop:0}}>Current Financing Stack</h3>
        {[
          {icon:"✅",color:green,title:"Supplier Credit Lines — Active",text:"Ferguson HVAC + Johnstone Supply net-30/60. Materials ordered today, paid after job."},
          {icon:"💳",color:orange,title:"3rd Party Financing (Option 1)",text:"Push customers to Option 1 — we get paid immediately. Eliminates 8-9 week wait."},
          {icon:"🏦",color:"#7c3aed",title:"Acorn Finance — Customer Option",text:"Free to set up. Customer approved, Acorn pays us in 48 hours."},
        ].map(({icon,color,title,text})=>(<div key={title} style={{border:`1px solid ${color}`,borderRadius:8,padding:12,marginBottom:10,background:"#f8fafc"}}><div style={{display:"flex",gap:8,alignItems:"flex-start"}}><span style={{fontSize:16}}>{icon}</span><div><h4 style={{color,fontWeight:700,margin:"0 0 4px",fontSize:13}}>{title}</h4><p style={{fontSize:12,color:gray,margin:0,lineHeight:1.4}}>{text}</p></div></div></div>))}
      </div>
      <div>
        <h3 style={{color:navy,fontWeight:800,marginBottom:16,marginTop:0}}>At $2.5M Gross Revenue</h3>
        <div style={{padding:20,background:navy,borderRadius:12,marginBottom:16,color:"#fff"}}><h4 style={{color:orange,fontWeight:800,margin:"0 0 8px",fontSize:16}}>🏗️ Mobilization Funding</h4><p style={{fontSize:13,margin:"0 0 12px",lineHeight:1.6,color:"rgba(255,255,255,0.85)"}}>At $2.5M gross, Mobilization Funding finances each project upfront — 70-80% of signed contract value. 1.8-1.9% cost per project.</p><div style={{background:"rgba(255,255,255,0.1)",borderRadius:8,padding:12}}><p style={{fontSize:12,color:orange,fontWeight:700,margin:0}}>Target: Hit $2.5M → unlock project financing → take on larger jobs with zero cash gap</p></div></div>
        <div style={{padding:12,background:"#f0fdf4",borderRadius:8,border:"1px solid #86efac",marginBottom:12}}>
          <h4 style={{color:green,fontWeight:800,margin:"0 0 8px",fontSize:14}}>Path to $2.5M</h4>
          <Table headers={["Milestone","Revenue","When"]} rows={[["4 installers × $350K","$1.4M","Now"],["+ PSE&G pipeline","$500K","Q2 2026"],["+ Commercial jobs","$600K","Q3 2026"],["= Threshold","$2.5M","Q4 2026"]]}/>
        </div>
        <div style={{padding:12,background:"#fff7ed",border:`1px solid ${orange}`,borderRadius:8}}><p style={{color:orange,fontWeight:700,fontSize:13,margin:0}}>The #1 constraint is project funding. Securing financing to bridge the 8-9 week PSE&G payment cycle is the key to scaling.</p></div>
      </div>
    </Grid>
  </div>
)}

function Slide12(){return(
  <div style={slideWrap}>
    <H1>ServiceTitan — The Operating System for Scale</H1>
    <Sub>$1,300/month · 0.09% of target revenue · Industry standard tech overhead is 8-12%</Sub>
    <Grid cols={2}>
      {[
        {icon:"📋",color:orange,title:"Job Management",items:["Every lead, booking, and job in one place","Dispatch, scheduling, technician management","Real-time job status for the whole team","Integrates with our booking system","PSE&G rebate job tracking"]},
        {icon:"💰",color:green,title:"Revenue Tracking",items:["Every invoice, payment, job value tracked","Stripe payments sync with ServiceTitan","Revenue, margins, top technicians — instant","Johnstone Supply integration","Essential for scaling to 8 figures"]},
        {icon:"📊",color:navy,title:"Performance Analytics",items:["Close rates, avg job value, lead sources","Which marketing channels drive revenue","Top performers and underperforming areas","Data-driven decisions at every level","Required for Mobilization Funding"]},
        {icon:"🔗",color:"#7c3aed",title:"Platform Integration",items:["ServiceTitan + Jessica AI + Stripe + website","Automated lead-to-payment pipeline","Book → job → dispatch → invoice → pay","Zero manual data entry","Complete operational visibility"]},
      ].map(({icon,color,title,items})=>(<Card key={title} border={color}><div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}><span style={{fontSize:24}}>{icon}</span><h3 style={{color,fontWeight:800,margin:0,fontSize:16}}>{title}</h3></div>{items.map(item=><div key={item} style={{display:"flex",gap:6,marginBottom:5}}><span style={{color:green,fontWeight:700,fontSize:12,minWidth:14}}>✓</span><span style={{fontSize:12,color:gray,lineHeight:1.4}}>{item}</span></div>)}</Card>))}
    </Grid>
    <div style={{padding:14,background:"#fff7ed",borderRadius:8,border:`1px solid ${orange}`,textAlign:"center"}}><p style={{color:navy,fontWeight:700,margin:0}}>ServiceTitan customers report 23% revenue increase in year 1. At $1.4M, $1,300/month = 1.1% overhead vs 8-12% industry average.</p></div>
  </div>
)}

function Slide13(){return(
  <div style={slideWrap}>
    <H1>90-Day Execution Plan</H1>
    <Sub>Specific. Measurable. Starting this week.</Sub>
    <Grid cols={3}>
      {[
        {month:"Month 1 — LAUNCH",color:orange,items:["Launch Google Ads ($1,500/mo) — PSE&G keywords","Launch Facebook Ads ($1,000/mo) — No Catch","Start 1 blog/day — PSE&G rebate topics","Text all past customers — free assessment","Post daily on Google Business Profile","Create Thumbtack + Angi profiles","Contact 10 RE agents for referrals","Hire 1 additional installer","Set up Acorn Finance account","Push customers to Option 1 financing"]},
        {month:"Month 2 — SCALE",color:navy,items:["25+ Google reviews — enter map pack","Optimize Google Ads with Month 1 data","20 active referral partners","90 blog posts live — traffic growing","Hire 2nd installer at 6 installs/week","ServiceTitan tracking all jobs","First TikTok/Reels — job walkthroughs","Approach 3 Engineered Solutions targets","Submit first commercial PSE&G app","Track cash vs $2.5M threshold"]},
        {month:"Month 3 — HIT TARGET",color:green,items:["3+ installs/week consistently","50 Google reviews — map pack top 3","6-8 installers working","$87,500/month revenue run rate","First Engineered Solutions job won","180 blog posts — 400+ visits/day","Expand to North NJ PSE&G territory","Register DOL Apprenticeship","Register on NJSTART for public works","On track for $2.5M by Q4"]},
      ].map(({month,color,items})=>(<Card key={month} border={color}><h3 style={{color,fontWeight:800,marginBottom:12,fontSize:14,marginTop:0}}>{month}</h3>{items.map((item,i)=>(<div key={i} style={{display:"flex",gap:8,marginBottom:7,alignItems:"flex-start"}}><span style={{color,fontWeight:800,fontSize:13,minWidth:16}}>□</span><span style={{fontSize:12,color:gray,lineHeight:1.4}}>{item}</span></div>))}</Card>))}
    </Grid>
  </div>
)}

function Slide14(){return(
  <div style={slideWrap}>
    <H1>Completed PSE&G Projects — Our Track Record</H1>
    <Sub>Real jobs executed. Real rebates processed. PSE&G Trade Ally active.</Sub>
    <Grid cols={2}>
      <Card border={orange}><Tag>PSE&G CLEAN HEAT — COMPLETED</Tag><h3 style={{color:navy,fontWeight:800,marginBottom:4,marginTop:8}}>Modern Building Group</h3><p style={{color:gray,fontSize:13,marginBottom:12}}>18 Whitman St, West Orange NJ · PSE&G Clean Heat Decarbonization</p><div style={{fontSize:36,fontWeight:900,color:orange,marginBottom:12}}>$39,950</div><ul style={{color:gray,fontSize:13,paddingLeft:16,margin:0}}><li style={{marginBottom:4}}>Program: PSE&G Clean Heat</li><li style={{marginBottom:4}}>PSE&G Rebate: $16,000</li><li style={{marginBottom:4}}>Full heat pump + re-ducting + decommissioning</li><li style={{marginBottom:4}}>2 zones — complete HVAC replacement</li><li>Original $12,218 → grew to $39,950</li></ul></Card>
      <Card border={green}><Tag color={green}>RESIDENTIAL PSE&G — COMPLETED</Tag><h3 style={{color:navy,fontWeight:800,marginBottom:4,marginTop:8}}>Ufredo Molina</h3><p style={{color:gray,fontSize:13,marginBottom:12}}>175 Sunset Ave, North Arlington NJ · PSE&G Heat Pump + Electrical + Water Heater</p><div style={{fontSize:36,fontWeight:900,color:green,marginBottom:12}}>$49,036</div><ul style={{color:gray,fontSize:13,paddingLeft:16,margin:0}}><li style={{marginBottom:4}}>PSE&G Rebate: Up to $18,000 (LMI) / $16,000 (Non-LMI)</li><li style={{marginBottom:4}}>OBR Financing: 0% for 84-120 months</li><li style={{marginBottom:4}}>2 heat pump systems + panel upgrade</li><li>Tankless water heater</li></ul></Card>
    </Grid>
    <Table headers={["Contract","Value","PSE&G Rebate","Status"]} rows={[["Modern Building Group","$39,950","$16,000","✅ Completed"],["Ufredo Molina","$49,036","Up to $18,000","✅ Completed"],["Confirmed Total","$88,986","$34,000+",""],["Promised Pipeline","$1,500,000","Growing","In Progress"]]}/>
    <div style={{padding:12,background:"#f0fdf4",border:"1px solid #86efac",borderRadius:8,textAlign:"center"}}><p style={{color:green,fontWeight:700,margin:0}}>Both jobs are PSE&G Clean Heat program. As approved Trade Ally, every NJ gas customer is a potential project.</p></div>
  </div>
)}

function Slide15(){return(
  <div style={{...navySlide}}>
    <h1 style={{fontSize:30,fontWeight:900,textAlign:"center",marginBottom:8,color:"#fff"}}>From 4 Installers to 50 — The Path to $17.5M+</h1>
    <p style={{textAlign:"center",color:"rgba(255,255,255,0.6)",marginBottom:28,fontSize:14}}>5-Year Path — Built on $350K Per Installer</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14}}>
      {[
        {year:"2026",label:"EXECUTE",revenue:"$1.4M-$2.8M",color:orange,badge:"4 → 8 INSTALLERS BY Q4",items:["4 installers — $1.4M baseline","PSE&G Clean Heat program","No Catch campaign launched","1 blog/day — SEO compounding","Hit $2.5M → Mobilization Funding"]},
        {year:"2027",label:"DOMINATE LOCAL",revenue:"$4.2M-$6M",color:"#a78bfa",items:["12 installers × $350K = $4.2M","First Engineered Solutions job","Map pack top 3 — 40+ leads/week","200+ SEO pages","Courses revenue starting"]},
        {year:"2028",label:"EXPAND NJ",revenue:"$7M-$10M",color:"#38bdf8",items:["20-25 installers × $350K","2nd service hub Central NJ","Government contracts (WMBE)","Commercial VRV/VRF: 2-3/month"]},
        {year:"2029",label:"VERTICAL INT.",revenue:"$10.5M-$14M",color:"#4ade80",items:["30-40 installers","Franchise model launched","Equipment distribution","Courses: national reach"]},
        {year:"2030",label:"$17.5M+",revenue:"$17.5M-$25M+",color:"#f87171",items:["50+ installers × $350K","Multiple revenue streams","3-5 franchise locations","EBITDA: 15-20%"]},
      ].map(({year,label,revenue,color,badge,items})=>(<div key={year} style={{background:"rgba(255,255,255,0.07)",borderRadius:12,padding:14,borderTop:`3px solid ${color}`}}><div style={{fontWeight:900,fontSize:16,color}}>{year}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{label}</div><div style={{fontWeight:800,fontSize:17,color:"#fff",marginBottom:badge?8:12}}>{revenue}</div>{badge&&<div style={{background:color,borderRadius:6,padding:"3px 8px",fontSize:9,fontWeight:800,color:"#fff",textAlign:"center",marginBottom:8}}>{badge}</div>}{items.map((item,i)=><div key={i} style={{fontSize:11,color:"rgba(255,255,255,0.75)",marginBottom:4,lineHeight:1.4}}>• {item}</div>)}</div>))}
    </div>
    <div style={{marginTop:20,padding:14,background:"rgba(232,129,58,0.2)",borderRadius:8,border:`1px solid ${orange}`,textAlign:"center"}}><p style={{color:orange,fontWeight:700,margin:0,fontSize:14}}>The infrastructure is built. The market is moving our way. The question is: how fast do we execute?</p></div>
  </div>
)}

function Slide16(){return(
  <div style={{...navySlide,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",minHeight:620}}>
    <h1 style={{fontSize:44,fontWeight:900,color:"#fff",marginBottom:16}}>The Math Is Simple</h1>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:24,marginBottom:32,width:"100%",maxWidth:900}}>
      {([["$350K","Revenue per installer per year","4 installers operating now"],["$18,000","PSE&G max residential rebate","Instant — we handle all paperwork"],["80%","PSE&G covers commercial projects","Schools, hospitals, multifamily"]] as const).map(([v,l,sub])=>(<div key={v} style={{padding:24,background:"rgba(255,255,255,0.08)",borderRadius:12,border:"1px solid rgba(255,255,255,0.1)"}}><div style={{fontSize:40,fontWeight:900,color:orange}}>{v}</div><div style={{fontSize:13,color:"rgba(255,255,255,0.8)",marginTop:8,fontWeight:600}}>{l}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginTop:4}}>{sub}</div></div>))}
    </div>
    <div style={{background:orange,borderRadius:12,padding:"16px 32px",marginBottom:28}}><p style={{color:"#fff",fontWeight:900,fontSize:20,margin:0}}>2026 GOAL: 8 INSTALLERS × $350K = $2.8M REVENUE</p></div>
    <p style={{fontSize:18,color:"rgba(255,255,255,0.8)",maxWidth:700,lineHeight:1.7,marginBottom:32}}>Every installer adds $350,000 to top line.<br/>PSE&G rebates reduce customer costs significantly. At $2.5M, Mobilization Funding unlocks.<br/><strong style={{color:"#fff"}}>The #1 constraint is project funding. We bridge this with supplier credit, 3rd party financing (Option 1), and Mobilization Funding at $2.5M gross revenue.</strong></p>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,width:"100%",maxWidth:600}}>
      <div style={{padding:16,background:"rgba(255,255,255,0.08)",borderRadius:8,border:"1px solid rgba(255,255,255,0.15)"}}><div style={{fontWeight:700,color:"#fff",marginBottom:4}}>Mechanical Enterprise LLC</div><div style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>(862) 423-9396</div><div style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>sales@mechanicalenterprise.com</div><div style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>mechanicalenterprise.com</div></div>
      <div style={{padding:16,background:orange,borderRadius:8}}><div style={{fontWeight:700,color:"#fff",marginBottom:4}}>PSE&G Trade Ally</div><div style={{fontSize:13,color:"rgba(255,255,255,0.9)"}}>WMBE/SBE Certified</div><div style={{fontSize:13,color:"rgba(255,255,255,0.9)"}}>Newark, NJ · 15 Counties</div><div style={{fontSize:13,color:"rgba(255,255,255,0.9)"}}>March 31, 2026</div></div>
    </div>
  </div>
)}

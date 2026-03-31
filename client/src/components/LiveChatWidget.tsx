import { useState, useEffect, useRef, useCallback } from "react";

/* ── Types ─────────────────────────────────────────────────────────── */
type ChatMessage = { role: "user" | "assistant"; text: string };
type FlowCategory = "residential" | "commercial" | "careers" | "partnership" | "courses" | null;
type MenuLevel =
  | "main" | "residential" | "commercial" | "careers" | "partnership" | "courses"
  | "booking-choice" | "booking-assessment" | "booking-rebate"
  | "booking-apply" | "booking-call-hr" | "booking-partner-call" | "booking-partner-email"
  | "booking-course" | "booking-course-email" | "booking-commercial-rebate"
  | "service-form"
  | "question" | "none";

/* ── Constants ─────────────────────────────────────────────────────── */
const NAVY = "#0a1628";
const ORANGE = "#e8813a";
const ORANGE_HOVER = "#d5732f";
const PHONE = "(862) 419-1763";
const PHONE_TEL = "tel:+18624191763";
const EMAIL = "sales@mechanicalenterprise.com";
const EMAIL_HREF = "mailto:sales@mechanicalenterprise.com";
const BASE = "https://mechanicalenterprise.com";
const ASSESSMENT_URL = `${BASE}/qualify`;
const REBATE_URL = `${BASE}/rebate-calculator`;
const COMMERCIAL_REBATE_URL = `${BASE}/commercial#rebate-calculator`;
const CAREERS_URL = `${BASE}/careers`;
const COURSES_URL = `${BASE}/courses`;
const PARTNERSHIPS_URL = `${BASE}/partnerships#apply`;
/* ── Stripe payment links (placeholders — replace with real links) ── */
const STRIPE_RESIDENTIAL_STANDARD = "https://buy.stripe.com/7sY8wIcuM0hz7M17I40oM03";
const STRIPE_RESIDENTIAL_EMERGENCY = "https://buy.stripe.com/aFaeV6dyQ1lDgix1jG0oM02";
const STRIPE_COMMERCIAL_STANDARD = "https://buy.stripe.com/8x2aEQ3Yg7K14zP5zW0oM01";
const STRIPE_COMMERCIAL_EMERGENCY = "https://buy.stripe.com/5kQaEQfGYaWd9U90fC0oM00";

const LEAD_FORM_THRESHOLD = 3;
const AUTO_OPEN_MS = 8_000;
const AUTO_OPEN_KEY = "me_chat_auto_opened";
const GREETING = "Hi! I'm Jessica from Mechanical Enterprise. 👋 How can I help you today?";

/* ── Service options that go straight to inline form ────────────────── */
const SERVICE_OPTIONS = new Set([
  "🔧 Service Call ($100)", "🚨 Emergency ($175)", "🔄 Maintenance Plan",
  "🔧 Service & Repair", "🚨 Emergency ($175)",
]);

/* ── Quick-reply menus ─────────────────────────────────────────────── */
const MAIN_MENU = ["🏠 Residential", "🏢 Commercial", "💼 Careers", "🤝 Partnership", "📚 Courses"];

const FOLLOW_UP_CONFIG: Record<string, { reply: string; buttons: string[] }> = {
  "🏠 Residential": {
    reply: "Great! What do you need help with for your home?",
    buttons: ["🆓 Free Assessment", "🔧 Service Call ($100)", "🚨 Emergency ($175)", "💰 Rebate Calculator", "🔄 Maintenance Plan"],
  },
  "🏢 Commercial": {
    reply: "Got it! What can we help with for your commercial property?",
    buttons: ["🆓 Free Assessment", "🏭 VRV/VRF Systems", "🔧 Service & Repair", "🚨 Emergency ($175)", "💸 80% Rebates", "💰 Rebate Calculator"],
  },
  "💼 Careers": {
    reply: "We're hiring across NJ! What would you like to know?",
    buttons: ["🔩 HVAC Technician", "🏢 Commercial Tech", "📋 Apply Now", "💰 Pay & Benefits"],
  },
  "🤝 Partnership": {
    reply: "Awesome! We have several partnership programs. Which interests you?",
    buttons: ["🤝 Referral Partner ($200-$500)", "🏘️ Property Manager Program", "🏗️ Contractor Program", "📞 Talk to Someone"],
  },
  "📚 Courses": {
    reply: "We offer HVAC training and certification courses. What are you looking for?",
    buttons: ["📜 Certifications", "🎓 Training Programs", "📅 Upcoming Schedule", "💲 Pricing"],
  },
};

const MENU_KEY_MAP: Record<string, MenuLevel> = {
  "🏠 Residential": "residential", "🏢 Commercial": "commercial",
  "💼 Careers": "careers", "🤝 Partnership": "partnership", "📚 Courses": "courses",
};
const CATEGORY_MAP: Record<string, FlowCategory> = {
  "🏠 Residential": "residential", "🏢 Commercial": "commercial",
  "💼 Careers": "careers", "🤝 Partnership": "partnership", "📚 Courses": "courses",
};

/* ── Follow-up one-liners ──────────────────────────────────────────── */
const FOLLOW_UP_REPLIES: Record<string, string> = {
  "🆓 Free Assessment": "Perfect! A free assessment takes about 60 min and we handle all rebate paperwork.",
  "🔧 Service Call ($100)": "Got it — $100 flat rate, no hourly fees. Fill out the form below and we'll get you scheduled.",
  "🚨 Emergency ($175)": "We respond in 2-4 hours. $175 flat rate. Fill out the form and we'll call you right back.",
  "💰 Rebate Calculator": "Check your estimate instantly — up to $16,000 residential, 80% commercial.",
  "🔄 Maintenance Plan": "Plans start at $19/mo — includes priority scheduling plus 15% off repairs. Book below!",
  "🏭 VRV/VRF Systems": "We're one of NJ's top VRV/VRF specialists — ideal for multi-zone buildings.",
  "🔧 Service & Repair": "We service all commercial HVAC brands with same-day availability. $200 flat rate — fill out the form below.",
  "💸 80% Rebates": "Commercial properties can qualify for rebates covering up to 80% of upgrade costs.",
  "🔩 HVAC Technician": "Residential techs earn $55K-$85K with full benefits and a take-home van.",
  "🏢 Commercial Tech": "Commercial techs start at $70K-$110K — VRF experience is a plus but we also train.",
  "📋 Apply Now": "Great — let's get your application started!",
  "💰 Pay & Benefits": "Top-of-market pay, health/dental/vision, 401k match, and paid training.",
  "🤝 Referral Partner ($200-$500)": "Earn $200-$500 per qualified referral — we handle everything after the intro.",
  "🏘️ Property Manager Program": "Property managers get priority service, volume pricing, and a dedicated account rep.",
  "🏗️ Contractor Program": "We sub-contract HVAC for GCs across NJ — licensed, insured, and always on schedule.",
  "📞 Talk to Someone": "Fill out the form and we'll be in touch within 24-48 hours!",
  "📜 Certifications": "We offer EPA 608, OSHA 30, and manufacturer-specific certifications.",
  "🎓 Training Programs": "Hands-on training from working master technicians — classes run monthly.",
  "📅 Upcoming Schedule": "Next sessions start in two weeks — spots fill fast so booking early is best.",
  "💲 Pricing": "Courses range from $299-$1,499 depending on certification level. Group discounts available.",
};

const BOOKING_PROMPT: Record<string, string> = {
  residential: "What would you like to do next?", commercial: "What would you like to do next?",
  careers: "Ready to take the next step?", partnership: "How would you like to connect?", courses: "What would you like to do next?",
};

/* ── Jessica's free-text responses ─────────────────────────────────── */
const JESSICA_FREETEXT = [
  "That's a great question — let me help with that. Would you like to book a time to discuss in detail?",
  "Absolutely, happy to clarify. Want me to set up a quick call with one of our specialists?",
  "Good point! Our team can dive deeper on a call — want to book one?",
  "Sure thing! For the most accurate info, I'd recommend a quick consult. Want to schedule one?",
  "I hear you! Let me connect you with someone who can walk through all the details.",
];
function getFreetextReply(i: number) { return JESSICA_FREETEXT[Math.min(i, JESSICA_FREETEXT.length - 1)]; }

/* ── Styles ────────────────────────────────────────────────────────── */
const quickReplyStyle: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 20, border: `1.5px solid ${ORANGE}`,
  background: "#fff", color: NAVY, fontSize: 13, fontWeight: 500,
  cursor: "pointer", transition: "background 0.15s, color 0.15s", whiteSpace: "nowrap",
};
const primaryBtnStyle: React.CSSProperties = {
  width: "100%", padding: "12px 16px", borderRadius: 12, border: "none",
  background: ORANGE, color: "#fff", fontSize: 15, fontWeight: 600,
  cursor: "pointer", transition: "background 0.15s", textDecoration: "none",
  textAlign: "center" as const, display: "block",
};
const secondaryBtnStyle: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 20, border: `1.5px solid ${ORANGE}`,
  background: "#fff", color: NAVY, fontSize: 13, fontWeight: 500,
  cursor: "pointer", transition: "background 0.15s, color 0.15s",
};
const callLinkStyle: React.CSSProperties = { fontSize: 13, color: "#666", textAlign: "center" as const, marginTop: 2 };
const inputFieldStyle: React.CSSProperties = { padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" as const };
const selectStyle: React.CSSProperties = { ...inputFieldStyle, background: "#fff", appearance: "auto" as const };
const formCardStyle: React.CSSProperties = { background: "#fff", border: `2px solid ${ORANGE}`, borderRadius: 12, padding: 16, marginTop: 4 };

const hoverOrange = {
  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = ORANGE; e.currentTarget.style.color = "#fff"; },
  onMouseLeave: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = NAVY; },
};
const hoverOrangeBg = {
  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = ORANGE_HOVER; },
  onMouseLeave: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = ORANGE; },
};
const hoverNavy = {
  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = NAVY; e.currentTarget.style.color = "#fff"; },
  onMouseLeave: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = NAVY; },
};
const focusBorder = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = ORANGE; },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = "#ddd"; },
};

/* ── Component ─────────────────────────────────────────────────────── */
export default function LiveChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: GREETING }]);
  const [input, setInput] = useState("");
  const [userMsgCount, setUserMsgCount] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [menuLevel, setMenuLevel] = useState<MenuLevel>("main");
  const [flowCategory, setFlowCategory] = useState<FlowCategory>(null);
  const [freetextCount, setFreetextCount] = useState(0);
  const [pendingBooking, setPendingBooking] = useState(false);

  // Service booking form state
  const [svcName, setSvcName] = useState("");
  const [svcPhone, setSvcPhone] = useState("");
  const [svcEmail, setSvcEmail] = useState("");
  const [svcAddress, setSvcAddress] = useState("");
  const [svcType, setSvcType] = useState("AC Repair");
  const [svcEmergency, setSvcEmergency] = useState(false);
  const [svcDate, setSvcDate] = useState("");
  const [svcMessage, setSvcMessage] = useState("");
  const [svcSubmitting, setSvcSubmitting] = useState(false);
  const [svcSubmitted, setSvcSubmitted] = useState(false);
  const [svcValidationError, setSvcValidationError] = useState(false);
  // Commercial-only fields
  const [svcCompany, setSvcCompany] = useState("");
  const [svcPropertyType, setSvcPropertyType] = useState("Office Building");
  const [svcSqft, setSvcSqft] = useState("Under 2,000 sq ft");
  const [svcFloors, setSvcFloors] = useState("");
  const [svcCurrentSystem, setSvcCurrentSystem] = useState("Unknown");
  const [svcServiceNeeded, setSvcServiceNeeded] = useState("Repair");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoOpenFired = useRef(false);

  const isCommercial = flowCategory === "commercial";

  /* ── auto-open ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (autoOpenFired.current) return;
    if (sessionStorage.getItem(AUTO_OPEN_KEY)) return;
    autoOpenFired.current = true;
    const t = setTimeout(() => { setOpen(true); sessionStorage.setItem(AUTO_OPEN_KEY, "1"); }, AUTO_OPEN_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping, showForm, menuLevel, svcSubmitted]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 200); }, [open]);

  /* ── helpers ───────────────────────────────────────────────────── */
  const typeThen = (ms: number, cb: () => void) => {
    setIsTyping(true);
    setTimeout(() => { setIsTyping(false); cb(); }, ms + Math.random() * 400);
  };
  const triggerLeadForm = useCallback(() => { if (!formSubmitted) setShowForm(true); }, [formSubmitted]);

  const resetChat = useCallback(() => {
    setMessages([{ role: "assistant", text: GREETING }]);
    setShowForm(false); setPendingBooking(false); setUserMsgCount(0); setFreetextCount(0);
    setSvcSubmitted(false); setSvcName(""); setSvcPhone(""); setSvcEmail("");
    setSvcAddress(""); setSvcType("AC Repair"); setSvcEmergency(false); setSvcDate("");
    setSvcMessage(""); setSvcCompany(""); setSvcPropertyType("Office Building");
    setSvcSqft("Under 2,000 sq ft"); setSvcFloors(""); setSvcCurrentSystem("Unknown");
    setSvcServiceNeeded("Repair"); setSvcValidationError(false);
  }, []);

  /* ── main menu click ───────────────────────────────────────────── */
  const handleMainMenuClick = useCallback((label: string) => {
    const config = FOLLOW_UP_CONFIG[label];
    if (!config) return;
    resetChat();
    setFlowCategory(CATEGORY_MAP[label] ?? null);
    setMessages([{ role: "assistant", text: GREETING }, { role: "user", text: label }]);
    typeThen(600, () => {
      setMessages((p) => [...p, { role: "assistant", text: config.reply }]);
      setMenuLevel(MENU_KEY_MAP[label] ?? "none");
    });
  }, [resetChat]);

  /* ── Direct-link options (skip booking choice) ─────────────────── */
  /* ── Options that skip to a direct CTA link ─────────────────────── */
  const getDirectLinkOption = (label: string): { reply: string; menu: MenuLevel } | null => {
    if (label === "💰 Rebate Calculator" || label === "💸 80% Rebates") {
      if (flowCategory === "commercial") {
        return { reply: "Our commercial rebate calculator estimates your savings based on building size, current system, and property type.", menu: "booking-commercial-rebate" };
      }
      return { reply: "Check your estimate instantly — up to $16,000 residential, 80% commercial.", menu: "booking-rebate" };
    }
    return null;
  };

  /* ── follow-up click ───────────────────────────────────────────── */
  const handleFollowUpClick = useCallback((label: string) => {
    const reply = FOLLOW_UP_REPLIES[label];
    if (!reply) return;

    setMessages((p) => [...p, { role: "user", text: label }]);
    setMenuLevel("none");
    setUserMsgCount((c) => c + 1);

    // Direct link (rebate calc)
    const direct = getDirectLinkOption(label);
    if (direct) {
      typeThen(600, () => { setMessages((p) => [...p, { role: "assistant", text: direct.reply }]); setMenuLevel(direct.menu); });
      return;
    }

    // Service options → inline form
    if (SERVICE_OPTIONS.has(label)) {
      if (label.includes("Emergency")) setSvcEmergency(true);
      if (label.includes("Maintenance")) setSvcType("Maintenance");
      else if (label.includes("Service") || label.includes("Repair")) setSvcType("Repair");
      typeThen(600, () => { setMessages((p) => [...p, { role: "assistant", text: reply }]); setMenuLevel("service-form"); });
      return;
    }

    // Careers → all options go straight to careers link
    if (flowCategory === "careers") {
      typeThen(600, () => { setMessages((p) => [...p, { role: "assistant", text: reply }]); setMenuLevel("booking-apply"); });
      return;
    }

    // Partnership → all options go straight to partnership apply link
    if (flowCategory === "partnership") {
      typeThen(600, () => { setMessages((p) => [...p, { role: "assistant", text: reply }]); setMenuLevel("booking-partner-call"); });
      return;
    }

    // Normal flow → booking choice
    typeThen(600, () => {
      setMessages((p) => [...p, { role: "assistant", text: reply }]);
      typeThen(500, () => {
        setMessages((p) => [...p, { role: "assistant", text: BOOKING_PROMPT[flowCategory ?? "residential"] ?? "What would you like to do next?" }]);
        setMenuLevel("booking-choice");
      });
    });
  }, [userMsgCount, flowCategory]);

  /* ── booking choice buttons ────────────────────────────────────── */
  const getBookingChoiceButtons = (): { label: string; handler: () => void }[] => {
    switch (flowCategory) {
      case "careers": return [
        { label: "📋 Apply Online Now", handler: () => handleFinalAction("📋 Apply Online Now", "Here's the link to apply — it only takes a few minutes!", "booking-apply") },
        { label: "📞 Schedule a Call with HR", handler: () => handleFinalAction("📞 Schedule a Call with HR", "We'll have someone from our team reach out to you!", "booking-call-hr") },
      ];
      case "partnership": return [
        { label: "📅 Schedule a Partner Call", handler: () => handleFinalAction("📅 Schedule a Partner Call", "Let's get a call on the books with our partnerships team!", "booking-partner-call") },
        { label: "📧 Email Us About Partnership", handler: () => handleFinalAction("📧 Email Us About Partnership", "Drop us a line and we'll get back to you within 24 hours!", "booking-partner-email") },
      ];
      case "courses": return [
        { label: "📅 Book a Course", handler: () => handleFinalAction("📅 Book a Course", "Here's where you can browse and book our courses!", "booking-course") },
        { label: "📧 Get Course Info by Email", handler: () => handleFinalAction("📧 Get Course Info by Email", "We'll send you all the details — just leave your info below!", "booking-course-email") },
      ];
      default: return [
        { label: "📋 Schedule a Free Assessment", handler: () => handleFinalAction("📋 Schedule a Free Assessment", "Here's your direct booking link — takes 2 minutes!", "booking-assessment") },
        { label: "💰 See How Much I Qualify For", handler: () => handleFinalAction("💰 See How Much I Qualify For", "Check your rebate estimate instantly — up to $16,000 for residential, 80% for commercial.", "booking-rebate") },
      ];
    }
  };

  const handleFinalAction = useCallback((userText: string, jessicaText: string, nextMenu: MenuLevel) => {
    setMessages((p) => [...p, { role: "user", text: userText }]);
    setMenuLevel("none");
    typeThen(600, () => { setMessages((p) => [...p, { role: "assistant", text: jessicaText }]); setMenuLevel(nextMenu); });
  }, []);

  const handleQuestionClick = useCallback(() => { setMenuLevel("question"); setPendingBooking(true); setTimeout(() => inputRef.current?.focus(), 100); }, []);

  /* ── free-text send ────────────────────────────────────────────── */
  const send = useCallback(() => {
    const text = input.trim(); if (!text) return; setInput("");
    const nc = userMsgCount + 1; setUserMsgCount(nc);
    setMessages((p) => [...p, { role: "user", text }]); setMenuLevel("none");
    const fi = freetextCount; setFreetextCount((c) => c + 1);
    typeThen(1000, () => {
      setMessages((p) => [...p, { role: "assistant", text: getFreetextReply(fi) }]);
      typeThen(500, () => {
        setMessages((p) => [...p, { role: "assistant", text: BOOKING_PROMPT[flowCategory ?? "residential"] ?? "What would you like to do next?" }]);
        setMenuLevel("booking-choice");
      });
      setPendingBooking(false);
      if (nc >= LEAD_FORM_THRESHOLD) triggerLeadForm();
    });
  }, [input, userMsgCount, freetextCount, flowCategory, triggerLeadForm]);

  const handleBack = useCallback(() => {
    setMessages((p) => [...p, { role: "assistant", text: "No problem! What else can I help you with?" }]);
    setMenuLevel("main"); setPendingBooking(false); setFlowCategory(null);
  }, []);

  const getFollowUpButtons = (): string[] | null => {
    const m: Record<string, string> = { residential: "🏠 Residential", commercial: "🏢 Commercial", careers: "💼 Careers", partnership: "🤝 Partnership", courses: "📚 Courses" };
    const l = m[menuLevel]; return l ? (FOLLOW_UP_CONFIG[l]?.buttons ?? null) : null;
  };

  /* ── submit lead form ──────────────────────────────────────────── */
  const submitLeadForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim() || !formEmail.trim()) return;
    setSubmitting(true);
    const transcript = messages.map((m) => `${m.role === "user" ? "Visitor" : "Jessica"}: ${m.text}`).join("\n");
    try { await fetch("/.netlify/functions/sendCallRecap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: formName.trim(), phone: formPhone.trim(), caller_email: formEmail.trim(), message: [...messages].reverse().find((m) => m.role === "user")?.text ?? "", transcript }) }); } catch {}
    setShowForm(false); setFormSubmitted(true); setSubmitting(false);
    setMessages((p) => [...p, { role: "assistant", text: `Thanks, ${formName.trim()}! We'll reach out shortly. Anything else I can help with?` }]);
  };

  /* ── validate service form ──────────────────────────────────────── */
  const isValidPhone = (p: string) => /^[\d\s()+-]{7,}$/.test(p.trim());
  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const validateServiceForm = (): boolean => {
    if (!svcName.trim() || !svcPhone.trim() || !svcEmail.trim() || !svcAddress.trim()) return false;
    if (!isValidPhone(svcPhone)) return false;
    if (!isValidEmail(svcEmail)) return false;
    if (isCommercial && !svcCompany.trim()) return false;
    return true;
  };

  /* ── build service form summary ──────────────────────────────── */
  const buildServiceSummary = (): string => {
    const lines = [
      `Name: ${svcName.trim()}`,
      `Phone: ${svcPhone.trim()}`,
      `Email: ${svcEmail.trim()}`,
      `Address: ${svcAddress.trim()}`,
    ];
    if (isCommercial) {
      lines.push(`Company: ${svcCompany.trim()}`);
      lines.push(`Property Type: ${svcPropertyType}`);
      lines.push(`Square Footage: ${svcSqft}`);
      if (svcFloors) lines.push(`Floors: ${svcFloors}`);
      lines.push(`Current HVAC: ${svcCurrentSystem}`);
      lines.push(`Service Needed: ${svcServiceNeeded}`);
    } else {
      lines.push(`Service Type: ${svcType}`);
    }
    lines.push(`Emergency: ${svcEmergency ? "Yes" : "No"}`);
    if (svcDate) lines.push(`Preferred Date: ${svcDate}`);
    if (svcMessage.trim()) lines.push(`Details: ${svcMessage.trim()}`);
    lines.push(`Price: ${svcEmergency ? emergencyPrice : regularPrice} flat rate`);
    return lines.join("\n");
  };

  /* ── submit service form + open Stripe ────────────────────────── */
  const handlePayAndBook = async () => {
    if (!validateServiceForm()) {
      setSvcValidationError(true);
      setTimeout(() => setSvcValidationError(false), 600);
      return;
    }
    setSvcSubmitting(true);

    const appointmentType = isCommercial ? "Commercial Service Call" : "Residential Service Call";
    const payload = {
      caller_name: svcName.trim(),
      caller_phone: svcPhone.trim(),
      caller_email: svcEmail.trim(),
      appointment_type: appointmentType,
      call_summary: buildServiceSummary(),
      outcome: "booked",
      transcript: messages.map((m) => `${m.role === "user" ? "Visitor" : "Jessica"}: ${m.text}`).join("\n"),
    };

    try { await fetch("/.netlify/functions/sendCallRecap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); } catch {}

    // Open Stripe payment link
    let stripeUrl: string;
    if (isCommercial) {
      stripeUrl = svcEmergency ? STRIPE_COMMERCIAL_EMERGENCY : STRIPE_COMMERCIAL_STANDARD;
    } else {
      stripeUrl = svcEmergency ? STRIPE_RESIDENTIAL_EMERGENCY : STRIPE_RESIDENTIAL_STANDARD;
    }
    window.open(stripeUrl, "_blank", "noopener");

    setSvcSubmitting(false); setSvcSubmitted(true);
    setMenuLevel("none");
    setMessages((p) => [...p, { role: "assistant", text: `✅ Booked! We'll confirm within 1 hour. Questions? Call ${PHONE}` }]);
  };

  /* ── pricing helpers ───────────────────────────────────────────── */
  const emergencyPrice = isCommercial ? "$275" : "$175";
  const regularPrice = isCommercial ? "$200" : "$100";

  /* ── render ────────────────────────────────────────────────────── */
  const followUpButtons = getFollowUpButtons();
  const isFollowUpMenu = followUpButtons !== null;
  const showBackButton = menuLevel !== "main" && menuLevel !== "none" && menuLevel !== "question" && menuLevel !== "service-form" && !isTyping;

  return (
    <>
      {/* ── Floating bubble ──────────────────────────────────────── */}
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Open chat"
          style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, width: 60, height: 60, borderRadius: "50%", background: ORANGE, border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.2s, box-shadow 0.2s" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 6px 28px rgba(0,0,0,0.3)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.25)"; }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        </button>
      )}

      {/* ── Chat panel ───────────────────────────────────────────── */}
      {open && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, width: 380, maxWidth: "calc(100vw - 32px)", height: 520, maxHeight: "calc(100vh - 48px)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,0.25)", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
          {/* Header */}
          <div style={{ background: NAVY, color: "#fff", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>J</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>Jessica</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Mechanical Enterprise • Online</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 4, fontSize: 20, lineHeight: 1, opacity: 0.7 }} onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}>✕</button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16, background: "#f7f8fa", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: msg.role === "user" ? ORANGE : "#fff", color: msg.role === "user" ? "#fff" : NAVY, fontSize: 14, lineHeight: 1.5, boxShadow: msg.role === "user" ? "none" : "0 1px 3px rgba(0,0,0,0.08)" }}>{msg.text}</div>
              </div>
            ))}

            {isTyping && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ padding: "10px 14px", borderRadius: "14px 14px 14px 4px", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", display: "flex", gap: 4, alignItems: "center" }}>
                  {[0, 1, 2].map((d) => (<span key={d} style={{ width: 7, height: 7, borderRadius: "50%", background: NAVY, opacity: 0.4, animation: `me-bounce 1.2s ${d * 0.2}s infinite` }} />))}
                </div>
              </div>
            )}

            {/* Main menu */}
            {menuLevel === "main" && !isTyping && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {MAIN_MENU.map((l) => (<button key={l} onClick={() => handleMainMenuClick(l)} style={quickReplyStyle} {...hoverOrange}>{l}</button>))}
              </div>
            )}

            {/* Follow-up menu */}
            {isFollowUpMenu && !isTyping && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {followUpButtons.map((l) => (<button key={l} onClick={() => handleFollowUpClick(l)} style={quickReplyStyle} {...hoverOrange}>{l}</button>))}
              </div>
            )}

            {/* Booking choice */}
            {menuLevel === "booking-choice" && !isTyping && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {getBookingChoiceButtons().map(({ label, handler }) => (<button key={label} onClick={handler} style={secondaryBtnStyle} {...hoverOrange}>{label}</button>))}
                <button onClick={handleQuestionClick} style={secondaryBtnStyle} {...hoverOrange}>❓ I have a question first</button>
              </div>
            )}

            {/* Final CTAs */}
            {menuLevel === "booking-assessment" && !isTyping && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                <a href={ASSESSMENT_URL} target="_blank" rel="noopener noreferrer" style={primaryBtnStyle} {...hoverOrangeBg}>📅 Book Free Assessment →</a>
                <div style={callLinkStyle}>Or call us directly: <a href={PHONE_TEL} style={{ color: ORANGE, textDecoration: "none", fontWeight: 500 }}>{PHONE}</a></div>
              </div>
            )}
            {menuLevel === "booking-rebate" && !isTyping && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                <a href={REBATE_URL} target="_blank" rel="noopener noreferrer" style={primaryBtnStyle} {...hoverOrangeBg}>💰 Open Rebate Calculator →</a>
                <div style={callLinkStyle}>Or call us directly: <a href={PHONE_TEL} style={{ color: ORANGE, textDecoration: "none", fontWeight: 500 }}>{PHONE}</a></div>
              </div>
            )}
            {menuLevel === "booking-commercial-rebate" && !isTyping && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                <a href={COMMERCIAL_REBATE_URL} target="_blank" rel="noopener noreferrer" style={primaryBtnStyle} {...hoverOrangeBg}>💰 Calculate My Commercial Rebate →</a>
                <div style={callLinkStyle}>Or call us directly: <a href={PHONE_TEL} style={{ color: ORANGE, textDecoration: "none", fontWeight: 500 }}>{PHONE}</a></div>
              </div>
            )}
            {menuLevel === "booking-apply" && !isTyping && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                <a href={CAREERS_URL} target="_blank" rel="noopener noreferrer" style={primaryBtnStyle} {...hoverOrangeBg}>💼 View Open Positions →</a>
                <div style={callLinkStyle}>Or call us directly: <a href={PHONE_TEL} style={{ color: ORANGE, textDecoration: "none", fontWeight: 500 }}>{PHONE}</a></div>
              </div>
            )}
            {menuLevel === "booking-call-hr" && !isTyping && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                <a href={PHONE_TEL} style={primaryBtnStyle} {...hoverOrangeBg}>📞 Call HR: {PHONE}</a>
                <div style={callLinkStyle}>Or email us: <a href={EMAIL_HREF} style={{ color: ORANGE, textDecoration: "none", fontWeight: 500 }}>{EMAIL}</a></div>
              </div>
            )}
            {menuLevel === "booking-partner-call" && !isTyping && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                <a href={PARTNERSHIPS_URL} target="_blank" rel="noopener noreferrer" style={primaryBtnStyle} {...hoverOrangeBg}>🤝 Apply to Become a Partner →</a>
                <div style={callLinkStyle}>Or call us directly: <a href={PHONE_TEL} style={{ color: ORANGE, textDecoration: "none", fontWeight: 500 }}>{PHONE}</a></div>
              </div>
            )}
            {menuLevel === "booking-partner-email" && !isTyping && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                <a href={EMAIL_HREF} style={primaryBtnStyle} {...hoverOrangeBg}>📧 Email Our Partnership Team →</a>
                <div style={callLinkStyle}>Or call us directly: <a href={PHONE_TEL} style={{ color: ORANGE, textDecoration: "none", fontWeight: 500 }}>{PHONE}</a></div>
              </div>
            )}
            {menuLevel === "booking-course" && !isTyping && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                <a href={COURSES_URL} target="_blank" rel="noopener noreferrer" style={primaryBtnStyle} {...hoverOrangeBg}>📅 Browse & Book Courses →</a>
                <div style={callLinkStyle}>Or call us directly: <a href={PHONE_TEL} style={{ color: ORANGE, textDecoration: "none", fontWeight: 500 }}>{PHONE}</a></div>
              </div>
            )}
            {menuLevel === "booking-course-email" && !isTyping && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                <a href={EMAIL_HREF} style={primaryBtnStyle} {...hoverOrangeBg}>📧 Request Course Info →</a>
                <div style={callLinkStyle}>Or call us directly: <a href={PHONE_TEL} style={{ color: ORANGE, textDecoration: "none", fontWeight: 500 }}>{PHONE}</a></div>
              </div>
            )}

            {/* ── INLINE SERVICE BOOKING FORM ────────────────────── */}
            {menuLevel === "service-form" && !isTyping && !svcSubmitted && (
              <div style={{ ...formCardStyle, animation: svcValidationError ? "me-shake 0.4s" : undefined }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: NAVY, marginBottom: 2 }}>
                  {isCommercial ? "Book Commercial Service" : "Book Service Call"}
                </div>
                {svcEmergency ? (
                  <div style={{ fontSize: 13, color: "#d63c3c", fontWeight: 600, marginBottom: 10 }}>
                    🚨 Emergency Rate: {emergencyPrice} flat — 2-4 hr response
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>
                    ✅ Standard Rate: {regularPrice} flat — scheduled appointment
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* Required fields with * */}
                  <input type="text" placeholder="Full Name *" value={svcName} onChange={(e) => setSvcName(e.target.value)}
                    style={{ ...inputFieldStyle, borderColor: svcValidationError && !svcName.trim() ? "#d63c3c" : "#ddd" }} {...focusBorder} />
                  <input type="tel" placeholder="Phone *" value={svcPhone} onChange={(e) => setSvcPhone(e.target.value)}
                    style={{ ...inputFieldStyle, borderColor: svcValidationError && (!svcPhone.trim() || !isValidPhone(svcPhone)) ? "#d63c3c" : "#ddd" }} {...focusBorder} />
                  <input type="email" placeholder="Email *" value={svcEmail} onChange={(e) => setSvcEmail(e.target.value)}
                    style={{ ...inputFieldStyle, borderColor: svcValidationError && (!svcEmail.trim() || !isValidEmail(svcEmail)) ? "#d63c3c" : "#ddd" }} {...focusBorder} />
                  <input type="text" placeholder={isCommercial ? "Property Address *" : "Home Address *"} value={svcAddress} onChange={(e) => setSvcAddress(e.target.value)}
                    style={{ ...inputFieldStyle, borderColor: svcValidationError && !svcAddress.trim() ? "#d63c3c" : "#ddd" }} {...focusBorder} />

                  {/* ── Commercial-only fields ──────────────────────── */}
                  {isCommercial && (
                    <>
                      <input type="text" placeholder="Company Name *" value={svcCompany} onChange={(e) => setSvcCompany(e.target.value)}
                        style={{ ...inputFieldStyle, borderColor: svcValidationError && !svcCompany.trim() ? "#d63c3c" : "#ddd" }} {...focusBorder} />
                      <select value={svcPropertyType} onChange={(e) => setSvcPropertyType(e.target.value)} style={selectStyle} {...focusBorder}>
                        {["Office Building", "Retail Store", "Restaurant", "Healthcare Facility", "Warehouse", "Industrial", "Multi-Family", "Other"].map((o) => <option key={o}>{o}</option>)}
                      </select>
                      <select value={svcSqft} onChange={(e) => setSvcSqft(e.target.value)} style={selectStyle} {...focusBorder}>
                        {["Under 2,000 sq ft", "2,000 – 5,000 sq ft", "5,000 – 10,000 sq ft", "10,000 – 25,000 sq ft", "25,000 – 50,000 sq ft", "50,000+ sq ft"].map((o) => <option key={o}>{o}</option>)}
                      </select>
                      <input type="number" placeholder="Number of Floors" min={1} value={svcFloors} onChange={(e) => setSvcFloors(e.target.value)} style={inputFieldStyle} {...focusBorder} />
                      <select value={svcCurrentSystem} onChange={(e) => setSvcCurrentSystem(e.target.value)} style={selectStyle} {...focusBorder}>
                        {["VRV/VRF", "Chiller", "Rooftop Unit (RTU)", "Split System", "Boiler", "Fan Coil", "Unknown", "Other"].map((o) => <option key={o}>{o}</option>)}
                      </select>
                      <select value={svcServiceNeeded} onChange={(e) => setSvcServiceNeeded(e.target.value)} style={selectStyle} {...focusBorder}>
                        {["Repair", "Emergency Repair", "Maintenance", "New Installation", "System Upgrade", "Inspection", "Other"].map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </>
                  )}

                  {/* ── Residential service type ───────────────────── */}
                  {!isCommercial && (
                    <select value={svcType} onChange={(e) => setSvcType(e.target.value)} style={selectStyle} {...focusBorder}>
                      {["AC Repair", "Heating Repair", "Maintenance", "Installation", "No Heat", "No AC", "Strange Noise", "Leak", "Other"].map((o) => <option key={o}>{o}</option>)}
                    </select>
                  )}

                  {/* ── Emergency toggle ────────────────────────────── */}
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: NAVY, cursor: "pointer" }}>
                    <input type="checkbox" checked={svcEmergency} onChange={(e) => setSvcEmergency(e.target.checked)} style={{ accentColor: ORANGE, width: 18, height: 18 }} />
                    Is this an emergency?
                  </label>

                  <input type="date" placeholder="Preferred Date" value={svcDate} onChange={(e) => setSvcDate(e.target.value)} style={inputFieldStyle} {...focusBorder} />
                  <textarea placeholder="Additional Details (optional)" value={svcMessage} onChange={(e) => setSvcMessage(e.target.value)} rows={2} style={{ ...inputFieldStyle, resize: "vertical" as const }} {...focusBorder} />

                  {/* ── Price summary box ───────────────────────────── */}
                  <div style={{ border: `2px solid ${ORANGE}`, borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, color: NAVY, fontWeight: 500 }}>
                      {isCommercial ? "Commercial" : ""} {svcEmergency ? "Emergency" : "Service Call"}
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: NAVY }}>
                      {svcEmergency ? emergencyPrice : regularPrice}
                    </span>
                  </div>

                  {/* ── Pay & Book button ───────────────────────────── */}
                  <button type="button" onClick={handlePayAndBook} disabled={svcSubmitting}
                    style={{ padding: "14px", background: ORANGE, color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: svcSubmitting ? "wait" : "pointer", opacity: svcSubmitting ? 0.7 : 1, transition: "background 0.2s", width: "100%" }}
                    onMouseEnter={(e) => { if (!svcSubmitting) e.currentTarget.style.background = ORANGE_HOVER; }}
                    onMouseLeave={(e) => (e.currentTarget.style.background = ORANGE)}
                  >{svcSubmitting ? "Processing…" : "💳 Pay & Confirm Booking"}</button>
                  <div style={{ fontSize: 11, color: "#999", textAlign: "center" }}>Payment secures your appointment slot</div>
                </div>
              </div>
            )}

            {/* Back button */}
            {showBackButton && (
              <div style={{ marginTop: 2 }}>
                <button onClick={handleBack} style={{ ...quickReplyStyle, border: `1.5px solid ${NAVY}`, color: NAVY, fontSize: 12 }} {...hoverNavy}>← Back</button>
              </div>
            )}

            {/* Lead capture form */}
            {showForm && !formSubmitted && (
              <div style={formCardStyle}>
                <div style={{ fontWeight: 600, fontSize: 14, color: NAVY, marginBottom: 4 }}>Want a specialist to follow up?</div>
                <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>Leave your info and we'll reach out shortly!</div>
                <form onSubmit={submitLeadForm} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input type="text" placeholder="Your name" value={formName} onChange={(e) => setFormName(e.target.value)} required style={inputFieldStyle} {...focusBorder} />
                  <input type="tel" placeholder="Phone number" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} required style={inputFieldStyle} {...focusBorder} />
                  <input type="email" placeholder="Email address" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} required style={inputFieldStyle} {...focusBorder} />
                  <button type="submit" disabled={submitting}
                    style={{ padding: "10px", background: ORANGE, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.7 : 1, transition: "background 0.2s" }}
                    onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.background = ORANGE_HOVER; }}
                    onMouseLeave={(e) => (e.currentTarget.style.background = ORANGE)}
                  >{submitting ? "Sending…" : "Get a Call Back"}</button>
                </form>
              </div>
            )}
          </div>

          {/* Input bar */}
          <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: "flex", gap: 8, padding: "10px 12px", background: "#fff", borderTop: "1px solid #eee", flexShrink: 0 }}>
            <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message…"
              style={{ flex: 1, padding: "9px 12px", border: "1px solid #ddd", borderRadius: 20, fontSize: 14, outline: "none" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = ORANGE)} onBlur={(e) => (e.currentTarget.style.borderColor = "#ddd")}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
            />
            <button type="submit" disabled={!input.trim()} aria-label="Send"
              style={{ width: 38, height: 38, borderRadius: "50%", background: input.trim() ? ORANGE : "#ccc", border: "none", cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s", flexShrink: 0 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            </button>
          </form>
        </div>
      )}

      <style>{`
        @keyframes me-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        @keyframes me-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </>
  );
}

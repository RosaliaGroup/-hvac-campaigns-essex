import { useState, useEffect, useRef, useCallback } from "react";

/* ── Types ─────────────────────────────────────────────────────────── */
type ChatMessage = { role: "user" | "assistant"; text: string };
type MenuLevel = "main" | "residential" | "commercial" | "careers" | "partnership" | "courses" | "booking" | "question" | "none";

/* ── Constants ─────────────────────────────────────────────────────── */
const NAVY = "#0a1628";
const ORANGE = "#e8813a";
const ORANGE_HOVER = "#d5732f";
const RED_TINT = "#d63c3c";
const RED_TINT_HOVER = "#c02e2e";
const CALENDLY_URL = "https://calendly.com/mechanicalenterprise";
const PHONE = "(862) 419-1763";
const LEAD_THRESHOLD = 2;
const AUTO_OPEN_MS = 8_000;
const AUTO_OPEN_KEY = "me_chat_auto_opened";

/* ── Quick-reply menus ─────────────────────────────────────────────── */
const MAIN_MENU = [
  "🏠 Residential",
  "🏢 Commercial",
  "💼 Careers",
  "🤝 Partnership",
  "📚 Courses",
];

const FOLLOW_UP_CONFIG: Record<string, { reply: string; buttons: string[] }> = {
  "🏠 Residential": {
    reply: "Great! What do you need help with for your home?",
    buttons: [
      "🆓 Free Assessment",
      "🔧 Service Call ($100)",
      "🚨 Emergency ($175)",
      "💰 Rebate Calculator",
      "🔄 Maintenance Plan",
    ],
  },
  "🏢 Commercial": {
    reply: "Got it! What can we help with for your commercial property?",
    buttons: [
      "🆓 Free Assessment",
      "🏭 VRV/VRF Systems",
      "🔧 Service & Repair",
      "🚨 Emergency ($175)",
      "💸 80% Rebates",
    ],
  },
  "💼 Careers": {
    reply: "We're hiring across NJ! What would you like to know?",
    buttons: [
      "🔩 HVAC Technician",
      "🏢 Commercial Tech",
      "📋 Apply Now",
      "💰 Pay & Benefits",
    ],
  },
  "🤝 Partnership": {
    reply: "Awesome! We have several partnership programs. Which interests you?",
    buttons: [
      "🤝 Referral Partner ($200-$500)",
      "🏘️ Property Manager Program",
      "🏗️ Contractor Program",
      "📞 Talk to Someone",
    ],
  },
  "📚 Courses": {
    reply: "We offer HVAC training and certification courses. What are you looking for?",
    buttons: [
      "📜 Certifications",
      "🎓 Training Programs",
      "📅 Upcoming Schedule",
      "💲 Pricing",
    ],
  },
};

const MENU_KEY_MAP: Record<string, MenuLevel> = {
  "🏠 Residential": "residential",
  "🏢 Commercial": "commercial",
  "💼 Careers": "careers",
  "🤝 Partnership": "partnership",
  "📚 Courses": "courses",
};

/* ── Follow-up responses & booking config per option ───────────────── */
type BookingConfig = {
  jessicaSays: string;
  primaryLabel: string;
  primaryStyle?: "emergency";
  showCallButton?: boolean;
};

const FOLLOW_UP_BOOKING: Record<string, BookingConfig> = {
  // Residential
  "🆓 Free Assessment": { jessicaSays: "Perfect! A free assessment takes about 60 min and we handle all rebate paperwork.", primaryLabel: "📅 Book Free Assessment" },
  "🔧 Service Call ($100)": { jessicaSays: "Got it — $100 flat rate, no hourly fees. Let's get you scheduled.", primaryLabel: "📅 Book Service Call" },
  "🚨 Emergency ($175)": { jessicaSays: `We respond in 2-4 hours. $175 flat rate. Book now and we'll call you right back.`, primaryLabel: "📅 Book Emergency Call", primaryStyle: "emergency", showCallButton: true },
  "💰 Rebate Calculator": { jessicaSays: "NJ homeowners can save up to $16K in rebates right now. Let's find what you qualify for.", primaryLabel: "📅 Book Rebate Consultation" },
  "🔄 Maintenance Plan": { jessicaSays: "Our maintenance plans start at $19/mo and include priority scheduling plus 15% off repairs.", primaryLabel: "📅 Book Maintenance Setup" },
  // Commercial
  "🏭 VRV/VRF Systems": { jessicaSays: "We're one of NJ's top VRV/VRF specialists — ideal for multi-zone commercial buildings.", primaryLabel: "📅 Book Commercial Assessment" },
  "🔧 Service & Repair": { jessicaSays: "We service all commercial HVAC brands with same-day availability most days.", primaryLabel: "📅 Book Commercial Assessment" },
  "💸 80% Rebates": { jessicaSays: "Commercial properties can qualify for rebates covering up to 80% of upgrade costs.", primaryLabel: "📅 Book Commercial Assessment" },
  // Careers
  "🔩 HVAC Technician": { jessicaSays: "Our residential techs earn $55K-$85K with full benefits and a take-home van.", primaryLabel: "📋 Apply Now" },
  "🏢 Commercial Tech": { jessicaSays: "Commercial techs start at $70K-$110K — VRF experience is a plus but we also train.", primaryLabel: "📋 Apply Now" },
  "📋 Apply Now": { jessicaSays: "Great — let's get your application started!", primaryLabel: "📋 Apply Now" },
  "💰 Pay & Benefits": { jessicaSays: "We offer top-of-market pay, health/dental/vision, 401k match, and paid training.", primaryLabel: "📋 Apply Now" },
  // Partnership
  "🤝 Referral Partner ($200-$500)": { jessicaSays: "Earn $200-$500 per qualified referral — we handle everything after the intro.", primaryLabel: "📅 Schedule a Partner Call" },
  "🏘️ Property Manager Program": { jessicaSays: "Property managers get priority service, volume pricing, and a dedicated account rep.", primaryLabel: "📅 Schedule a Partner Call" },
  "🏗️ Contractor Program": { jessicaSays: "We sub-contract HVAC for GCs across NJ — licensed, insured, and always on schedule.", primaryLabel: "📅 Schedule a Partner Call" },
  "📞 Talk to Someone": { jessicaSays: "Let's connect you with our partnerships team.", primaryLabel: "📅 Schedule a Partner Call" },
  // Courses
  "📜 Certifications": { jessicaSays: "We offer EPA 608, OSHA 30, and manufacturer-specific certifications.", primaryLabel: "📅 Book a Course" },
  "🎓 Training Programs": { jessicaSays: "Hands-on training from working master technicians — classes run monthly.", primaryLabel: "📅 Book a Course" },
  "📅 Upcoming Schedule": { jessicaSays: "Next sessions start in two weeks — spots fill fast so booking early is best.", primaryLabel: "📅 Book a Course" },
  "💲 Pricing": { jessicaSays: "Courses range from $299-$1,499 depending on certification level. Group discounts available.", primaryLabel: "📅 Book a Course" },
};

/* ── Jessica's free-text responses ─────────────────────────────────── */
const JESSICA_FREETEXT = [
  "That's a great question — let me help with that. Would you like to book a time to discuss in detail?",
  "Absolutely, happy to clarify. Want me to set up a quick call with one of our specialists?",
  "Good point! I can give you a general answer, but our team can dive deeper on a call. Want to book one?",
  "Sure thing! For the most accurate info, I'd recommend a quick consult. Want to schedule one?",
  "I hear you! Let me connect you with someone who can walk through all the details.",
];

function getFreetextReply(index: number): string {
  return JESSICA_FREETEXT[Math.min(index, JESSICA_FREETEXT.length - 1)];
}

/* ── Shared button styles ──────────────────────────────────────────── */
const quickReplyStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 20,
  border: `1.5px solid ${ORANGE}`,
  background: "#fff",
  color: NAVY,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  transition: "background 0.15s, color 0.15s",
  whiteSpace: "nowrap",
};

const primaryBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 12,
  border: "none",
  background: ORANGE,
  color: "#fff",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 0.15s",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 20,
  border: `1.5px solid ${ORANGE}`,
  background: "#fff",
  color: NAVY,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  transition: "background 0.15s, color 0.15s",
};

/* ── Component ─────────────────────────────────────────────────────── */
export default function LiveChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: "Hi! I'm Jessica from Mechanical Enterprise. 👋 How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [userMsgCount, setUserMsgCount] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [menuLevel, setMenuLevel] = useState<MenuLevel>("main");
  // Track which booking config to show when in "booking" state
  const [activeBooking, setActiveBooking] = useState<BookingConfig | null>(null);
  // Track the parent category so "← Back" works from booking/question states
  const [parentCategory, setParentCategory] = useState<string | null>(null);
  // Track free-text reply count for varied responses
  const [freetextCount, setFreetextCount] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoOpenFired = useRef(false);

  /* ── auto-open on first visit ──────────────────────────────────── */
  useEffect(() => {
    if (autoOpenFired.current) return;
    const already = sessionStorage.getItem(AUTO_OPEN_KEY);
    if (already) return;
    autoOpenFired.current = true;
    const t = setTimeout(() => {
      setOpen(true);
      sessionStorage.setItem(AUTO_OPEN_KEY, "1");
    }, AUTO_OPEN_MS);
    return () => clearTimeout(t);
  }, []);

  /* ── scroll to bottom ──────────────────────────────────────────── */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping, showForm, menuLevel, activeBooking]);

  /* ── focus input when panel opens ──────────────────────────────── */
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  /* ── handle main menu click ────────────────────────────────────── */
  const handleMainMenuClick = useCallback((label: string) => {
    const config = FOLLOW_UP_CONFIG[label];
    if (!config) return;
    setParentCategory(label);
    setMessages((prev) => [...prev, { role: "user", text: label }]);
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [...prev, { role: "assistant", text: config.reply }]);
      setMenuLevel(MENU_KEY_MAP[label] ?? "none");
    }, 600 + Math.random() * 400);
  }, []);

  /* ── handle follow-up click → show booking ─────────────────────── */
  const handleFollowUpClick = useCallback((label: string) => {
    const booking = FOLLOW_UP_BOOKING[label];
    if (!booking) return;

    setMessages((prev) => [...prev, { role: "user", text: label }]);
    setMenuLevel("none");
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [...prev, { role: "assistant", text: booking.jessicaSays }]);
      setActiveBooking(booking);
      setMenuLevel("booking");

      // Count toward lead threshold
      const newCount = userMsgCount + 1;
      setUserMsgCount(newCount);
      if (newCount >= LEAD_THRESHOLD && !formSubmitted) {
        setTimeout(() => setShowForm(true), 800);
      }
    }, 600 + Math.random() * 400);
  }, [userMsgCount, formSubmitted]);

  /* ── handle booking button click ───────────────────────────────── */
  const handleBookingClick = useCallback(() => {
    setMessages((prev) => [...prev, { role: "user", text: "I'd like to book an appointment" }]);
    setMenuLevel("none");
    setActiveBooking(null);
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Great! You can book directly here 👉 Book Now or call us at ${PHONE} and we'll get you scheduled right away!` },
      ]);
      setMenuLevel("none");
      // Show the calendar CTA after the message
      setTimeout(() => {
        setMenuLevel("booking");
        setActiveBooking({ jessicaSays: "", primaryLabel: "📅 Open Booking Calendar", });
      }, 100);
    }, 600 + Math.random() * 400);
  }, []);

  /* ── "I have a question first" ─────────────────────────────────── */
  const handleQuestionClick = useCallback(() => {
    setMenuLevel("question");
    setActiveBooking(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  /* ── send free-text message (from input bar) ───────────────────── */
  const send = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");

    const newCount = userMsgCount + 1;
    setUserMsgCount(newCount);
    setMessages((prev) => [...prev, { role: "user", text }]);

    setIsTyping(true);
    const ftIdx = freetextCount;
    setFreetextCount((c) => c + 1);

    setTimeout(() => {
      setIsTyping(false);
      const reply = getFreetextReply(ftIdx);
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);

      // After free-text response, re-show booking if we had one
      if (activeBooking) {
        setMenuLevel("booking");
      } else {
        // Show a generic booking prompt
        setActiveBooking({ jessicaSays: "", primaryLabel: "📅 Book an Appointment" });
        setMenuLevel("booking");
      }

      if (newCount >= LEAD_THRESHOLD && !formSubmitted) {
        setTimeout(() => setShowForm(true), 800);
      }
    }, 1000 + Math.random() * 800);
  }, [input, userMsgCount, formSubmitted, freetextCount, activeBooking]);

  /* ── back to main menu ─────────────────────────────────────────── */
  const handleBack = useCallback(() => {
    setMessages((prev) => [...prev, { role: "assistant", text: "No problem! What else can I help you with?" }]);
    setMenuLevel("main");
    setActiveBooking(null);
    setParentCategory(null);
  }, []);

  /* ── back to parent category follow-ups ────────────────────────── */
  const handleBackToCategory = useCallback(() => {
    if (!parentCategory) { handleBack(); return; }
    const config = FOLLOW_UP_CONFIG[parentCategory];
    if (!config) { handleBack(); return; }
    setMessages((prev) => [...prev, { role: "assistant", text: "Sure! What else were you looking at?" }]);
    setMenuLevel(MENU_KEY_MAP[parentCategory] ?? "main");
    setActiveBooking(null);
  }, [parentCategory, handleBack]);

  /* ── get current follow-up buttons ─────────────────────────────── */
  const getFollowUpButtons = (): string[] | null => {
    const menuToLabel: Record<string, string> = {
      residential: "🏠 Residential",
      commercial: "🏢 Commercial",
      careers: "💼 Careers",
      partnership: "🤝 Partnership",
      courses: "📚 Courses",
    };
    const label = menuToLabel[menuLevel];
    if (!label) return null;
    return FOLLOW_UP_CONFIG[label]?.buttons ?? null;
  };

  /* ── submit lead form ──────────────────────────────────────────── */
  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) return;
    setSubmitting(true);

    const transcript = messages.map((m) => `${m.role === "user" ? "Visitor" : "Jessica"}: ${m.text}`).join("\n");
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.text ?? "";

    try {
      await fetch("/.netlify/functions/sendCallRecap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim(), phone: formPhone.trim(), message: lastUserMsg, transcript }),
      });
    } catch {
      // silently fail
    }

    setShowForm(false);
    setFormSubmitted(true);
    setSubmitting(false);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: `Thanks, ${formName.trim()}! We'll reach out shortly. Anything else I can help with?` },
    ]);
  };

  /* ── open calendly ─────────────────────────────────────────────── */
  const openCalendly = () => window.open(CALENDLY_URL, "_blank", "noopener");

  /* ── render ────────────────────────────────────────────────────── */
  const followUpButtons = getFollowUpButtons();
  const isFollowUpMenu = followUpButtons !== null;
  const isBookingMenu = menuLevel === "booking" && activeBooking;
  const isEmergency = activeBooking?.primaryStyle === "emergency";
  const showBackButton = menuLevel !== "main" && menuLevel !== "none" && menuLevel !== "question" && !isTyping;

  return (
    <>
      {/* ── Floating bubble ──────────────────────────────────────── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 9999,
            width: 60, height: 60, borderRadius: "50%", background: ORANGE,
            border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 6px 28px rgba(0,0,0,0.3)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.25)"; }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* ── Chat panel ───────────────────────────────────────────── */}
      {open && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          width: 380, maxWidth: "calc(100vw - 32px)", height: 520, maxHeight: "calc(100vh - 48px)",
          borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column",
          boxShadow: "0 8px 40px rgba(0,0,0,0.25)", fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}>
          {/* ── Header ───────────────────────────────────────────── */}
          <div style={{ background: NAVY, color: "#fff", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>J</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>Jessica</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Mechanical Enterprise • Online</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat"
              style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 4, fontSize: 20, lineHeight: 1, opacity: 0.7 }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
            >✕</button>
          </div>

          {/* ── Messages ─────────────────────────────────────────── */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16, background: "#f7f8fa", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "80%", padding: "10px 14px",
                  borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: msg.role === "user" ? ORANGE : "#fff",
                  color: msg.role === "user" ? "#fff" : NAVY,
                  fontSize: 14, lineHeight: 1.5,
                  boxShadow: msg.role === "user" ? "none" : "0 1px 3px rgba(0,0,0,0.08)",
                }}>
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ padding: "10px 14px", borderRadius: "14px 14px 14px 4px", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", display: "flex", gap: 4, alignItems: "center" }}>
                  {[0, 1, 2].map((d) => (
                    <span key={d} style={{ width: 7, height: 7, borderRadius: "50%", background: NAVY, opacity: 0.4, animation: `me-bounce 1.2s ${d * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Main menu buttons ──────────────────────────────── */}
            {menuLevel === "main" && !isTyping && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {MAIN_MENU.map((label) => (
                  <button key={label} onClick={() => handleMainMenuClick(label)} style={quickReplyStyle}
                    onMouseEnter={(e) => { e.currentTarget.style.background = ORANGE; e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = NAVY; }}
                  >{label}</button>
                ))}
              </div>
            )}

            {/* ── Follow-up menu buttons ─────────────────────────── */}
            {isFollowUpMenu && !isTyping && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {followUpButtons.map((label) => (
                    <button key={label} onClick={() => handleFollowUpClick(label)} style={quickReplyStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.background = ORANGE; e.currentTarget.style.color = "#fff"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = NAVY; }}
                    >{label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Booking CTA buttons ────────────────────────────── */}
            {isBookingMenu && !isTyping && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {/* Check if this is the final "Open Booking Calendar" state */}
                {activeBooking.primaryLabel === "📅 Open Booking Calendar" ? (
                  <button onClick={openCalendly}
                    style={{ ...primaryBtnStyle }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = ORANGE_HOVER)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = ORANGE)}
                  >📅 Open Booking Calendar</button>
                ) : (
                  <>
                    {/* Primary booking button */}
                    <button onClick={activeBooking.primaryLabel === "📋 Apply Now" ? () => window.open("/careers", "_blank") : handleBookingClick}
                      style={{ ...primaryBtnStyle, background: isEmergency ? RED_TINT : ORANGE }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = isEmergency ? RED_TINT_HOVER : ORANGE_HOVER)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = isEmergency ? RED_TINT : ORANGE)}
                    >{activeBooking.primaryLabel}</button>

                    {/* Emergency: show call button instead of question */}
                    {activeBooking.showCallButton ? (
                      <a href={`tel:${PHONE.replace(/[^0-9]/g, "")}`}
                        style={{ ...secondaryBtnStyle, textAlign: "center", textDecoration: "none", display: "block" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = ORANGE; e.currentTarget.style.color = "#fff"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = NAVY; }}
                      >📞 Call {PHONE} Now</a>
                    ) : (
                      <button onClick={handleQuestionClick}
                        style={secondaryBtnStyle}
                        onMouseEnter={(e) => { e.currentTarget.style.background = ORANGE; e.currentTarget.style.color = "#fff"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = NAVY; }}
                      >❓ I have a question first</button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Back button (always visible after first selection) ── */}
            {showBackButton && (
              <div style={{ marginTop: 2 }}>
                <button onClick={isBookingMenu ? handleBackToCategory : handleBack}
                  style={{ ...quickReplyStyle, border: `1.5px solid ${NAVY}`, color: NAVY, fontSize: 12 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = NAVY; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = NAVY; }}
                >← Back</button>
              </div>
            )}

            {/* ── Lead capture form ──────────────────────────────── */}
            {showForm && !formSubmitted && (
              <div style={{ background: "#fff", border: `2px solid ${ORANGE}`, borderRadius: 12, padding: 16, marginTop: 4 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: NAVY, marginBottom: 4 }}>Want a specialist to follow up?</div>
                <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>Leave your info and we'll reach out shortly!</div>
                <form onSubmit={submitForm} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input type="text" placeholder="Your name" value={formName} onChange={(e) => setFormName(e.target.value)} required
                    style={{ padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, outline: "none" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = ORANGE)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#ddd")}
                  />
                  <input type="tel" placeholder="Phone number" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} required
                    style={{ padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, outline: "none" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = ORANGE)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#ddd")}
                  />
                  <button type="submit" disabled={submitting}
                    style={{ padding: "10px", background: ORANGE, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.7 : 1, transition: "background 0.2s" }}
                    onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.background = ORANGE_HOVER; }}
                    onMouseLeave={(e) => (e.currentTarget.style.background = ORANGE)}
                  >{submitting ? "Sending…" : "Get a Call Back"}</button>
                </form>
              </div>
            )}
          </div>

          {/* ── Input bar ────────────────────────────────────────── */}
          <form onSubmit={(e) => { e.preventDefault(); send(); }}
            style={{ display: "flex", gap: 8, padding: "10px 12px", background: "#fff", borderTop: "1px solid #eee", flexShrink: 0 }}
          >
            <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              style={{ flex: 1, padding: "9px 12px", border: "1px solid #ddd", borderRadius: 20, fontSize: 14, outline: "none" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = ORANGE)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#ddd")}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
            />
            <button type="submit" disabled={!input.trim()} aria-label="Send"
              style={{ width: 38, height: 38, borderRadius: "50%", background: input.trim() ? ORANGE : "#ccc", border: "none", cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s", flexShrink: 0 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      )}

      <style>{`
        @keyframes me-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";

/* ── Types ─────────────────────────────────────────────────────────── */
type ChatMessage = { role: "user" | "assistant"; text: string };
type MenuLevel = "main" | "residential" | "commercial" | "careers" | "partnership" | "courses" | "none";

/* ── Constants ─────────────────────────────────────────────────────── */
const NAVY = "#0a1628";
const ORANGE = "#e8813a";
const ORANGE_HOVER = "#d5732f";
const LEAD_THRESHOLD = 2; // show form after this many user messages
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

/* ── Jessica's canned responses ────────────────────────────────────── */
const JESSICA_RESPONSES = [
  "Great question! At Mechanical Enterprise we specialize in VRF/VRV systems, heat pumps, and full HVAC solutions for residential and commercial properties across New Jersey. How can I help you today?",
  "I'd love to help! We offer free estimates and there are rebates up to $16,000 available right now. Could you tell me a bit more about what you're looking for?",
  "Absolutely — we handle everything from installations to 24/7 emergency repairs. We're WMBE/SBE certified and serve all 15 NJ counties. Want me to have one of our specialists give you a call?",
  "That's a great point. Many of our customers save 30-50% on energy costs after upgrading to a modern heat pump system. I can connect you with a specialist who can walk you through the options and available rebates.",
  "We'd be happy to help with that! Our team typically responds within the hour. Let me get your info so we can follow up personally.",
];

function getJessicaReply(index: number): string {
  return JESSICA_RESPONSES[Math.min(index, JESSICA_RESPONSES.length - 1)];
}

/* ── Quick-reply button style ──────────────────────────────────────── */
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
  }, [messages, isTyping, showForm, menuLevel]);

  /* ── focus input when panel opens ──────────────────────────────── */
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  /* ── send a user message and get Jessica's reply ───────────────── */
  const sendMessage = useCallback((text: string) => {
    const newCount = userMsgCount + 1;
    setUserMsgCount(newCount);
    setMessages((prev) => [...prev, { role: "user", text }]);

    // Simulate Jessica typing
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const reply = getJessicaReply(newCount - 1);
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);

      // Show lead form after threshold
      if (newCount >= LEAD_THRESHOLD && !formSubmitted) {
        setTimeout(() => setShowForm(true), 800);
      }
    }, 1000 + Math.random() * 800);
  }, [userMsgCount, formSubmitted]);

  /* ── handle typed input submit ─────────────────────────────────── */
  const send = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMenuLevel("none");
    sendMessage(text);
  }, [input, sendMessage]);

  /* ── handle main menu quick-reply click ────────────────────────── */
  const handleMainMenuClick = useCallback((label: string) => {
    const config = FOLLOW_UP_CONFIG[label];
    if (!config) return;

    // Add the user's selection as a message
    setMessages((prev) => [...prev, { role: "user", text: label }]);

    // Show Jessica's follow-up reply
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [...prev, { role: "assistant", text: config.reply }]);
      setMenuLevel(MENU_KEY_MAP[label] ?? "none");
    }, 600 + Math.random() * 400);
  }, []);

  /* ── handle follow-up quick-reply click ────────────────────────── */
  const handleFollowUpClick = useCallback((label: string) => {
    setMenuLevel("none");
    sendMessage(label);
  }, [sendMessage]);

  /* ── handle back to main menu ──────────────────────────────────── */
  const handleBack = useCallback(() => {
    setMessages((prev) => [...prev, { role: "assistant", text: "No problem! What else can I help you with?" }]);
    setMenuLevel("main");
  }, []);

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
      // silently fail — don't block the UX
    }

    setShowForm(false);
    setFormSubmitted(true);
    setSubmitting(false);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: `Thanks, ${formName.trim()}! One of our HVAC specialists will reach out to you shortly. Is there anything else I can help with in the meantime?` },
    ]);
  };

  /* ── render ────────────────────────────────────────────────────── */
  const followUpButtons = getFollowUpButtons();

  return (
    <>
      {/* ── Floating bubble ──────────────────────────────────────── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: ORANGE,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow = "0 6px 28px rgba(0,0,0,0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.25)";
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* ── Chat panel ───────────────────────────────────────────── */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            width: 380,
            maxWidth: "calc(100vw - 32px)",
            height: 520,
            maxHeight: "calc(100vh - 48px)",
            borderRadius: 16,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          }}
        >
          {/* ── Header ───────────────────────────────────────────── */}
          <div
            style={{
              background: NAVY,
              color: "#fff",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: ORANGE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              J
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>Jessica</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Mechanical Enterprise • Online</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              style={{
                background: "none",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                padding: 4,
                fontSize: 20,
                lineHeight: 1,
                opacity: 0.7,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
            >
              ✕
            </button>
          </div>

          {/* ── Messages ─────────────────────────────────────────── */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 16,
              background: "#f7f8fa",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "10px 14px",
                    borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    background: msg.role === "user" ? ORANGE : "#fff",
                    color: msg.role === "user" ? "#fff" : NAVY,
                    fontSize: 14,
                    lineHeight: 1.5,
                    boxShadow: msg.role === "user" ? "none" : "0 1px 3px rgba(0,0,0,0.08)",
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "14px 14px 14px 4px",
                    background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    display: "flex",
                    gap: 4,
                    alignItems: "center",
                  }}
                >
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: NAVY,
                        opacity: 0.4,
                        animation: `me-bounce 1.2s ${d * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Quick-reply buttons: main menu ─────────────────── */}
            {menuLevel === "main" && !isTyping && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {MAIN_MENU.map((label) => (
                  <button
                    key={label}
                    onClick={() => handleMainMenuClick(label)}
                    style={quickReplyStyle}
                    onMouseEnter={(e) => { e.currentTarget.style.background = ORANGE; e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = NAVY; }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* ── Quick-reply buttons: follow-up menu ────────────── */}
            {followUpButtons && !isTyping && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {followUpButtons.map((label) => (
                    <button
                      key={label}
                      onClick={() => handleFollowUpClick(label)}
                      style={quickReplyStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.background = ORANGE; e.currentTarget.style.color = "#fff"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = NAVY; }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleBack}
                  style={{
                    ...quickReplyStyle,
                    border: `1.5px solid ${NAVY}`,
                    color: NAVY,
                    alignSelf: "flex-start",
                    fontSize: 12,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = NAVY; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = NAVY; }}
                >
                  ← Back
                </button>
              </div>
            )}

            {/* ── Lead capture form ──────────────────────────────── */}
            {showForm && !formSubmitted && (
              <div
                style={{
                  background: "#fff",
                  border: `2px solid ${ORANGE}`,
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 4,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14, color: NAVY, marginBottom: 4 }}>
                  Want a specialist to follow up?
                </div>
                <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
                  Leave your info and we'll reach out shortly!
                </div>
                <form onSubmit={submitForm} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Your name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    style={{
                      padding: "9px 12px",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      fontSize: 14,
                      outline: "none",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = ORANGE)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#ddd")}
                  />
                  <input
                    type="tel"
                    placeholder="Phone number"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    required
                    style={{
                      padding: "9px 12px",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      fontSize: 14,
                      outline: "none",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = ORANGE)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#ddd")}
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      padding: "10px",
                      background: ORANGE,
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: submitting ? "wait" : "pointer",
                      opacity: submitting ? 0.7 : 1,
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.background = ORANGE_HOVER; }}
                    onMouseLeave={(e) => (e.currentTarget.style.background = ORANGE)}
                  >
                    {submitting ? "Sending…" : "Get a Call Back"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* ── Input bar ────────────────────────────────────────── */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 12px",
              background: "#fff",
              borderTop: "1px solid #eee",
              flexShrink: 0,
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              style={{
                flex: 1,
                padding: "9px 12px",
                border: "1px solid #ddd",
                borderRadius: 20,
                fontSize: 14,
                outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = ORANGE)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#ddd")}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
            />
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send"
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: input.trim() ? ORANGE : "#ccc",
                border: "none",
                cursor: input.trim() ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* ── Keyframes (injected once) ────────────────────────────── */}
      <style>{`
        @keyframes me-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </>
  );
}

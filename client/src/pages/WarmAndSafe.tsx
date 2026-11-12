import { useRef, useState } from "react";
import { captureContext } from "@/lib/captureContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Turnstile from "@/components/Turnstile";
import HoneypotFields, { type HoneypotValues } from "@/components/HoneypotFields";
import { TcpaDisclosure } from "@/components/TcpaDisclosure";
import { TCPA_FORM_VERSION } from "@shared/leadFormVersion";
import { AlertTriangle, CheckCircle, Flame, Heart, Home, Phone, ShieldAlert, Thermometer, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/useSEO";

/**
 * Warm & Safe (owner, Nov 11 2026): senior heat-safety awareness + "nominate a
 * senior who needs safe heat". Owner Nov 12: no individual beneficiary, and no claims that sales fund
 * help — only true statements. Owner Nov 12 ("add that your installation will help"): the ONLY
 * sales tie-in is the published commitment WARM_SAFE_TERMS below — keep every mention consistent with it.
 * No rebate, incentive or assistance-program wording (owner, Nov 10 and Nov 12). Phone for this campaign = (862) 423-9396 (owner, Nov 12; rest of site stays 419-1763).
 * Facts on this page are sourced (CDC, NFPA).
 */
export const WARM_SAFE_PATH = "/warm-and-safe";

/** The one sales tie-in (owner, Nov 12 2026). Every mention on the page and in the video must match this. */
export const WARM_SAFE_TERMS =
  "For every 20 residential heating or cooling installations Mechanical Enterprise completes between the launch of Warm & Safe " +
  "and March 31, 2027, we will install one heating system, equipment and labor, at no cost to a senior homeowner (65 or older) " +
  "selected from Warm & Safe nominations. Recipients must live in our New Jersey service area, own the home, and have a heating " +
  "system that needs replacement; we confirm this with a free in-home assessment and the homeowner's consent. We will post the " +
  "installation count and each completed Warm & Safe installation (with the recipient's permission) on this page.";

export default function WarmAndSafe() {
  const { toast } = useToast();
  useSEO({
    title: "Warm & Safe — Help a Senior Neighbor Stay Warm This Winter | Mechanical Enterprise",
    description:
      "Know a New Jersey senior heading into winter without safe heat? Nominate them for a free in-home heating assessment. Plus heat-safety warning signs to check this winter.",
    ogUrl: `https://mechanicalenterprise.com${WARM_SAFE_PATH}`,
  });

  const [form, setForm] = useState({
    nominatorName: "",
    nominatorPhone: "",
    nominatorEmail: "",
    relationship: "",
    nomineeFirstName: "",
    nomineeTown: "",
    heatingSituation: "",
    nomineeKnows: false,
    wantsOwnAssessment: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [honeypot, setHoneypot] = useState<HoneypotValues>({ website: "", company_url: "" });
  const loadedAt = useRef(Date.now());

  const nominate = trpc.warmSafe.nominate.useMutation();
  const captureLead = trpc.leadCaptures.create.useMutation();

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nominatorName || !form.nominatorPhone || !form.nomineeTown || form.heatingSituation.trim().length < 10) {
      toast({ title: "Please fill in your name, phone, their town, and a few words about their heat", variant: "destructive" });
      return;
    }
    try {
      await nominate.mutateAsync({
        ...form,
        nominatorEmail: form.nominatorEmail || undefined,
        pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        website: honeypot.website || undefined,
        company_url: honeypot.company_url || undefined,
        _ts: loadedAt.current,
        cfTurnstileResponse: turnstileToken || undefined,
      });
      if (form.wantsOwnAssessment) {
        const [firstName, ...rest] = form.nominatorName.trim().split(/\s+/);
        await captureLead
          .mutateAsync({
            firstName: firstName ?? "",
            lastName: rest.join(" "),
            phone: form.nominatorPhone,
            email: form.nominatorEmail || undefined,
            captureType: "inline_form",
            ...captureContext(),
            message: "Warm & Safe page: nominator also wants a free in-home assessment for their own home",
            _ts: loadedAt.current,
            formVersion: TCPA_FORM_VERSION,
          })
          .catch(() => undefined);
      }
      setSubmitted(true);
      setTurnstileToken("");
    } catch {
      toast({ title: "Something went wrong", description: "Please call (862) 423-9396", variant: "destructive" });
    }
  };

  const busy = nominate.isPending || captureLead.isPending;

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Hero */}
      <section className="bg-gradient-to-b from-[#0e1e34] to-[#1e3a5f] text-white px-4 py-12 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#ffb27a] mb-4">
            <Flame className="h-4 w-4" /> Warm &amp; Safe · New Jersey
          </p>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4">
            Some of our senior neighbors are heading into winter <span className="text-[#ff6b35]">without safe heat.</span>
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-8">
            Know the warning signs, check on the older people in your life, and if a senior near you needs safe heat,{" "}
            <strong className="text-white">nominate them.</strong>
          </p>
          <p className="text-base md:text-lg text-white max-w-2xl mx-auto mb-8 rounded-xl bg-white/10 border border-white/20 px-4 py-3">
            <strong className="text-[#ffb27a]">Your installation helps.</strong> For every 20 heating or cooling installations this
            winter, we install a heating system for a nominated senior <strong>at no cost to them</strong>.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="#nominate">
              <Button size="lg" className="w-full sm:w-auto bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold px-8">
                <Heart className="h-5 w-5 mr-2" /> Nominate a senior
              </Button>
            </a>
            <a href="/contact">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-white text-white hover:bg-white/10 font-bold px-8">
                <Home className="h-5 w-5 mr-2" /> Book a free in-home assessment
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Video */}
      <section className="px-4 py-10 bg-[#0e1e34]">
        <div className="max-w-sm mx-auto">
          <video
            className="w-full rounded-2xl shadow-2xl"
            controls
            playsInline
            preload="metadata"
            poster="/videos/warm-and-safe.jpg"
            src="/videos/warm-and-safe.mp4"
            aria-label="Warm and Safe video, 40 seconds"
          />
        </div>
      </section>

      {/* Why it matters */}
      <section className="px-4 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-4xl font-bold text-[#1e3a5f] text-center mb-3">Why an old heating system is dangerous for seniors</h2>
          <p className="text-gray-600 text-center max-w-2xl mx-auto mb-10">
            When a furnace or boiler gets too old, it doesn't just stop working. Older adults living alone are often the last to notice
            and the least able to fix it.
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: ShieldAlert,
                title: "Carbon monoxide",
                body: "An old or damaged system can leak carbon monoxide, a gas you can't see or smell. The CDC has found the death rate from accidental CO poisoning is highest among people 65 and older, and most poisonings happen in the colder months.",
              },
              {
                icon: Flame,
                title: "Space heaters and fire",
                body: "When the heat fails, many people turn to space heaters. Space heaters and heating stoves are involved in nearly 3 in 10 U.S. home heating fires (NFPA, 2019–2023).",
              },
              {
                icon: Thermometer,
                title: "The cold itself",
                body: "Running electric heaters all winter can mean bills a fixed income can't cover, so some seniors simply turn the heat down and stay cold.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-gray-100 bg-gray-50 p-6">
                <Icon className="h-8 w-8 text-[#ff6b35] mb-3" />
                <h3 className="text-lg font-bold text-[#1e3a5f] mb-2">{title}</h3>
                <p className="text-gray-700 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl bg-[#fff6f0] border border-[#ffd9c2] p-6 md:p-8">
            <h3 className="text-xl font-bold text-[#1e3a5f] mb-4 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-[#ff6b35]" /> Check on an older neighbor or parent this week
            </h3>
            <ul className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-gray-800">
              {[
                "Is there a working carbon monoxide alarm near the bedrooms?",
                "Is the furnace or boiler 15 or more years old?",
                "Are they relying on space heaters or the oven for heat?",
                "Any soot, a yellow burner flame, or a strange smell near the system?",
                "Do they get headaches, dizziness or feel sick mostly at home?",
                "Are space heaters at least 3 feet from beds, curtains and furniture?",
              ].map((q) => (
                <li key={q} className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-[#ff6b35] shrink-0 mt-0.5" /> {q}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-gray-700">
              <strong>If a CO alarm goes off or someone feels sick, get everyone outside and call 911.</strong>
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-4xl font-bold text-[#1e3a5f] text-center mb-10">How Warm &amp; Safe works</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Heart, title: "1. Nominate", body: "Tell us about a senior who needs safe heat. It takes two minutes." },
              { icon: Users, title: "2. We call you first", body: "We call you before contacting them, and only reach out with their permission." },
              { icon: Home, title: "3. Free in-home assessment", body: "We look at their heating system at no cost and explain, in plain terms, whether it's safe and what their options are." },
              { icon: Flame, title: "4. Every 20 installs = 1 free system", body: "For every 20 installations we complete this winter, one nominated senior gets a new heating system installed at no cost to them." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-gray-100 p-6 text-center">
                <Icon className="h-9 w-9 text-[#ff6b35] mx-auto mb-3" />
                <h3 className="text-lg font-bold text-[#1e3a5f] mb-2">{title}</h3>
                <p className="text-gray-700 text-sm">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* We need your help */}
      <section className="px-4 py-12 md:py-16 bg-[#fff6f0]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-4xl font-bold text-[#1e3a5f] mb-3">We need your help to make Warm &amp; Safe a success</h2>
          <p className="text-gray-700 max-w-2xl mx-auto mb-8">Three ways you can help a senior neighbor stay warm and safe this winter:</p>
          <div className="grid md:grid-cols-3 gap-5 text-left">
            {[
              { icon: Heart, title: "Nominate a senior", body: "Tell us about an older neighbor, parent or friend who needs safe heat.", href: "#nominate", cta: "Nominate" },
              { icon: Users, title: "Share this page", body: "Send it to your family group chat, church or neighborhood group. Someone you know may know a senior who needs help.", href: "#share", cta: "Share" },
              { icon: Home, title: "Choose us for your installation", body: "Every 20 installations this winter fund a heating system for a nominated senior, at no cost to them.", href: "/contact", cta: "Book a free assessment" },
            ].map(({ icon: Icon, title, body, href, cta }) => (
              <div key={title} className="rounded-2xl bg-white border border-[#ffd9c2] p-6 flex flex-col">
                <Icon className="h-8 w-8 text-[#ff6b35] mb-3" />
                <h3 className="text-lg font-bold text-[#1e3a5f] mb-2">{title}</h3>
                <p className="text-gray-700 text-sm mb-4 flex-1">{body}</p>
                {href === "#share" ? (
                  <Button
                    variant="outline"
                    className="border-[#ff6b35] text-[#ff6b35] font-bold"
                    onClick={async () => {
                      const url = `https://mechanicalenterprise.com${WARM_SAFE_PATH}`;
                      try {
                        if (navigator.share) await navigator.share({ title: "Warm & Safe", text: "Know a senior who needs safe heat this winter?", url });
                        else { await navigator.clipboard.writeText(url); toast({ title: "Link copied" }); }
                      } catch { /* user cancelled */ }
                    }}
                  >
                    {cta}
                  </Button>
                ) : (
                  <a href={href}>
                    <Button variant="outline" className="w-full border-[#ff6b35] text-[#ff6b35] font-bold">{cta}</Button>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nomination form */}
      <section id="nominate" className="px-4 py-12 md:py-16 bg-gray-50 scroll-mt-16">
        <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-8">
          {submitted ? (
            <div className="text-center py-6">
              <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-3" />
              <h2 className="text-2xl font-bold text-[#1e3a5f] mb-2">Thank you for looking out for your neighbor</h2>
              <p className="text-gray-600">Our team reads every nomination. We'll call you before we reach out to them.</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-[#1e3a5f] mb-1">Nominate a senior who needs safe heat</h2>
              <p className="text-sm text-gray-500 mb-5">We'll contact you first. Please only share what they'd be comfortable with.</p>
              <form onSubmit={handleSubmit} className="space-y-3">
                <HoneypotFields values={honeypot} onChange={setHoneypot} />
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 pt-1">About them</p>
                <Input placeholder="Their first name (optional)" value={form.nomineeFirstName} onChange={set("nomineeFirstName")} />
                <Input required placeholder="Their town (e.g. Newark)" value={form.nomineeTown} onChange={set("nomineeTown")} />
                <textarea
                  required
                  minLength={10}
                  rows={4}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  placeholder="What's going on with their heat? (e.g. very old furnace, using space heaters, no heat in some rooms)"
                  value={form.heatingSituation}
                  onChange={set("heatingSituation")}
                />
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" className="mt-1" checked={form.nomineeKnows} onChange={(e) => setForm({ ...form, nomineeKnows: e.target.checked })} />
                  They know I'm nominating them
                </label>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 pt-3">About you</p>
                <Input required autoComplete="name" placeholder="Your name" value={form.nominatorName} onChange={set("nominatorName")} />
                <Input required type="tel" inputMode="tel" autoComplete="tel" placeholder="Your phone" value={form.nominatorPhone} onChange={set("nominatorPhone")} />
                <Input type="email" autoComplete="email" placeholder="Your email (optional)" value={form.nominatorEmail} onChange={set("nominatorEmail")} />
                <Input placeholder="How do you know them? (neighbor, family, church…)" value={form.relationship} onChange={set("relationship")} />
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" className="mt-1" checked={form.wantsOwnAssessment} onChange={(e) => setForm({ ...form, wantsOwnAssessment: e.target.checked })} />
                  I'd also like a free in-home assessment for my own home
                </label>
                <Turnstile className="flex justify-center" onVerify={setTurnstileToken} onExpire={() => setTurnstileToken("")} />
                <Button type="submit" disabled={busy} className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold py-4">
                  {busy ? "Sending..." : "Send nomination"}
                </Button>
                {form.wantsOwnAssessment && <TcpaDisclosure />}
              </form>
            </>
          )}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-4 py-12 bg-[#ff6b35] text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Replacing your own heating or cooling system?</h2>
          <p className="text-white/90 mb-6">
            Book a free in-home assessment and a written quote. Your installation counts toward the next free system for a senior in need.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="tel:+18624239396">
              <Button size="lg" className="w-full sm:w-auto bg-white text-[#ff6b35] hover:bg-gray-100 font-bold px-8">
                <Phone className="h-5 w-5 mr-2" /> Call (862) 423-9396
              </Button>
            </a>
            <a href="/contact">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-white text-white hover:bg-white/10 font-bold px-8">
                Book online
              </Button>
            </a>
          </div>
          <p className="text-sm text-white/80 mt-4">Prefer to text? Text (862) 423-9396</p>
        </div>
      </section>

      {/* Terms of the installation commitment (keep in sync with WARM_SAFE_TERMS) */}
      <section className="px-4 py-8 bg-gray-50">
        <p className="max-w-3xl mx-auto text-xs text-gray-500 leading-relaxed">
          <strong>Warm &amp; Safe terms:</strong> {WARM_SAFE_TERMS}
        </p>
      </section>
    </div>
  );
}

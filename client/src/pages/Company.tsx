import { Badge } from "@/components/ui/badge";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { VERIFIED_FACTS } from "@shared/verifiedFacts";
import { buildEntityRows, buildEntityJsonLd, COMPANY_BASE } from "@shared/companyEntity";
import { INSTALL_PAGES } from "@shared/llmsTxt";

/**
 * /company — the plain-statement entity page (who we are, where we work, what we do) that AI answer
 * engines and search can cite. Every value comes from VERIFIED_FACTS via shared/companyEntity.ts; a
 * fact the owner hasn't supplied yet (street address, license, hours) simply isn't shown.
 */
export default function Company() {
  useSEO({
    title: "Company Facts | Mechanical Enterprise LLC | NJ HVAC",
    description: "Mechanical Enterprise LLC: contact details, counties served, HVAC services and optional 10-year parts & labor coverage in New Jersey.",
    ogUrl: `${COMPANY_BASE}/company`,
  });
  const rows = buildEntityRows(VERIFIED_FACTS);
  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildEntityJsonLd(VERIFIED_FACTS)) }} />
      <Navigation />
      <section className="bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white py-14">
        <div className="container max-w-3xl">
          <Badge className="mb-4 bg-[#ff6b35] text-white">Company facts</Badge>
          <h1 className="text-4xl md:text-5xl font-bold">{VERIFIED_FACTS.business.legalName}</h1>
          <p className="mt-4 text-lg text-white/90">HVAC installation and service in New Jersey. The facts below are the same ones we use everywhere on this site.</p>
        </div>
      </section>
      <section className="py-12">
        <div className="container max-w-3xl">
          <dl className="divide-y">
            {rows.map((r) => (
              <div key={r.label} className="py-4 grid sm:grid-cols-[12rem_1fr] gap-1 sm:gap-4">
                <dt className="font-semibold text-[#1e3a5f]">{r.label}</dt>
                <dd>{r.href ? <a className="text-[#ff6b35] underline" href={r.href}>{r.value}</a> : r.value}</dd>
              </div>
            ))}
          </dl>
          <h2 className="mt-10 text-2xl font-bold text-[#1e3a5f]">Installation pages</h2>
          <ul className="mt-3 space-y-1">
            {INSTALL_PAGES.map((p) => (
              <li key={p.path}><a className="text-[#ff6b35] underline" href={p.path}>{p.label}</a></li>
            ))}
            <li><a className="text-[#ff6b35] underline" href="/commercial">Commercial HVAC</a></li>
            <li><a className="text-[#ff6b35] underline" href={VERIFIED_FACTS.warranty.termsUrl}>{VERIFIED_FACTS.warranty.headline}</a></li>
          </ul>
        </div>
      </section>
      <Footer />
    </div>
  );
}

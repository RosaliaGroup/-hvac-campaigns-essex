import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowRight } from "lucide-react";

/**
 * "Protect the investment" section (docs/positioning-warranty-spec.md §4) —
 * shared across the five install pages it's specified for (/residential and
 * the four ServicePage-routed slugs) so the copy can't drift between them.
 * Not rendered on /commercial (one sentence + link only, per spec) or any
 * other page not named in §4.
 */
export default function WarrantyCoverageSection() {
  return (
    <section className="py-16 bg-white border-y">
      <div className="container">
        <div className="max-w-3xl mx-auto text-center">
          <ShieldCheck className="h-10 w-10 text-[#1e3a5f] mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-[#0a1628] mb-4">Protect the Investment</h2>
          <p className="text-gray-600 leading-relaxed text-lg mb-6">
            A new HVAC system is a major investment. Optional 10-year parts and labor coverage protects it against the
            compressor, control board and blower failures that tend to show up years after a manufacturer's warranty
            runs out — with no deductible on covered repairs. Existing systems may qualify too, subject to an
            eligibility inspection.
          </p>
          <a href="/warranty">
            <Button size="lg" className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white px-8 py-6 text-lg">
              Add 10-Year Coverage <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

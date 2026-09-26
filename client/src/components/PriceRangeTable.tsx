import { VERIFIED_FACTS, isPriceRangeStale } from "@shared/verifiedFacts";

/**
 * docs/positioning-warranty-spec.md §9b. Renders nothing until the owner
 * supplies a verified range for this exact page path — the model/this
 * codebase never invents an installed-price figure (shared/seoLinter.ts's
 * unverified_price_range rule enforces the same thing on any drafted copy).
 */
const PRICE_FACTORS = [
  "Ductwork condition and modifications",
  "Electrical panel/circuit upgrades",
  "Line-set length and routing",
  "Permits and inspections",
  "Equipment tier and capacity",
];

export default function PriceRangeTable({ pagePath }: { pagePath: string }) {
  const ranges = VERIFIED_FACTS.priceRanges.filter((r) => r.page === pagePath);
  if (ranges.length === 0) return null;

  return (
    <section className="py-16 bg-white">
      <div className="container">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-[#0a1628] mb-6 text-center">Typical Installed Price</h2>
          <div className="space-y-3 mb-6">
            {ranges.map((r, i) => (
              <div key={i} className="flex justify-between items-center p-4 bg-[#f7f8fa] rounded-lg border">
                <span className="font-medium text-[#0a1628]">{r.item}</span>
                <span className="font-bold text-[#1e3a5f]">
                  ${r.low.toLocaleString()}–${r.high.toLocaleString()} installed
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 text-center mb-8">
            Typically installed in Essex/Hudson/Union counties, before rebates. Confirmed {ranges[0].asOf}
            {isPriceRangeStale(ranges[0]) ? " — due for a refresh." : "."}
          </p>
          <h3 className="font-semibold text-[#0a1628] mb-3">What Moves the Price</h3>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            {PRICE_FACTORS.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

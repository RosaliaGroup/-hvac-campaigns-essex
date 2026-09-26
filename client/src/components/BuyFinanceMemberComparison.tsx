import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { VERIFIED_FACTS } from "@shared/verifiedFacts";

/**
 * "Buy / finance / member" comparison (docs/positioning-warranty-spec.md
 * §9a) — shared across /warranty, the homepage, and the five install pages
 * so the copy can't drift between them. The Member column never shows a
 * price: VERIFIED_FACTS.membership.priceText stays null until the owner
 * sets a real figure (fact-gated, same convention as the rest of §9).
 */
export default function BuyFinanceMemberComparison() {
  const { membership } = VERIFIED_FACTS;

  const columns = [
    {
      key: "buy",
      title: "Buy",
      subtitle: "Pay for the system outright",
      items: ["You own the system from day one", "Optional 10-year parts & labor coverage priced separately", "No monthly payment"],
    },
    {
      key: "finance",
      title: "Finance",
      subtitle: "PSE&G On-Bill Repayment",
      items: ["You own the system", "Project cost added to your monthly utility bill, 0% interest", "Optional coverage priced separately"],
    },
    {
      key: "member",
      title: "Member",
      subtitle: membership.name,
      items: [
        "You own the system",
        "One monthly payment. Coverage, maintenance, priority service.",
        membership.priceText ?? "Pricing provided at consultation",
      ],
    },
  ];

  return (
    <section className="py-16 bg-[#f7f8fa]">
      <div className="container">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-[#0a1628] mb-3">Buy, Finance, or Become a Member</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            However you pay for the system, you own it. Compare your options below.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {columns.map((col) => (
            <Card key={col.key} className={col.key === "member" ? "border-2 border-[#1e3a5f]" : ""}>
              <CardHeader>
                <CardTitle className="text-xl">{col.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{col.subtitle}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {col.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

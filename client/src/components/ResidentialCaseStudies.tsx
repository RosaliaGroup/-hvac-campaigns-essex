import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, TrendingDown, DollarSign, CheckCircle, TrendingUp } from "lucide-react";

const residentialCaseStudies = [
  {
    id: 1,
    title: "Single-Family Home Upgrade",
    location: "Montclair, NJ",
    homeSize: "1,800 sq ft",
    bedrooms: "3 BR / 2 BA",
    oldSystem: "40-year-old oil furnace + 5 window AC units",
    newSystem: "Multi-Zone Heat Pump System",
    projectCost: "$23,500",
    rebateReceived: "$14,000",
    outOfPocket: "$9,500",
    monthlyPayment: "$79",
    energySavingsBefore: "$385/month",
    energySavingsAfter: "$165/month",
    monthlySavings: "$220",
    annualSavings: "$2,640",
    propertyValueIncrease: "$15,000 - $20,000",
    highlights: [
      "Eliminated oil tank and delivery costs",
      "Replaced 5 noisy window units with quiet system",
      "Year-round comfort with one modern system",
      "Increased home value for future resale",
      "57% reduction in energy costs"
    ]
  },
  {
    id: 2,
    title: "Colonial Home Modernization",
    location: "Summit, NJ",
    homeSize: "2,600 sq ft",
    bedrooms: "4 BR / 3 BA",
    oldSystem: "Steam radiators (gas boiler) + aging central AC",
    newSystem: "Ducted Heat Pump System",
    projectCost: "$29,800",
    rebateReceived: "$16,000",
    outOfPocket: "$13,800",
    monthlyPayment: "$115",
    energySavingsBefore: "$520/month",
    energySavingsAfter: "$235/month",
    monthlySavings: "$285",
    annualSavings: "$3,420",
    propertyValueIncrease: "$20,000 - $25,000",
    highlights: [
      "Removed old radiators and freed up wall space",
      "Even temperature throughout all rooms",
      "Smart thermostat with zone control",
      "Eliminated gas utility connection fees",
      "55% reduction in heating and cooling costs"
    ]
  },
  {
    id: 3,
    title: "Ranch Home Transformation",
    location: "Edison, NJ",
    homeSize: "3,200 sq ft",
    bedrooms: "5 BR / 3 BA",
    oldSystem: "20-year-old gas furnace + outdated AC system",
    newSystem: "Ducted Heat Pump System with Smart Controls",
    projectCost: "$34,500",
    rebateReceived: "$16,000",
    outOfPocket: "$18,500",
    monthlyPayment: "$154",
    energySavingsBefore: "$640/month",
    energySavingsAfter: "$290/month",
    monthlySavings: "$350",
    annualSavings: "$4,200",
    propertyValueIncrease: "$25,000 - $30,000",
    highlights: [
      "Upgraded from 15 SEER to 20+ SEER efficiency",
      "Whole-home dehumidification included",
      "Improved indoor air quality for family health",
      "Future-proof energy-efficient system",
      "55% reduction in monthly utility bills"
    ]
  }
];

export default function ResidentialCaseStudies() {
  return (
    <section className="py-20 bg-white">
      <div className="container">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-[#ff6b35] text-white text-base px-4 py-2">Real Homeowner Results</Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] mb-4">Residential Success Stories</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            See how New Jersey homeowners are saving money and increasing property value with heat pump upgrades
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {residentialCaseStudies.map((study) => (
            <Card key={study.id} className="border-t-4 border-t-[#ff6b35] hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Home className="h-8 w-8 text-[#ff6b35]" />
                  <Badge variant="outline" className="text-xs">{study.bedrooms}</Badge>
                </div>
                <CardTitle className="text-xl">{study.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{study.location} • {study.homeSize}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* System Info */}
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="font-medium text-muted-foreground">Old System:</p>
                    <p className="text-foreground">{study.oldSystem}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">New System:</p>
                    <p className="text-foreground">{study.newSystem}</p>
                  </div>
                </div>

                {/* Financial Highlights */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Installation Cost:</span>
                    <span className="text-sm font-bold">{study.projectCost}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      Rebate Received:
                    </span>
                    <span className="text-lg font-bold text-green-700">{study.rebateReceived}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-green-300">
                    <span className="text-sm font-medium">Out of Pocket:</span>
                    <span className="font-bold">{study.outOfPocket}</span>
                  </div>
                </div>

                {/* On-Bill Repayment Details */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-purple-600" />
                    <span className="font-semibold text-purple-900">On-Bill Repayment Option</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Monthly Payment (10 years)*:</span>
                      <span className="font-bold text-purple-700">{study.monthlyPayment}/mo</span>
                    </div>
                    <p className="text-xs text-muted-foreground italic">*10-year term for qualifying accounts only</p>
                    <div className="pt-2 border-t border-purple-300">
                      <p className="text-xs text-purple-900 font-medium">
                        💡 Net Savings: <span className="text-green-700">+${(parseFloat(study.monthlySavings.replace('$', '').replace(',', '')) - parseFloat(study.monthlyPayment.replace('$', '').replace(',', ''))).toLocaleString()}/month</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Your energy savings cover the payment!</p>
                    </div>
                  </div>
                </div>

                {/* Energy Savings */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold text-blue-900">Monthly Energy Costs</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Before:</p>
                      <p className="font-medium">{study.energySavingsBefore}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">After:</p>
                      <p className="font-medium text-green-700">{study.energySavingsAfter}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-blue-300">
                    <p className="text-sm font-medium">Annual Savings: <span className="text-blue-700">{study.annualSavings}</span></p>
                  </div>
                </div>

                {/* Property Value Increase */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-orange-600" />
                    <span className="font-semibold text-orange-900">Property Value Increase</span>
                  </div>
                  <p className="text-lg font-bold text-orange-700">{study.propertyValueIncrease}</p>
                  <p className="text-xs text-muted-foreground mt-1">Based on comparable home sales with modern HVAC</p>
                </div>

                {/* Highlights */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Key Benefits:</p>
                  <ul className="space-y-1">
                    {study.highlights.map((highlight, index) => (
                      <li key={index} className="flex items-start gap-2 text-xs">
                        <CheckCircle className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <p className="text-lg text-muted-foreground mb-4">
            Ready to upgrade your home and start saving?
          </p>
          <p className="text-sm text-muted-foreground">
            All case studies represent actual residential projects in New Jersey. Individual results may vary based on home size, insulation, usage patterns, and equipment selected.
          </p>
        </div>
      </div>
    </section>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, TrendingDown, DollarSign, CheckCircle } from "lucide-react";

const caseStudies = [
  {
    id: 1,
    title: "Mid-Size Restaurant Conversion",
    location: "Newark, NJ",
    propertyType: "Restaurant",
    buildingSize: "8,500 sq ft",
    oldSystem: "20-year-old gas furnace + AC units",
    newSystem: "VRF Heat Pump System (Mitsubishi)",
    projectCost: "$95,000",
    rebateReceived: "$68,000",
    rebatePercentage: "72%",
    outOfPocket: "$27,000",
    monthlyPayment: "$225",
    energySavingsBefore: "$2,800/month",
    energySavingsAfter: "$1,400/month",
    monthlySavings: "$1,400",
    annualSavings: "$16,800",
    paybackPeriod: "1.6 years",
    highlights: [
      "Individual zone control for dining areas and kitchen",
      "Reduced energy consumption by 50%",
      "Improved indoor air quality",
      "Quieter operation for better dining experience"
    ]
  },
  {
    id: 2,
    title: "Office Building Retrofit",
    location: "Jersey City, NJ",
    propertyType: "Office Building",
    buildingSize: "35,000 sq ft",
    oldSystem: "Central gas boiler + rooftop AC units",
    newSystem: "Commercial Heat Pump System (Daikin VRV)",
    projectCost: "$285,000",
    rebateReceived: "$215,000",
    rebatePercentage: "75%",
    outOfPocket: "$70,000",
    monthlyPayment: "$584",
    energySavingsBefore: "$8,500/month",
    energySavingsAfter: "$3,900/month",
    monthlySavings: "$4,600",
    annualSavings: "$55,200",
    paybackPeriod: "1.3 years",
    highlights: [
      "Smart building integration with BIM technology",
      "46% reduction in energy costs",
      "Eliminated gas utility connection fees",
      "Improved tenant comfort and satisfaction"
    ]
  },
  {
    id: 3,
    title: "Manufacturing Facility Upgrade",
    location: "Elizabeth, NJ",
    propertyType: "Manufacturing",
    buildingSize: "62,000 sq ft",
    oldSystem: "Industrial gas heating + split AC systems",
    newSystem: "Industrial Heat Pump System (Carrier)",
    projectCost: "$425,000",
    rebateReceived: "$340,000",
    rebatePercentage: "80%",
    outOfPocket: "$85,000",
    monthlyPayment: "$709",
    energySavingsBefore: "$14,200/month",
    energySavingsAfter: "$6,100/month",
    monthlySavings: "$8,100",
    annualSavings: "$97,200",
    paybackPeriod: "0.9 years",
    highlights: [
      "Maximized 80% rebate for industrial facility",
      "57% reduction in HVAC operating costs",
      "Improved process temperature control",
      "Reduced carbon footprint by 65%"
    ]
  }
];

export default function CaseStudies() {
  return (
    <section className="py-20 bg-secondary/30">
      <div className="container">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-[#ff6b35] text-white text-base px-4 py-2">Success Stories</Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] mb-4">Commercial Case Studies</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Real projects showing actual energy savings and rebate amounts received
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {caseStudies.map((study) => (
            <Card key={study.id} className="border-t-4 border-t-[#ff6b35] hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Building2 className="h-8 w-8 text-[#ff6b35]" />
                  <Badge variant="outline" className="text-xs">{study.propertyType}</Badge>
                </div>
                <CardTitle className="text-xl">{study.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{study.location} • {study.buildingSize}</p>
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
                    <span className="text-sm font-medium">Project Cost:</span>
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
                    <span className="text-sm font-medium">Coverage:</span>
                    <Badge className="bg-green-600 text-white">{study.rebatePercentage} Covered</Badge>
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
                      <span className="text-muted-foreground">Remaining Cost:</span>
                      <span className="font-bold">{study.outOfPocket}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Monthly Payment (10 years):</span>
                      <span className="font-bold text-purple-700">{study.monthlyPayment}/mo</span>
                    </div>
                    <div className="pt-2 border-t border-purple-300">
                      <p className="text-xs text-purple-900 font-medium">
                        💡 Net Cash Flow: <span className="text-green-700">+${(parseFloat(study.monthlySavings.replace('$', '').replace(',', '')) - parseFloat(study.monthlyPayment.replace('$', '').replace(',', ''))).toLocaleString()}/month</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Energy savings exceed monthly payments!</p>
                    </div>
                  </div>
                </div>

                {/* Energy Savings */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold text-blue-900">Energy Savings</span>
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
                    <p className="text-sm font-medium">Monthly Savings: <span className="text-blue-700">{study.monthlySavings}</span></p>
                    <p className="text-sm font-medium">Annual Savings: <span className="text-blue-700">{study.annualSavings}</span></p>
                    <p className="text-xs text-muted-foreground mt-1">Payback Period: {study.paybackPeriod}</p>
                  </div>
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
            Ready to achieve similar results for your business?
          </p>
          <p className="text-sm text-muted-foreground">
            All case studies represent actual projects completed in New Jersey. Individual results may vary based on building characteristics, usage patterns, and specific equipment selected.
          </p>
        </div>
      </div>
    </section>
  );
}

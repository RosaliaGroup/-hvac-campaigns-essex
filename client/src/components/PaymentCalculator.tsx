import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Calculator } from "lucide-react";

export default function PaymentCalculator() {
  const [propertySize, setPropertySize] = useState(50); // units or sq ft (in thousands)
  const [timeframe, setTimeframe] = useState(1); // 1, 3, or 5 years

  // Calculate costs based on property size
  const monthlySubscription = Math.round(propertySize * 20); // $20 per unit/1000sqft
  const traditionalMonthly = Math.round(propertySize * 35); // $35 per unit/1000sqft traditional
  
  const subscriptionTotal = monthlySubscription * 12 * timeframe;
  const traditionalTotal = traditionalMonthly * 12 * timeframe;
  const savings = traditionalTotal - subscriptionTotal;
  const savingsPercent = Math.round((savings / traditionalTotal) * 100);

  return (
    <div className="space-y-8">
      {/* Input Controls */}
      <div className="space-y-6">
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-lg font-semibold text-[#1e3a5f]">Property Size</label>
            <span className="text-2xl font-bold text-[#ff6b35]">{propertySize} units / {propertySize}k sq ft</span>
          </div>
          <Slider
            value={[propertySize]}
            onValueChange={(value) => setPropertySize(value[0])}
            min={10}
            max={200}
            step={10}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>10 units</span>
            <span>200 units</span>
          </div>
        </div>

        <div>
          <label className="text-lg font-semibold text-[#1e3a5f] mb-3 block">Timeframe</label>
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant={timeframe === 1 ? "default" : "outline"}
              onClick={() => setTimeframe(1)}
              className={timeframe === 1 ? "bg-[#ff6b35] hover:bg-[#ff6b35]/90" : ""}
            >
              1 Year
            </Button>
            <Button
              variant={timeframe === 3 ? "default" : "outline"}
              onClick={() => setTimeframe(3)}
              className={timeframe === 3 ? "bg-[#ff6b35] hover:bg-[#ff6b35]/90" : ""}
            >
              3 Years
            </Button>
            <Button
              variant={timeframe === 5 ? "default" : "outline"}
              onClick={() => setTimeframe(5)}
              className={timeframe === 5 ? "bg-[#ff6b35] hover:bg-[#ff6b35]/90" : ""}
            >
              5 Years
            </Button>
          </div>
        </div>
      </div>

      {/* Results Comparison */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Traditional Model */}
        <Card className="border-2 border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-sm font-semibold text-red-800 mb-2">Traditional Pay-Per-Service</div>
              <div className="text-4xl font-bold text-red-900 mb-1">
                ${traditionalMonthly.toLocaleString()}<span className="text-lg">/mo</span>
              </div>
              <div className="text-sm text-red-700 mb-4">
                ${traditionalTotal.toLocaleString()} over {timeframe} {timeframe === 1 ? 'year' : 'years'}
              </div>
              <div className="space-y-2 text-xs text-red-800 text-left bg-white/50 p-3 rounded">
                <div>✗ Unpredictable emergency costs</div>
                <div>✗ Higher per-visit charges</div>
                <div>✗ Reactive maintenance only</div>
                <div>✗ No priority service</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Model */}
        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-sm font-semibold text-green-800 mb-2">Our Subscription Program</div>
              <div className="text-4xl font-bold text-green-900 mb-1">
                ${monthlySubscription.toLocaleString()}<span className="text-lg">/mo</span>
              </div>
              <div className="text-sm text-green-700 mb-4">
                ${subscriptionTotal.toLocaleString()} over {timeframe} {timeframe === 1 ? 'year' : 'years'}
              </div>
              <div className="space-y-2 text-xs text-green-800 text-left bg-white/50 p-3 rounded">
                <div>✓ Fixed monthly pricing</div>
                <div>✓ Preventive maintenance included</div>
                <div>✓ Priority emergency service</div>
                <div>✓ Discounted repair rates</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Savings Summary */}
      <div className="bg-gradient-to-r from-[#ff6b35] to-[#ff8c5a] rounded-xl p-8 text-white text-center">
        <Calculator className="h-12 w-12 mx-auto mb-4 opacity-90" />
        <div className="text-5xl font-bold mb-2">${savings.toLocaleString()}</div>
        <div className="text-xl mb-1">Total Savings Over {timeframe} {timeframe === 1 ? 'Year' : 'Years'}</div>
        <div className="text-sm opacity-90">That's {savingsPercent}% less than traditional maintenance</div>
        <div className="mt-6">
          <Button size="lg" className="bg-white text-[#ff6b35] hover:bg-slate-100 font-semibold shadow-lg">
            Get Your Custom Quote
          </Button>
        </div>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        * Estimates based on average property maintenance costs. Actual savings may vary based on property type, equipment age, and service requirements.
      </p>
    </div>
  );
}

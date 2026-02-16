import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, DollarSign } from "lucide-react";

export default function RebateCalculator() {
  const [buildingSize, setBuildingSize] = useState<string>("");
  const [currentSystem, setCurrentSystem] = useState<string>("");
  const [propertyType, setPropertyType] = useState<string>("");
  const [result, setResult] = useState<{ rebateAmount: number; percentage: number } | null>(null);

  const calculateRebate = () => {
    if (!buildingSize || !currentSystem || !propertyType) {
      return;
    }

    const size = parseInt(buildingSize);
    let baseRebate = 0;

    // Calculate base rebate based on building size
    if (size < 5000) {
      baseRebate = 15000;
    } else if (size < 10000) {
      baseRebate = 30000;
    } else if (size < 25000) {
      baseRebate = 60000;
    } else if (size < 50000) {
      baseRebate = 100000;
    } else {
      baseRebate = 150000;
    }

    // Adjust based on current system (older systems get higher rebates)
    if (currentSystem === "old-gas") {
      baseRebate *= 1.2;
    } else if (currentSystem === "old-electric") {
      baseRebate *= 1.15;
    } else if (currentSystem === "oil") {
      baseRebate *= 1.25;
    }

    // Adjust based on property type
    if (propertyType === "restaurant") {
      baseRebate *= 1.1;
    } else if (propertyType === "healthcare") {
      baseRebate *= 1.15;
    } else if (propertyType === "manufacturing") {
      baseRebate *= 1.2;
    }

    // Calculate percentage (typically 60-80% of estimated project cost)
    const estimatedProjectCost = baseRebate / 0.7; // Assuming rebate is 70% on average
    const percentage = Math.min(80, Math.round((baseRebate / estimatedProjectCost) * 100));

    setResult({
      rebateAmount: Math.round(baseRebate),
      percentage: percentage
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className="border-2 border-[#ff6b35]">
      <CardHeader className="bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white">
        <div className="flex items-center gap-3">
          <Calculator className="h-8 w-8 text-[#ff6b35]" />
          <div>
            <CardTitle className="text-2xl">Rebate Eligibility Calculator</CardTitle>
            <CardDescription className="text-white/80">
              Estimate your potential rebate amount
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Building Size */}
          <div className="space-y-2">
            <Label htmlFor="buildingSize">Building Size (Square Feet)</Label>
            <Select value={buildingSize} onValueChange={setBuildingSize}>
              <SelectTrigger id="buildingSize">
                <SelectValue placeholder="Select building size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2500">Under 5,000 sq ft</SelectItem>
                <SelectItem value="7500">5,000 - 10,000 sq ft</SelectItem>
                <SelectItem value="17500">10,000 - 25,000 sq ft</SelectItem>
                <SelectItem value="37500">25,000 - 50,000 sq ft</SelectItem>
                <SelectItem value="75000">50,000+ sq ft</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Current System */}
          <div className="space-y-2">
            <Label htmlFor="currentSystem">Current HVAC System</Label>
            <Select value={currentSystem} onValueChange={setCurrentSystem}>
              <SelectTrigger id="currentSystem">
                <SelectValue placeholder="Select current system" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="old-gas">Gas Furnace (10+ years old)</SelectItem>
                <SelectItem value="new-gas">Gas Furnace (Less than 10 years)</SelectItem>
                <SelectItem value="old-electric">Electric Heat (10+ years old)</SelectItem>
                <SelectItem value="new-electric">Electric Heat (Less than 10 years)</SelectItem>
                <SelectItem value="oil">Oil Heating System</SelectItem>
                <SelectItem value="none">No existing system</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Property Type */}
          <div className="space-y-2">
            <Label htmlFor="propertyType">Property Type</Label>
            <Select value={propertyType} onValueChange={setPropertyType}>
              <SelectTrigger id="propertyType">
                <SelectValue placeholder="Select property type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="office">Office Building</SelectItem>
                <SelectItem value="retail">Retail Store</SelectItem>
                <SelectItem value="restaurant">Restaurant</SelectItem>
                <SelectItem value="hotel">Hotel/Hospitality</SelectItem>
                <SelectItem value="healthcare">Healthcare Facility</SelectItem>
                <SelectItem value="manufacturing">Manufacturing/Industrial</SelectItem>
                <SelectItem value="warehouse">Warehouse</SelectItem>
                <SelectItem value="other">Other Commercial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Calculate Button */}
          <Button 
            onClick={calculateRebate} 
            className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-lg py-6"
            disabled={!buildingSize || !currentSystem || !propertyType}
          >
            <Calculator className="mr-2 h-5 w-5" />
            Calculate Estimated Rebate
          </Button>

          {/* Results */}
          {result && (
            <div className="mt-6 p-6 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-600 rounded-lg">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-6 w-6 text-green-700" />
                <h3 className="text-xl font-bold text-green-900">Estimated Rebate</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-3xl font-bold text-green-700">
                    {formatCurrency(result.rebateAmount)}
                  </p>
                  <p className="text-sm text-green-800 mt-1">
                    Approximately {result.percentage}% of project cost covered
                  </p>
                </div>
                <div className="pt-4 border-t border-green-300">
                  <p className="text-sm text-green-900 font-medium mb-2">
                    This is an estimate based on typical rebate programs. Actual amounts may vary.
                  </p>
                  <p className="text-xs text-green-800">
                    Contact us for a detailed assessment and to learn about additional incentives you may qualify for.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="text-xs text-muted-foreground bg-secondary/30 p-4 rounded">
            <strong>Note:</strong> This calculator provides estimates based on typical commercial rebate programs. 
            Actual rebate amounts depend on specific program requirements, equipment specifications, and energy 
            efficiency improvements. Contact Mechanical Enterprise for a detailed rebate assessment.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

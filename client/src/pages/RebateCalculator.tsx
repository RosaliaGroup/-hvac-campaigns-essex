import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

import {
  Home, MapPin, Thermometer, DollarSign, CheckCircle, ArrowRight, ArrowLeft,
  Zap, Award, Gift, Shield, Calendar, Phone, Mail, User, ChevronRight,
  Star, TrendingDown, Clock, BadgeCheck, HelpCircle, Info
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ─── Rebate calculation logic ────────────────────────────────────────────────

interface HomeDetails {
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  neighborhood: string;
  propertyType: string;
  yearBuilt: string;
  sqft: string;
  bedrooms: string;
  floors: string;
  currentHeating: string;
  incomeLevel: string; // "lmi" | "standard"
  hasExistingDucts: string;
}

// NJ zip codes designated as LMI areas — all 21 counties
// Source: HUD LMI census tracts + NJ Clean Heat program eligibility data
const NJ_LMI_ZIPS = new Set([
  // ── ESSEX COUNTY ──────────────────────────────────────────────────────────
  // Newark
  "07101","07102","07103","07104","07105","07106","07107","07108",
  "07109","07110","07111","07112","07114",
  // East Orange
  "07017","07018",
  // Orange
  "07050","07051",
  // Irvington
  "07111",
  // Belleville, Bloomfield (partial LMI tracts)
  "07109","07003",
  // Montclair (partial)
  "07042",

  // ── HUDSON COUNTY ─────────────────────────────────────────────────────────
  // Jersey City
  "07302","07303","07304","07305","07306","07307","07308","07309","07310",
  // Bayonne
  "07002",
  // Union City, West New York, Weehawken
  "07087","07093","07086",
  // Hoboken (partial)
  "07030",
  // Kearny, Harrison
  "07032","07029",
  // Secaucus (partial)
  "07094",

  // ── PASSAIC COUNTY ────────────────────────────────────────────────────────
  // Paterson
  "07501","07502","07503","07504","07505","07509","07510","07522","07524",
  // Passaic
  "07055",
  // Clifton (partial)
  "07011","07012","07013","07014",
  // Haledon
  "07508",

  // ── UNION COUNTY ──────────────────────────────────────────────────────────
  // Elizabeth
  "07201","07202","07206","07208",
  // Plainfield
  "07060","07061","07062","07063",
  // Linden, Roselle, Roselle Park
  "07036","07203","07204",
  // Hillside
  "07205",

  // ── MERCER COUNTY ─────────────────────────────────────────────────────────
  // Trenton
  "08601","08602","08603","08604","08605","08606","08607","08608","08609",
  "08610","08611","08618","08619","08620","08629","08638",
  // Ewing (partial)
  "08628",
  // Hamilton (partial LMI tracts)
  "08610","08619",

  // ── CAMDEN COUNTY ─────────────────────────────────────────────────────────
  // Camden City
  "08101","08102","08103","08104","08105",
  // Pennsauken (partial)
  "08110",
  // Gloucester City
  "08030",

  // ── MIDDLESEX COUNTY ──────────────────────────────────────────────────────
  // New Brunswick
  "08901","08902","08903","08904",
  // Perth Amboy
  "08861","08862",
  // South Amboy
  "08879",
  // Carteret
  "07008",
  // Sayreville (partial)
  "08872",

  // ── BERGEN COUNTY ─────────────────────────────────────────────────────────
  // Hackensack (partial LMI tracts)
  "07601","07602",
  // Englewood (partial)
  "07631",
  // Garfield
  "07026",
  // Lodi
  "07644",

  // ── MORRIS COUNTY ─────────────────────────────────────────────────────────
  // Dover
  "07801","07802",
  // Wharton
  "07885",
  // Mine Hill (partial)
  "07803",

  // ── SOMERSET COUNTY ───────────────────────────────────────────────────────
  // Bound Brook
  "08805",
  // Manville
  "08835",

  // ── HUNTERDON COUNTY ──────────────────────────────────────────────────────
  // Flemington (partial)
  "08822",

  // ── WARREN COUNTY ─────────────────────────────────────────────────────────
  // Phillipsburg
  "08865",

  // ── SUSSEX COUNTY ─────────────────────────────────────────────────────────
  // Newton
  "07860",

  // ── OCEAN COUNTY ──────────────────────────────────────────────────────────
  // Lakewood (large LMI population)
  "08701","08702",
  // Toms River (partial)
  "08753","08755",
  // Seaside Heights
  "08751",

  // ── MONMOUTH COUNTY ───────────────────────────────────────────────────────
  // Asbury Park
  "07712",
  // Long Branch
  "07740",
  // Red Bank (partial)
  "07701",
  // Neptune
  "07753",

  // ── ATLANTIC COUNTY ───────────────────────────────────────────────────────
  // Atlantic City
  "08401","08402","08403","08404","08405",
  // Pleasantville
  "08232",
  // Egg Harbor City
  "08215",

  // ── CAPE MAY COUNTY ───────────────────────────────────────────────────────
  // Wildwood
  "08260",
  // Cape May (partial)
  "08204",

  // ── CUMBERLAND COUNTY ─────────────────────────────────────────────────────
  // Vineland
  "08360","08361","08362",
  // Bridgeton
  "08302",
  // Millville
  "08332",

  // ── SALEM COUNTY ──────────────────────────────────────────────────────────
  // Salem City
  "08079",
  // Penns Grove
  "08069",

  // ── GLOUCESTER COUNTY ─────────────────────────────────────────────────────
  // Woodbury
  "08096",
  // Glassboro
  "08028",

  // ── BURLINGTON COUNTY ─────────────────────────────────────────────────────
  // Burlington City
  "08016",
  // Mount Holly
  "08060",
  // Pemberton
  "08068",
]);

interface QuoteResult {
  systemType: "ducted" | "ductless";
  efficiency: "high" | "standard";
  projectCost: number;
  taxAmount: number;
  totalCost: number;
  njcleanheatRebate: number;
  decommissionAdder: number;
  reductAdder: number;
  additionalAdder: number;
  totalIncentive: number;
  outOfPocket: number;
  monthlyOBR84: number;
  monthlyOBR60: number;
  annualSavings: number;
  systemDescription: string;
  zones: number;
}

function calculateRebate(home: HomeDetails): { ducted: QuoteResult; ductless: QuoteResult } {
  const sqft = parseInt(home.sqft) || 1400;
  const bedrooms = parseInt(home.bedrooms) || 3;
  const floors = parseInt(home.floors) || 2;
  const isLMI = home.incomeLevel === "lmi";
  const hasGas = home.currentHeating === "gas" || home.currentHeating === "oil" || home.currentHeating === "propane";
  const hasExistingDucts = home.hasExistingDucts === "yes";

  // Determine number of systems/zones based on property size
  let numSystems = 1;
  let zones = bedrooms + 1; // bedrooms + living area
  if (sqft > 2000 || floors > 2) numSystems = 2;
  if (sqft > 3000) numSystems = 3;

  // Base cost calculation (based on real project data)
  // Small: $18K-24K, Medium: $22K-32K, Large: $30K-42K
  let baseCostDucted: number;
  let baseCostDuctless: number;
  let reductCost = 0;

  if (sqft <= 1000) {
    baseCostDucted = 18000;
    baseCostDuctless = 15500;
    zones = Math.min(zones, 4);
  } else if (sqft <= 1400) {
    baseCostDucted = 22000;
    baseCostDuctless = 18500;
    zones = Math.min(zones, 5);
  } else if (sqft <= 1800) {
    baseCostDucted = 26000;
    baseCostDuctless = 22000;
    zones = Math.min(zones, 6);
  } else if (sqft <= 2400) {
    baseCostDucted = 33000;
    baseCostDuctless = 28000;
    zones = Math.min(zones, 7);
  } else if (sqft <= 3000) {
    baseCostDucted = 39000;
    baseCostDuctless = 33000;
    zones = Math.min(zones, 8);
  } else {
    baseCostDucted = 48000;
    baseCostDuctless = 40000;
    zones = Math.min(zones, 10);
  }

  // Re-ducting cost for ducted systems (if no existing ducts or old home)
  const yearBuilt = parseInt(home.yearBuilt) || 1970;
  if (!hasExistingDucts || yearBuilt < 1980) {
    reductCost = Math.min(2000, sqft * 1.2); // up to $2K
    baseCostDucted += reductCost;
  }

  // High efficiency adds ~8% to cost
  const highEffMultiplier = 1.08;

  // rebate calculation
  const decommissionAdder = hasGas ? 2000 : 0;
  const reductAdder = reductCost > 0 ? Math.min(2000, reductCost) : 0;
  const additionalAdder = numSystems > 1 ? (numSystems - 1) * 2000 : 0;

  function calcRebate(projectCost: number): { njcleanheat: number; total: number } {
    const maxBase = isLMI ? 12000 : 10000;
    const pct = isLMI ? 0.60 : 0.50;
    const baseRebate = Math.min(maxBase, projectCost * pct);
    const totalRebate = baseRebate + decommissionAdder + reductAdder + additionalAdder;
    const maxTotal = isLMI ? 18000 : 16000;
    return { njcleanheat: baseRebate, total: Math.min(totalRebate, maxTotal) };
  }

  function buildResult(
    projectCostBase: number,
    systemType: "ducted" | "ductless",
    efficiency: "high" | "standard",
    desc: string
  ): QuoteResult {
    const projectCost = efficiency === "high" ? Math.round(projectCostBase * highEffMultiplier) : projectCostBase;
    const taxAmount = Math.round(projectCost * 0.06625);
    const totalCost = projectCost + taxAmount;
    const { njcleanheat, total: totalIncentive } = calcRebate(projectCost);
    const outOfPocket = Math.max(0, totalCost - totalIncentive);
    const monthlyOBR84 = Math.round((outOfPocket / 84) * 100) / 100;
    const monthlyOBR60 = Math.round((outOfPocket / 60) * 100) / 100;
    // Estimated annual savings: heat pumps are ~3x more efficient than gas
    const avgMonthlyBill = sqft * 0.12; // rough estimate
    const annualSavings = Math.round(avgMonthlyBill * 12 * 0.35); // 35% savings

    return {
      systemType,
      efficiency,
      projectCost,
      taxAmount,
      totalCost,
      njcleanheatRebate: njcleanheat,
      decommissionAdder,
      reductAdder,
      additionalAdder,
      totalIncentive,
      outOfPocket,
      monthlyOBR84,
      monthlyOBR60,
      annualSavings,
      systemDescription: desc,
      zones,
    };
  }

  const ductedDesc = `Ducted central air heat pump system — ${zones} zones, whole-home comfort with existing/new ductwork`;
  const ductlessDesc = `Ductless mini-split heat pump system — ${zones} wall-mounted units, individual room control`;

  return {
    ducted: buildResult(baseCostDucted, "ducted", "high", ductedDesc),
    ductless: buildResult(baseCostDuctless, "ductless", "high", ductlessDesc),
  };
}

// ─── Financing packages ───────────────────────────────────────────────────────
// The 3 packages have DIFFERENT total project costs because cost to Mechanical
// Enterprise changes based on how quickly they get paid.
//
// Option 1 — 3rd-Party Finance (base cost × 1.00): Client finances full amount
//   through a 3rd-party lender. We get paid immediately. Client receives MAX
//   rebate incentive (up to $16K) transferred back to them after install.
//
// Option 2 — 15% Deposit + NJ Clean Heat (base cost × 1.18): Client pays 15% upfront,
//   rest processed through NJ Clean Heat OBR. We wait ~8 weeks for NJ Clean Heat payment.
//   Higher project cost reflects the delay risk.
//
// Option 3 — 100% NJ Clean Heat OBR (base cost × 1.30): NJ Clean Heat covers everything via
//   On-Bill Repayment. We wait the full period for payment. Highest cost.

interface FinancingPackage {
  id: string;
  name: string;
  tagline: string;
  costMultiplier: number;        // Applied to base project cost to get THIS package's total
  upfrontPct: number;            // Fraction of total project cost paid upfront (0 = $0)
  upfrontFixed?: number;         // Fixed upfront amount (overrides pct if set)
  maxIncentive: number;          // Max rebate incentive client can receive
  giftCard: number;
  warrantyYears: number;
  maintenanceYears: number;
  highlight: boolean;
  badge?: string;
  description: string;
  creditApplied: number;
  paymentNote: string;           // Short note shown under monthly payment
}

const FINANCING_PACKAGES: FinancingPackage[] = [
  {
    id: "third_party_finance",
    name: "3rd-Party Finance",
    tagline: "Best deal — max incentive",
    costMultiplier: 1.00,          // Base price — we get paid immediately
    upfrontPct: 0,                 // $0 today
    maxIncentive: 16000,           // Full max rebate incentive transferred to client
    giftCard: 500,
    warrantyYears: 3,
    maintenanceYears: 1,
    highlight: true,
    badge: "BEST VALUE",
    description: "Finance the full project through our 3rd-party lender. We get paid upfront so we pass the maximum rebate incentive (up to $16,000) directly back to you after installation.",
    creditApplied: 500,
    paymentNote: "Monthly payments through 3rd-party lender",
  },
  {
    id: "deposit_15pct",
    name: "15% Deposit",
    tagline: "Lower monthly, partial upfront",
    costMultiplier: 1.18,          // 18% higher — we wait ~8 weeks for NJ Clean Heat payment
    upfrontPct: 0.15,              // 15% of total project cost
    maxIncentive: 14000,           // Slightly reduced incentive (delay cost)
    giftCard: 500,
    warrantyYears: 3,
    maintenanceYears: 1,
    highlight: false,
    description: "Pay 15% upfront to secure your slot. Remaining balance processed through NJ Clean Heat OBR program at 0% interest. Slightly higher project cost reflects our 8-week program payment wait.",
    creditApplied: 500,
    paymentNote: "Remaining balance via NJ Clean Heat OBR at 0% interest",
  },
  {
    id: "full_obr",
    name: "100% NJ Clean Heat OBR",
    tagline: "Zero upfront, NJ Clean Heat covers all",
    costMultiplier: 1.30,          // 30% higher — we wait full OBR period for payment
    upfrontPct: 0,                 // $0 today
    maxIncentive: 12000,           // Reduced incentive (full delay cost)
    giftCard: 250,
    warrantyYears: 2,
    maintenanceYears: 0,
    highlight: false,
    description: "NJ Clean Heat On-Bill Repayment covers 100% of the project cost. Pay nothing upfront — payments added to your utility bill at 0% interest. Higher project cost reflects the full payment delay.",
    creditApplied: 500,
    paymentNote: "Added to your monthly utility bill at 0% interest",
  },
];

// ─── Step components ──────────────────────────────────────────────────────────

const STEP_LABELS = ["Home Details", "System Options", "Financing", "Book Assessment"];

export default function RebateCalculator() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const [addressLookupStatus, setAddressLookupStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [addressConfirmed, setAddressConfirmed] = useState(false);
  const [home, setHome] = useState<HomeDetails>({
    address: "",
    city: "",
    state: "NJ",
    zip: "",
    county: "",
    neighborhood: "",
    propertyType: "single_family",
    yearBuilt: "",
    sqft: "",
    bedrooms: "3",
    floors: "2",
    currentHeating: "gas",
    incomeLevel: "standard",
    hasExistingDucts: "yes",
  });
  const [selectedSystem, setSelectedSystem] = useState<"ducted" | "ductless">("ducted");
  const [selectedEfficiency, setSelectedEfficiency] = useState<"high" | "standard">("high");
  const [selectedPackage, setSelectedPackage] = useState<string>("third_party_finance");
  const [quotes, setQuotes] = useState<{ ducted: QuoteResult; ductless: QuoteResult } | null>(null);
  const [bookingForm, setBookingForm] = useState({
    name: "",
    email: "",
    phone: "",
    preferredDate: "",
    preferredTime: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const submitAssessment = trpc.rebateCalculator.submitCalculation.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err: { message: string }) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Server-side geocoding via tRPC (bypasses browser API key restrictions)
  const geocodeMutation = trpc.rebateCalculator.geocodeAddress.useMutation({
    onSuccess: (data) => {
      if (!data.success) {
        setAddressLookupStatus('error');
        toast({ title: 'Address not found', description: 'Try entering a more specific address (e.g. 123 Main St, Newark, NJ)', variant: 'destructive' });
        return;
      }
      const isLmiZip = data.zip ? NJ_LMI_ZIPS.has(data.zip) : false;
      setHome(prev => ({
        ...prev,
        address: data.streetAddress || prev.address,
        city: data.city || prev.city,
        state: data.state || prev.state || 'NJ',
        zip: data.zip || prev.zip,
        county: data.county || prev.county,
        neighborhood: data.neighborhood || prev.neighborhood,
        ...(data.propertyType ? { propertyType: data.propertyType } : {}),
        ...(isLmiZip ? { incomeLevel: 'lmi' } : {}),
      }));
      setAddressConfirmed(true);
      setAddressLookupStatus('done');
      const lmiNote = isLmiZip ? ' · LMI area detected ✓' : '';
      const countyNote = data.county ? ` (${data.county})` : '';
      toast({
        title: '✓ Address confirmed!',
        description: `${data.city}${countyNote}, ${data.state} ${data.zip}${lmiNote}`,
      });
    },
    onError: () => {
      setAddressLookupStatus('error');
      toast({ title: 'Lookup failed', description: 'Could not look up address. You can fill in city/state/ZIP manually.', variant: 'destructive' });
    },
  });

  const lookupAddress = useCallback((addressText?: string) => {
    const query = (addressText ?? home.address).trim();
    if (!query || query.length < 5) {
      toast({ title: 'Enter your address', description: 'Please type your full street address first.', variant: 'destructive' });
      return;
    }
    setAddressLookupStatus('loading');
    geocodeMutation.mutate({ address: query });
  }, [home.address, toast, geocodeMutation]);

  const handleCalculate = () => {
    if (!home.sqft || !home.bedrooms) {
      toast({ title: "Missing info", description: "Please fill in square footage and bedrooms.", variant: "destructive" });
      return;
    }
    const result = calculateRebate(home);
    setQuotes(result);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Base quote (high-efficiency uses the calculated cost; standard removes rebates)
  const baseQuote = quotes
    ? selectedSystem === "ducted" ? quotes.ducted : quotes.ductless
    : null;

  // For standard efficiency: lower base cost but NO rebate incentives
  const activeQuote = baseQuote
    ? selectedEfficiency === "high"
      ? baseQuote
      : {
          ...baseQuote,
          efficiency: "standard" as const,
          projectCost: Math.round(baseQuote.projectCost / 1.08),
          taxAmount: Math.round((baseQuote.projectCost / 1.08) * 0.06625),
          totalCost: Math.round((baseQuote.projectCost / 1.08) * 1.06625),
          njcleanheatRebate: 0,
          decommissionAdder: 0,
          reductAdder: 0,
          additionalAdder: 0,
          totalIncentive: 0,
          outOfPocket: Math.round((baseQuote.projectCost / 1.08) * 1.06625),
          monthlyOBR84: Math.round(((baseQuote.projectCost / 1.08) * 1.06625) / 84),
          monthlyOBR60: Math.round(((baseQuote.projectCost / 1.08) * 1.06625) / 60),
        }
    : null;

  const activePkg = FINANCING_PACKAGES.find((p) => p.id === selectedPackage)!;

  // Each package has a DIFFERENT total project cost (costMultiplier) but the
  // SAME rebate/incentive amount — rebates are fixed by the program, not by
  // how you pay. Only the total job cost changes based on payment timing.
  // For LMI customers, Option 3 (100% OBR) allows up to 120-month repayment term
  const isLMICustomer = home.incomeLevel === "lmi";
  const obrTerm = (pkg: FinancingPackage) =>
    pkg.id === "njcleanheat_obr" && isLMICustomer ? 120 : 84;

  function getPkgCost(pkg: FinancingPackage, quote: typeof activeQuote) {
    if (!quote) return { totalCost: 0, upfront: 0, remaining: 0, monthly84: 0, monthly120: 0, termMonths: 84, incentive: 0, outOfPocket: 0 };
    const term = obrTerm(pkg);
    if (selectedEfficiency === "standard") {
      // Standard: no rebates, all packages use same base cost
      const totalCost = quote.totalCost;
      const upfront = Math.round(totalCost * pkg.upfrontPct);
      const remaining = totalCost - upfront;
      return { totalCost, upfront, remaining, monthly84: Math.round(remaining / 84), monthly120: Math.round(remaining / 120), termMonths: term, incentive: 0, outOfPocket: totalCost };
    }
    // High-efficiency: apply cost multiplier to get THIS package's total project cost
    // Rebate/incentive is ALWAYS the same (quote.totalIncentive) regardless of plan
    const pkgTotalCost = Math.round(quote.totalCost * pkg.costMultiplier);
    const incentive = quote.totalIncentive;  // Fixed — same for all plans
    const outOfPocket = Math.max(0, pkgTotalCost - incentive);
    const upfront = pkg.upfrontFixed !== undefined ? pkg.upfrontFixed : Math.round(pkgTotalCost * pkg.upfrontPct);
    const remaining = Math.max(0, outOfPocket - upfront);
    return { totalCost: pkgTotalCost, upfront, remaining, monthly84: Math.round(remaining / 84), monthly120: Math.round(remaining / 120), termMonths: term, incentive, outOfPocket };
  }

  const activePkgCost = getPkgCost(activePkg, activeQuote);
  const upfrontAmount = activePkgCost.upfront;
  const remainingOOP = activePkgCost.remaining;
  const monthlyOBR = activePkgCost.termMonths === 120 ? activePkgCost.monthly120 : activePkgCost.monthly84;
  const obrTermMonths = activePkgCost.termMonths;

  const handleSubmit = () => {
    if (!bookingForm.name || !bookingForm.phone) {
      toast({ title: "Missing info", description: "Please enter your name and phone number.", variant: "destructive" });
      return;
    }
    // Map old form fields to new procedure schema
    const nameParts = bookingForm.name.trim().split(' ');
    const firstName = nameParts[0] || bookingForm.name;
    const lastName = nameParts.slice(1).join(' ') || undefined;
    // Map currentHeating to currentSystem enum
    const systemMap: Record<string, string> = {
      gas: 'gas_furnace',
      oil: 'oil_furnace',
      propane: 'gas_furnace',
      electric: 'electric_baseboard',
      none: 'none',
    };
    const currentSystem = (systemMap[home.currentHeating] ?? 'none') as 'gas_furnace' | 'oil_furnace' | 'electric_baseboard' | 'central_ac' | 'heat_pump' | 'window_ac' | 'none';
    const propTypeMap: Record<string, string> = {
      single_family: 'single_family',
      multi_family: 'multi_family',
      condo: 'condo',
      townhouse: 'condo',
      commercial: 'single_family',
    };
    const propertyType = (propTypeMap[home.propertyType] ?? 'single_family') as 'single_family' | 'multi_family' | 'condo' | 'townhouse';
    submitAssessment.mutate({
      firstName,
      lastName,
      email: bookingForm.email || undefined,
      phone: bookingForm.phone,
      address: home.address || 'Not provided',
      city: home.city || undefined,
      state: home.state || 'NJ',
      zip: home.zip || undefined,
      propertyType,
      squareFootage: parseInt(home.sqft) || 1400,
      bedrooms: parseInt(home.bedrooms) || 3,
      stories: parseInt(home.floors) || 2,
      currentSystem,
      selectedOption: selectedEfficiency === 'high' ? 'high_efficiency' : 'standard',
      selectedPaymentTier: selectedPackage === 'full_finance' ? 'full_finance' : selectedPackage === 'deposit_12pct' ? 'deposit_12pct' : 'full_payment',
      assessmentRequested: true,
    });
  };

  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <Navigation />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white py-12 overflow-hidden">
        <div className="w-full max-w-4xl mx-auto px-5 text-center">
          <Badge className="mb-3 bg-[#ff6b35] text-white hover:bg-[#ff6b35]/90">NJ Clean Heat Rebate Program</Badge>
          <h1 className="text-xl sm:text-3xl md:text-4xl font-bold mb-3 leading-tight">
            How Much Can You Get<br className="sm:hidden" /> in Rebates?
          </h1>
          <p className="text-sm sm:text-lg text-white/85 max-w-2xl mx-auto">
            NJ homeowners receive up to <strong>$16,000 in rebates &amp; incentives</strong> on heat pump upgrades — plus 0% financing. Get your estimate in 2 minutes.
          </p>
          {/* Progress bar — compact on mobile */}
          <div className="mt-6 flex items-center justify-center gap-1 flex-wrap">
            {STEP_LABELS.map((label, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className={`flex items-center gap-1 rounded-full font-medium transition-all
                  px-2 py-1 text-xs
                  ${step === i + 1 ? 'bg-[#ff6b35] text-white' : step > i + 1 ? 'bg-white/30 text-white' : 'bg-white/10 text-white/50'}`}>
                  {step > i + 1
                    ? <CheckCircle className="h-3 w-3" />
                    : <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  }
                  <span className="hidden xs:inline sm:inline">{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && <ChevronRight className="h-3 w-3 text-white/30 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="w-full max-w-4xl mx-auto px-4 py-10 overflow-hidden">

        {/* ── STEP 1: Home Details ── */}
        {step === 1 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#1e3a5f]">
                  <MapPin className="h-5 w-5 text-[#ff6b35]" /> Your Home Address
                </CardTitle>
                <CardDescription>Enter your address and we'll pre-fill your home details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="address">Street Address</Label>
                  <div className="flex flex-col sm:flex-row gap-2 mt-1">
                    <Input
                      id="address"
                      ref={addressInputRef}
                      placeholder="e.g. 123 Main St, Newark, NJ"
                      value={home.address}
                      onChange={(e) => {
                        setHome({ ...home, address: e.target.value });
                        if (addressConfirmed) setAddressConfirmed(false);
                        if (addressLookupStatus === 'done') setAddressLookupStatus('idle');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          lookupAddress();
                        }
                      }}
                      className={addressConfirmed ? 'border-green-500 bg-green-50' : ''}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => lookupAddress()}
                      disabled={addressLookupStatus === 'loading'}
                      className="w-full sm:w-auto shrink-0 border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white"
                    >
                      {addressLookupStatus === 'loading' ? (
                        <span className="flex items-center justify-center gap-1"><span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" /> Looking up...</span>
                      ) : addressConfirmed ? (
                        <span className="flex items-center justify-center gap-1"><CheckCircle className="h-4 w-4 text-green-500" /> Confirmed</span>
                      ) : (
                        '🔍 Look Up Address'
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {addressConfirmed ? (
                      <span className="text-green-600 font-medium">
                        ✓ {home.city}{home.county ? ` (${home.county})` : ''}, {home.state} {home.zip} auto-filled
                        {NJ_LMI_ZIPS.has(home.zip) ? ' · LMI area detected ✓' : ''}
                      </span>
                    ) : (
                      'Type your full address and click "Look Up" to auto-fill city, state, ZIP, and county'
                    )}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 md:col-span-1">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="e.g. Newark"
                      value={home.city}
                      onChange={(e) => setHome({ ...home, city: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={home.state || 'NJ'}
                      onChange={(e) => setHome({ ...home, state: e.target.value })}
                      className="mt-1"
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input
                      id="zip"
                      placeholder="07105"
                      value={home.zip}
                      onChange={(e) => setHome({ ...home, zip: e.target.value })}
                      className="mt-1"
                      maxLength={5}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#1e3a5f]">
                  <Home className="h-5 w-5 text-[#ff6b35]" /> Property Details
                </CardTitle>
                <CardDescription>Help us size the right system for your home</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Property Type</Label>
                    <Select value={home.propertyType} onValueChange={(v) => setHome({ ...home, propertyType: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single_family">Single Family</SelectItem>
                        <SelectItem value="multi_family">Multi-Family</SelectItem>
                        <SelectItem value="condo">Condo / Townhouse</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="yearBuilt">Year Built</Label>
                    <Input
                      id="yearBuilt"
                      placeholder="e.g. 1965"
                      value={home.yearBuilt}
                      onChange={(e) => setHome({ ...home, yearBuilt: e.target.value })}
                      className="mt-1"
                      maxLength={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sqft">Square Footage</Label>
                    <Input
                      id="sqft"
                      placeholder="e.g. 1400"
                      value={home.sqft}
                      onChange={(e) => setHome({ ...home, sqft: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Bedrooms</Label>
                    <Select value={home.bedrooms} onValueChange={(v) => setHome({ ...home, bedrooms: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["1","2","3","4","5","6+"].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Number of Floors</Label>
                    <Select value={home.floors} onValueChange={(v) => setHome({ ...home, floors: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["1","2","3","4"].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Existing Ductwork?</Label>
                    <Select value={home.hasExistingDucts} onValueChange={(v) => setHome({ ...home, hasExistingDucts: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes — has ducts</SelectItem>
                        <SelectItem value="no">No — no ducts</SelectItem>
                        <SelectItem value="partial">Partial / Old ducts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#1e3a5f]">
                  <Thermometer className="h-5 w-5 text-[#ff6b35]" /> Current Heating System
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Current Heating Fuel</Label>
                    <Select value={home.currentHeating} onValueChange={(v) => setHome({ ...home, currentHeating: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gas">Natural Gas</SelectItem>
                        <SelectItem value="oil">Oil</SelectItem>
                        <SelectItem value="propane">Propane</SelectItem>
                        <SelectItem value="electric">Electric</SelectItem>
                        <SelectItem value="none">No heating system</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Label>Income Level</Label>
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground hover:text-[#ff6b35] transition-colors" aria-label="What is LMI?">
                              <HelpCircle className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs p-3 text-sm" sideOffset={6}>
                            <div className="space-y-2">
                              <p className="font-semibold text-base">What is LMI?</p>
                              <p><strong>Low-to-Moderate Income (LMI)</strong> is a program designation for households earning below 80% of the Area Median Income (AMI) for their county.</p>
                              <p className="text-muted-foreground">LMI households qualify for a <strong className="text-green-600">60% base rebate</strong> instead of the standard 50%, which can mean up to <strong>$12,000</strong> more in incentives on a typical project.</p>
                              <div className="border-t pt-2 mt-2">
                                <p className="font-medium">Essex County 2024 LMI thresholds:</p>
                                <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                  <li>1 person: ≤ $57,750/yr</li>
                                  <li>2 people: ≤ $66,000/yr</li>
                                  <li>3 people: ≤ $74,250/yr</li>
                                  <li>4 people: ≤ $82,400/yr</li>
                                </ul>
                              </div>
                              <p className="text-xs text-muted-foreground">The program may request proof of income (tax return or pay stub) during the rebate application process.</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {NJ_LMI_ZIPS.has(home.zip) && (
                        <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                          <Info className="h-3 w-3" /> LMI area detected
                        </span>
                      )}
                    </div>
                    <Select value={home.incomeLevel} onValueChange={(v) => setHome({ ...home, incomeLevel: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard Income (50% rebate)</SelectItem>
                        <SelectItem value="lmi">Low-to-Moderate Income — LMI (60% rebate)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {home.incomeLevel === "lmi" && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                    <strong>LMI Bonus Applied:</strong> Your estimate uses the <strong>60% base rebate rate</strong> — up to <strong>$12,000</strong> more than the standard 50% rate. The program will verify income eligibility during the application process.
                  </div>
                )}
                {home.currentHeating === "electric" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    <strong>Note:</strong> NJ Clean Heat program requires replacing a fossil fuel heating system. If you currently heat with electric, please contact us to discuss your eligibility.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                type="button"
                size="lg"
                className="w-full sm:w-auto bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold px-8 py-4 text-base"
                onClick={(e) => { e.preventDefault(); handleCalculate(); }}
              >
                Calculate My Rebates <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: System Options ── */}
        {step === 2 && quotes && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-[#1e3a5f]">Your Personalized Quote</h2>
              <p className="text-muted-foreground mt-1">
                Based on your {home.sqft} sqft, {home.bedrooms}-bedroom home at {home.address || "your address"}
              </p>
            </div>

            {/* System type toggle */}
            <div className="flex gap-3 justify-center">
              {(["ducted", "ductless"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedSystem(type)}
                  className={`px-5 py-2 rounded-full font-medium text-sm border-2 transition-all ${selectedSystem === type ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "bg-white text-[#1e3a5f] border-[#1e3a5f]/30 hover:border-[#1e3a5f]"}`}
                >
                  {type === "ducted" ? "🏠 Ducted (Central Air)" : "❄️ Ductless (Mini-Split)"}
                </button>
              ))}
            </div>

            {/* Efficiency toggle */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-3">
                {(["high", "standard"] as const).map((eff) => (
                  <button
                    key={eff}
                    onClick={() => setSelectedEfficiency(eff)}
                    className={`px-4 py-1.5 rounded-full font-medium text-sm border transition-all ${selectedEfficiency === eff ? "bg-[#ff6b35] text-white border-[#ff6b35]" : "bg-white text-gray-600 border-gray-300 hover:border-[#ff6b35]"}`}
                  >
                    {eff === "high" ? "⚡ High-Efficiency (NJ Clean Heat Eligible)" : "📊 Standard Efficiency (No Rebates)"}
                  </button>
                ))}
              </div>
              {selectedEfficiency === "standard" && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1">
                  ⚠️ Standard efficiency systems are <strong>not eligible</strong> for rebate incentives. Shown for comparison only.
                </p>
              )}
              {selectedEfficiency === "high" && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1">
                  ✅ High-efficiency heat pumps qualify for up to <strong>$16,000</strong> in NJ Clean Heat incentives.
                </p>
              )}
            </div>

            {activeQuote && (
              <>
                {/* Main quote card */}
                <Card className="border-2 border-[#1e3a5f] shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-[#1e3a5f] to-[#2a5a8f] text-white rounded-t-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl">
                          {selectedSystem === "ducted" ? "Ducted Heat Pump System" : "Ductless Mini-Split System"}
                          {selectedEfficiency === "high" && <Badge className="ml-2 bg-[#ff6b35] text-white text-xs">HIGH EFFICIENCY</Badge>}
                        </CardTitle>
                        <CardDescription className="text-white/80 mt-1">{activeQuote.systemDescription}</CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-white/70">Total Project Cost</div>
                        <div className="text-2xl font-bold">{fmt(activeQuote.totalCost)}</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {/* Cost breakdown */}
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h3 className="font-semibold text-[#1e3a5f] text-sm uppercase tracking-wide">Cost Breakdown</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-muted-foreground">Equipment & Labor</span><span className="font-medium">{fmt(activeQuote.projectCost)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">NJ Tax (6.625%)</span><span className="font-medium">{fmt(activeQuote.taxAmount)}</span></div>
                          <Separator />
                          <div className="flex justify-between font-semibold"><span>Total Project Cost</span><span>{fmt(activeQuote.totalCost)}</span></div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h3 className="font-semibold text-green-700 text-sm uppercase tracking-wide">Rebate Incentives</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-muted-foreground">Base Rebate ({home.incomeLevel === "lmi" ? "LMI 60%" : "50%"})</span><span className="font-medium text-green-700">-{fmt(activeQuote.njcleanheatRebate)}</span></div>
                          {activeQuote.decommissionAdder > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Decommissioning Adder</span><span className="font-medium text-green-700">-{fmt(activeQuote.decommissionAdder)}</span></div>}
                          {activeQuote.reductAdder > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Re-ducting Adder</span><span className="font-medium text-green-700">-{fmt(activeQuote.reductAdder)}</span></div>}
                          {activeQuote.additionalAdder > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Additional System Adder</span><span className="font-medium text-green-700">-{fmt(activeQuote.additionalAdder)}</span></div>}
                          <Separator />
                          <div className="flex justify-between font-bold text-green-700"><span>Total Rebate Incentive</span><span>-{fmt(activeQuote.totalIncentive)}</span></div>
                        </div>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    {/* Key numbers */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="bg-[#1e3a5f]/5 rounded-lg p-4">
                        <div className="text-2xl font-bold text-[#1e3a5f]">{fmt(activeQuote.totalIncentive)}</div>
                        <div className="text-xs text-muted-foreground mt-1">Total Rebate</div>
                      </div>
                      <div className="bg-[#ff6b35]/10 rounded-lg p-4">
                        <div className="text-2xl font-bold text-[#ff6b35]">{fmt(activeQuote.outOfPocket)}</div>
                        <div className="text-xs text-muted-foreground mt-1">Your Out-of-Pocket</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-green-700">{fmt(activeQuote.annualSavings)}/yr</div>
                        <div className="text-xs text-muted-foreground mt-1">Est. Energy Savings</div>
                      </div>
                    </div>

                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                      <strong>0% OBR Financing:</strong> Your {fmt(activeQuote.outOfPocket)} out-of-pocket can be financed through NJ Clean Heat On-Bill Repayment program at 0% interest — as low as <strong>{fmt(home.incomeLevel === "lmi" ? Math.round(activeQuote.outOfPocket / 120) : activeQuote.monthlyOBR84)}/month</strong> over {home.incomeLevel === "lmi" ? "120" : "84"} months{home.incomeLevel === "lmi" ? " (LMI extended term)" : ""}.
                    </div>
                  </CardContent>
                </Card>

                {/* Comparison tables */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Ducted vs Ductless */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-[#1e3a5f] text-sm">Ducted vs Ductless</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 text-muted-foreground font-medium text-xs"></th>
                              <th className={`text-center py-2 px-2 font-semibold text-xs ${selectedSystem === "ducted" ? "text-[#1e3a5f] bg-[#1e3a5f]/5" : "text-muted-foreground"}`}>🏠 Ducted</th>
                              <th className={`text-center py-2 px-2 font-semibold text-xs ${selectedSystem === "ductless" ? "text-[#1e3a5f] bg-[#1e3a5f]/5" : "text-muted-foreground"}`}>❄️ Ductless</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {[
                              ["Project Cost", fmt(quotes.ducted.totalCost), fmt(quotes.ductless.totalCost)],
                              ["Rebate Incentive", selectedEfficiency === "high" ? fmt(quotes.ducted.totalIncentive) : "N/A", selectedEfficiency === "high" ? fmt(quotes.ductless.totalIncentive) : "N/A"],
                              ["Out-of-Pocket", selectedEfficiency === "high" ? fmt(quotes.ducted.outOfPocket) : fmt(quotes.ducted.totalCost), selectedEfficiency === "high" ? fmt(quotes.ductless.outOfPocket) : fmt(quotes.ductless.totalCost)],
                              ["Energy Savings", `${fmt(quotes.ducted.annualSavings)}/yr`, `${fmt(quotes.ductless.annualSavings)}/yr`],
                              ["Zones", `${quotes.ducted.zones} zones`, `${quotes.ductless.zones} units`],
                            ].map(([label, d, dl]) => (
                              <tr key={label}>
                                <td className="py-1.5 text-muted-foreground text-xs">{label}</td>
                                <td className={`text-center py-1.5 px-2 font-medium text-xs ${selectedSystem === "ducted" ? "bg-[#1e3a5f]/5" : ""}`}>{d}</td>
                                <td className={`text-center py-1.5 px-2 font-medium text-xs ${selectedSystem === "ductless" ? "bg-[#1e3a5f]/5" : ""}`}>{dl}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* High-Efficiency vs Standard */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-[#1e3a5f] text-sm">High-Efficiency vs Standard</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 text-muted-foreground font-medium text-xs"></th>
                              <th className={`text-center py-2 px-2 font-semibold text-xs ${selectedEfficiency === "high" ? "text-[#ff6b35] bg-[#ff6b35]/5" : "text-muted-foreground"}`}>⚡ High-Eff</th>
                              <th className={`text-center py-2 px-2 font-semibold text-xs ${selectedEfficiency === "standard" ? "text-gray-700 bg-gray-50" : "text-muted-foreground"}`}>📊 Standard</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {(() => {
                              const hiQ = selectedSystem === "ducted" ? quotes.ducted : quotes.ductless;
                              const stdCost = Math.round(hiQ.projectCost / 1.08);
                              const stdTotal = Math.round(stdCost * 1.06625);
                              return [
                                ["Project Cost", fmt(hiQ.totalCost), fmt(stdTotal)],
                                ["Rebate Incentive", fmt(hiQ.totalIncentive), "$0 (ineligible)"],
                                ["Out-of-Pocket", fmt(hiQ.outOfPocket), fmt(stdTotal)],
                                [home.incomeLevel === "lmi" ? "Monthly (120mo LMI)" : "Monthly (84mo)", home.incomeLevel === "lmi" ? `${fmt(Math.round(hiQ.outOfPocket / 120))}/mo` : `${fmt(hiQ.monthlyOBR84)}/mo`, `${fmt(Math.round(stdTotal / 84))}/mo`],
                                ["Energy Savings", `${fmt(hiQ.annualSavings)}/yr`, `${fmt(Math.round(hiQ.annualSavings * 0.6))}/yr`],
                              ].map(([label, hi, std]) => (
                                <tr key={label}>
                                  <td className="py-1.5 text-muted-foreground text-xs">{label}</td>
                                  <td className={`text-center py-1.5 px-2 font-medium text-xs ${selectedEfficiency === "high" ? "bg-[#ff6b35]/5" : ""}`}>{hi}</td>
                                  <td className={`text-center py-1.5 px-2 font-medium text-xs ${selectedEfficiency === "standard" ? "bg-gray-50" : ""}`}>{std}</td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-green-700 mt-2 font-medium">High-efficiency saves more — even with higher upfront cost.</p>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-between gap-3">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setStep(1)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button size="lg" className="w-full sm:w-auto bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold px-8" onClick={() => { setStep(3); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                Choose Financing <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Financing Packages ── */}
        {step === 3 && activeQuote && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-[#1e3a5f]">Choose Your Financing Package</h2>
              <p className="text-muted-foreground mt-1">Your out-of-pocket: <strong>{fmt(activeQuote.outOfPocket)}</strong> — select how you'd like to handle it</p>
            </div>

            {selectedEfficiency === "standard" && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">⚠️</span>
                <span><strong>Standard efficiency systems do not qualify for rebate incentives.</strong> Shown for comparison only. Switch to High-Efficiency to unlock up to $16,000 in incentives.</span>
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-4">
              {FINANCING_PACKAGES.map((pkg) => {
                const pkgCost = getPkgCost(pkg, activeQuote);
                const isSelected = selectedPackage === pkg.id;
                const isHighEff = selectedEfficiency === "high";
                return (
                  <div
                    key={pkg.id}
                    onClick={() => setSelectedPackage(pkg.id)}
                    className={`relative cursor-pointer rounded-xl border-2 p-5 transition-all ${isSelected ? "border-[#ff6b35] shadow-lg bg-white" : "border-gray-200 bg-white hover:border-[#1e3a5f]/40"} ${pkg.highlight ? "ring-2 ring-[#ff6b35]/20" : ""}`}
                  >
                    {pkg.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-[#ff6b35] text-white text-xs px-3">{pkg.badge}</Badge>
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-[#1e3a5f] text-lg">{pkg.name}</h3>
                        <p className="text-sm text-muted-foreground">{pkg.tagline}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-1 ${isSelected ? "border-[#ff6b35] bg-[#ff6b35]" : "border-gray-300"}`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>

                    {/* Total project cost for this package */}
                    <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3 text-center">
                      <div className="text-xs text-muted-foreground">Total Project Cost</div>
                      <div className="text-xl font-bold text-[#1e3a5f]">{fmt(pkgCost.totalCost)}</div>
                    </div>

                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Upfront Payment</span>
                        <span className="font-bold text-[#1e3a5f] text-base">{pkgCost.upfront === 0 ? "$0" : fmt(pkgCost.upfront)}</span>
                      </div>
                      {isHighEff && pkgCost.incentive > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Rebate Incentive</span>
                          <span className="font-medium text-green-700">-{fmt(pkgCost.incentive)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{pkg.id === "third_party_finance" ? "Financed Balance" : "OBR Balance (0%)"}</span>
                        <span className="font-medium">{fmt(pkgCost.remaining)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monthly ({pkgCost.termMonths} months)</span>
                        <span className="font-medium text-green-700">{fmt(pkgCost.termMonths === 120 ? pkgCost.monthly120 : pkgCost.monthly84)}/mo</span>
                      </div>
                      {pkgCost.termMonths === 120 && (
                        <div className="text-xs text-green-700 font-medium">✓ LMI extended term (120 months)</div>
                      )}
                    </div>

                    <Separator className="my-3" />

                    <div className="space-y-1.5 text-xs">
                      {isHighEff && (
                        <div className="flex items-center gap-2 text-green-700">
                          <TrendingDown className="h-3.5 w-3.5" />
                          <span>Up to {fmt(pkg.maxIncentive)} Rebate Incentive</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-green-700">
                        <Gift className="h-3.5 w-3.5" />
                        <span>{fmt(pkg.giftCard)} Gift Card</span>
                      </div>
                      <div className="flex items-center gap-2 text-[#1e3a5f]">
                        <Shield className="h-3.5 w-3.5" />
                        <span>{pkg.warrantyYears}-Year Warranty Service</span>
                      </div>
                      {pkg.maintenanceYears > 0 && (
                        <div className="flex items-center gap-2 text-[#1e3a5f]">
                          <Zap className="h-3.5 w-3.5" />
                          <span>{pkg.maintenanceYears}-Year Maintenance Included</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[#ff6b35]">
                        <Award className="h-3.5 w-3.5" />
                        <span>$500 Assessment Credit Applied</span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{pkg.description}</p>
                  </div>
                );
              })}
            </div>

            {/* Selected package summary */}
            <Card className="bg-[#1e3a5f] text-white">
              <CardContent className="pt-5">
                <div className="flex flex-wrap gap-6 justify-between items-center">
                  <div>
                    <div className="text-white/70 text-sm">Selected: {activePkg.name}</div>
                    <div className="text-2xl font-bold mt-1">
                      {upfrontAmount === 0 ? "$0 Today" : `${fmt(upfrontAmount)} Today`}
                    </div>
                    <div className="text-white/70 text-sm mt-1">
                      {monthlyOBR > 0 ? `Then ${fmt(monthlyOBR)}/month for ${obrTermMonths} months` : "No monthly payments"}
                      {activePkg.id !== "third_party_finance" ? " at 0% interest" : " via 3rd-party lender"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white/70 text-sm">Total Project Cost</div>
                    <div className="text-xl font-bold">{fmt(activePkgCost.totalCost)}</div>
                    {selectedEfficiency === "high" && activePkgCost.incentive > 0 && (
                      <div className="text-green-400 font-semibold text-sm mt-1">Rebate Incentive: -{fmt(activePkgCost.incentive)}</div>
                    )}
                    <div className="text-white/70 text-sm mt-1">{fmt(activePkg.giftCard)} gift card + {activePkg.warrantyYears}yr warranty</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col-reverse sm:flex-row justify-between gap-3">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setStep(2)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button size="lg" className="w-full sm:w-auto bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold px-8" onClick={() => { setStep(4); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                Book Free Assessment <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Book Assessment ── */}
        {step === 4 && (
          <div className="space-y-6">
            {submitted ? (
              <Card className="text-center py-12">
                <CardContent>
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-[#1e3a5f] mb-2">Assessment Requested!</h2>
                  <p className="text-muted-foreground max-w-md mx-auto mb-6">
                    Thank you! Our team will contact you within 24 hours to confirm your free assessment appointment. Your <strong>$500 credit</strong> has been applied to your account.
                  </p>
                  <div className="bg-[#1e3a5f]/5 rounded-lg p-4 max-w-sm mx-auto text-sm space-y-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">System Selected</span><span className="font-medium capitalize">{selectedSystem}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Package</span><span className="font-medium">{activePkg.name}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Est. Rebate</span><span className="font-medium text-green-700">{activeQuote ? fmt(activeQuote.totalIncentive) : "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Gift Card</span><span className="font-medium">{fmt(activePkg.giftCard)}</span></div>
                  </div>
                  <div className="mt-6 flex gap-3 justify-center">
                    <Button className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90" onClick={() => window.location.href = "/"}>Back to Home</Button>
                    <Button variant="outline" onClick={() => window.location.href = "tel:+18624239396"}>
                      <Phone className="h-4 w-4 mr-2" /> Call Us Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-[#1e3a5f]">Book Your Free Assessment</h2>
                  <p className="text-muted-foreground mt-1">A $500 credit is automatically applied — no obligation, no cost</p>
                </div>

                {/* Summary banner */}
                {activeQuote && (
                  <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2a5a8f] text-white rounded-xl p-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div><div className="text-white/70 text-xs">System</div><div className="font-semibold capitalize">{selectedSystem}</div></div>
                      <div><div className="text-white/70 text-xs">Rebate</div><div className="font-semibold text-green-400">{fmt(activeQuote.totalIncentive)}</div></div>
                      <div><div className="text-white/70 text-xs">Package</div><div className="font-semibold">{activePkg.name}</div></div>
                      <div><div className="text-white/70 text-xs">Gift Card</div><div className="font-semibold text-[#ff6b35]">{fmt(activePkg.giftCard)}</div></div>
                    </div>
                  </div>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-[#1e3a5f] flex items-center gap-2">
                      <User className="h-5 w-5 text-[#ff6b35]" /> Your Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Full Name *</Label>
                        <Input id="name" placeholder="John Smith" value={bookingForm.name} onChange={(e) => setBookingForm({ ...bookingForm, name: e.target.value })} className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone Number *</Label>
                        <Input id="phone" placeholder="(862) 555-0100" value={bookingForm.phone} onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })} className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="email">Email Address</Label>
                        <Input id="email" type="email" placeholder="john@example.com" value={bookingForm.email} onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })} className="mt-1" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-[#1e3a5f] flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-[#ff6b35]" /> Preferred Assessment Time
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="prefDate">Preferred Date</Label>
                        <Input id="prefDate" type="date" value={bookingForm.preferredDate} onChange={(e) => setBookingForm({ ...bookingForm, preferredDate: e.target.value })} className="mt-1" min={new Date().toISOString().split("T")[0]} />
                      </div>
                      <div>
                        <Label>Preferred Time</Label>
                        <Select value={bookingForm.preferredTime} onValueChange={(v) => setBookingForm({ ...bookingForm, preferredTime: v })}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select time" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="morning">Morning (8am–12pm)</SelectItem>
                            <SelectItem value="afternoon">Afternoon (12pm–4pm)</SelectItem>
                            <SelectItem value="evening">Evening (4pm–7pm)</SelectItem>
                            <SelectItem value="flexible">I'm flexible</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="notes">Additional Notes (optional)</Label>
                      <Input id="notes" placeholder="e.g. best entrance, parking info, questions..." value={bookingForm.notes} onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })} className="mt-1" />
                    </div>
                  </CardContent>
                </Card>

                {/* What to expect */}
                <div className="bg-gray-50 rounded-xl p-5 border">
                  <h3 className="font-semibold text-[#1e3a5f] mb-3">What happens next?</h3>
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    {[
                      { icon: Phone, step: "1", title: "We call you", desc: "Within 24 hours to confirm your appointment" },
                      { icon: Home, step: "2", title: "Free home visit", desc: "Our technician assesses your home (1–2 hours)" },
                      { icon: BadgeCheck, step: "3", title: "Final proposal", desc: "Exact pricing, rebates, and installation schedule" },
                    ].map(({ icon: Icon, step: s, title, desc }) => (
                      <div key={s} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#ff6b35] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{s}</div>
                        <div><div className="font-medium text-[#1e3a5f]">{title}</div><div className="text-muted-foreground">{desc}</div></div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-between gap-3">
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => setStep(3)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button
                    size="lg"
                    className="w-full sm:w-auto bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold px-8"
                    onClick={handleSubmit}
                    disabled={submitAssessment.isPending}
                  >
                    {submitAssessment.isPending ? "Submitting..." : "Request Free Assessment"} <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

/**
 * Rebate Calculator Router
 * Public-facing tool for homeowners to estimate HVAC rebates and place assessment orders
 */
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { rebateCalculations } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db;
}

/**
 * PSEG NJ Rebate Logic (based on 2024-2025 PSEG Home Comfort Program)
 * High-Efficiency Heat Pump (HSPF2 ≥ 8.1, SEER2 ≥ 16): up to $7,000 per unit
 * Standard Heat Pump (HSPF2 ≥ 7.5, SEER2 ≥ 14.3): up to $3,000 per unit
 * Additional rebates for whole-home electrification: up to $9,000
 * Federal Tax Credit (25C): 30% of cost, up to $2,000/year for heat pumps
 */
function calculateRebates(input: {
  squareFootage: number;
  bedrooms: number;
  stories: number;
  currentSystem: string;
  propertyType: string;
}) {
  const { squareFootage, bedrooms, stories, currentSystem } = input;

  // Determine number of units needed based on sq footage
  // Typical: 1 unit per 800-1200 sq ft for VRF/mini-split
  const unitsNeeded = Math.max(1, Math.ceil(squareFootage / 1000));

  // Base equipment cost estimates
  const highEfficiencyUnitCost = 4500; // per unit (SEER2 ≥ 18, HSPF2 ≥ 9)
  const standardUnitCost = 2800; // per unit (SEER2 ≥ 14.3, HSPF2 ≥ 7.5)
  const laborCostBase = 1800; // base labor
  const laborCostPerUnit = 600; // additional per unit

  const highEfficiencyEquipment = highEfficiencyUnitCost * unitsNeeded;
  const standardEquipment = standardUnitCost * unitsNeeded;
  const laborCost = laborCostBase + laborCostPerUnit * unitsNeeded;

  const highEfficiencyTotal = highEfficiencyEquipment + laborCost;
  const standardTotal = standardEquipment + laborCost;

  // PSEG Rebates
  // High-efficiency: $7,000 per unit (capped at $14,000 for residential)
  const psegHighEfficiencyPerUnit = 7000;
  const psegStandardPerUnit = 3000;

  // Bonus rebate for replacing fossil fuel systems (gas/oil)
  const fossilFuelBonus = ["gas_furnace", "oil_furnace"].includes(currentSystem) ? 2000 : 0;

  const psegHighEfficiency = Math.min(psegHighEfficiencyPerUnit * unitsNeeded + fossilFuelBonus, 16000);
  const psegStandard = Math.min(psegStandardPerUnit * unitsNeeded + fossilFuelBonus, 9000);

  // Federal Tax Credit (IRA Section 25C): 30% up to $2,000 for heat pumps
  const federalHighEfficiency = Math.min(highEfficiencyEquipment * 0.30, 2000);
  const federalStandard = Math.min(standardEquipment * 0.30, 2000);

  // Annual energy savings estimate
  const annualSavingsHighEfficiency = Math.round(squareFootage * 0.65); // ~$0.65/sqft/year
  const annualSavingsStandard = Math.round(squareFootage * 0.45);

  return {
    unitsNeeded,
    highEfficiency: {
      equipmentCost: highEfficiencyEquipment,
      laborCost,
      totalProjectCost: highEfficiencyTotal,
      psegRebate: psegHighEfficiency,
      federalTaxCredit: federalHighEfficiency,
      totalRebates: psegHighEfficiency + federalHighEfficiency,
      outOfPocket: Math.max(0, highEfficiencyTotal - psegHighEfficiency - federalHighEfficiency),
      annualSavings: annualSavingsHighEfficiency,
      paybackYears: Math.round((highEfficiencyTotal - psegHighEfficiency - federalHighEfficiency) / annualSavingsHighEfficiency),
      seer2: "≥ 18",
      hspf2: "≥ 9.0",
      warranty: "10-year manufacturer + 3-year ME service",
    },
    standard: {
      equipmentCost: standardEquipment,
      laborCost,
      totalProjectCost: standardTotal,
      psegRebate: psegStandard,
      federalTaxCredit: federalStandard,
      totalRebates: psegStandard + federalStandard,
      outOfPocket: Math.max(0, standardTotal - psegStandard - federalStandard),
      annualSavings: annualSavingsStandard,
      paybackYears: Math.round((standardTotal - psegStandard - federalStandard) / annualSavingsStandard),
      seer2: "≥ 14.3",
      hspf2: "≥ 7.5",
      warranty: "5-year manufacturer + 2-year ME service",
    },
    fossilFuelBonus,
  };
}

export const rebateCalculatorRouter = router({
  /**
   * Calculate rebates based on property info (public — no auth required)
   */
  calculate: publicProcedure
    .input(
      z.object({
        squareFootage: z.number().min(200).max(20000),
        bedrooms: z.number().min(0).max(20),
        bathrooms: z.number().min(0).max(20).optional().default(1),
        stories: z.number().min(1).max(5).optional().default(1),
        currentSystem: z.enum(["gas_furnace", "oil_furnace", "electric_baseboard", "central_ac", "heat_pump", "window_ac", "none"]),
        propertyType: z.enum(["single_family", "multi_family", "condo", "townhouse"]).optional().default("single_family"),
      })
    )
    .query(({ input }) => {
      return calculateRebates(input);
    }),

  /**
   * Submit a rebate calculation and optionally request an assessment (public)
   */
  submitCalculation: publicProcedure
    .input(
      z.object({
        // Contact info
        firstName: z.string().min(1),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        // Property info
        address: z.string().min(5),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        propertyType: z.enum(["single_family", "multi_family", "condo", "townhouse"]).optional().default("single_family"),
        squareFootage: z.number().min(200).max(20000),
        bedrooms: z.number().min(0).max(20),
        bathrooms: z.number().min(0).max(20).optional(),
        stories: z.number().min(1).max(5).optional(),
        currentSystem: z.enum(["gas_furnace", "oil_furnace", "electric_baseboard", "central_ac", "heat_pump", "window_ac", "none"]),
        systemAge: z.number().min(0).max(50).optional(),
        // Selected option
        selectedOption: z.enum(["high_efficiency", "standard"]),
        selectedPaymentTier: z.enum(["full_finance", "deposit_12pct", "full_payment"]),
        // Assessment request
        assessmentRequested: z.boolean().default(false),
        // Raw property data JSON
        propertyDataJson: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();

      const rebates = calculateRebates({
        squareFootage: input.squareFootage,
        bedrooms: input.bedrooms,
        stories: input.stories ?? 1,
        currentSystem: input.currentSystem,
        propertyType: input.propertyType ?? "single_family",
      });

      const option = input.selectedOption === "high_efficiency" ? rebates.highEfficiency : rebates.standard;

      // Calculate final out-of-pocket based on payment tier
      let finalOutOfPocket = option.outOfPocket;
      let giftCard = 0;
      let warrantyYears = 3;

      if (input.selectedPaymentTier === "full_payment") {
        // Client pays 100% upfront → max rebates + $500 credit applied
        finalOutOfPocket = Math.max(0, option.totalProjectCost - option.totalRebates - 500);
        giftCard = 500;
        warrantyYears = 3;
      } else if (input.selectedPaymentTier === "deposit_12pct") {
        // 12% deposit + PSEG pays rest → $250 gift card, 2-year warranty
        finalOutOfPocket = Math.round(option.totalProjectCost * 0.12);
        giftCard = 250;
        warrantyYears = 2;
      } else {
        // 100% financed → regular price, all rebates transferred to client
        finalOutOfPocket = 0;
        giftCard = 0;
        warrantyYears = 3;
      }

      const [result] = await db.insert(rebateCalculations).values({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        address: input.address,
        city: input.city,
        state: input.state,
        zip: input.zip,
        propertyType: input.propertyType,
        squareFootage: input.squareFootage,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        stories: input.stories,
        currentSystem: input.currentSystem,
        systemAge: input.systemAge,
        psegRebateCents: Math.round(option.psegRebate * 100),
        federalTaxCreditCents: Math.round(option.federalTaxCredit * 100),
        totalRebateCents: Math.round(option.totalRebates * 100),
        selectedOption: input.selectedOption,
        selectedPaymentTier: input.selectedPaymentTier,
        projectCostCents: Math.round(option.totalProjectCost * 100),
        outOfPocketCents: Math.round(finalOutOfPocket * 100),
        assessmentRequested: input.assessmentRequested,
        assessmentStatus: input.assessmentRequested ? "pending" : undefined,
        propertyDataJson: input.propertyDataJson,
        status: "new",
      });

      // Notify owner
      if (input.assessmentRequested) {
        await notifyOwner({
          title: `🏠 New Assessment Request: ${input.firstName} ${input.lastName ?? ""} — ${input.address}`,
          content: `A homeowner has requested a FREE assessment via the Rebate Calculator.\n\nContact: ${input.firstName} ${input.lastName ?? ""}\nEmail: ${input.email ?? "N/A"}\nPhone: ${input.phone ?? "N/A"}\nAddress: ${input.address}, ${input.city ?? ""} ${input.state ?? ""} ${input.zip ?? ""}\n\nProperty: ${input.squareFootage} sq ft | ${input.bedrooms} bed | ${input.stories ?? 1} stories\nCurrent System: ${input.currentSystem.replace(/_/g, " ")}\n\nSelected Option: ${input.selectedOption === "high_efficiency" ? "High-Efficiency" : "Standard"}\nPayment Tier: ${input.selectedPaymentTier.replace(/_/g, " ")}\nEstimated Project Cost: $${option.totalProjectCost.toLocaleString()}\nTotal Rebates: $${option.totalRebates.toLocaleString()}\nOut of Pocket: $${finalOutOfPocket.toLocaleString()}\n\nLog in to your dashboard to follow up.`,
        });
      }

      return {
        id: (result as any).insertId,
        rebates,
        finalOutOfPocket,
        giftCard,
        warrantyYears,
        assessmentRequested: input.assessmentRequested,
      };
    }),

  /**
   * List all rebate calculation submissions (protected — admin only)
   */
  listSubmissions: protectedProcedure
    .input(
      z.object({
        status: z.enum(["new", "contacted", "scheduled", "won", "lost"]).optional(),
        limit: z.number().default(100),
        offset: z.number().default(0),
        assessmentOnly: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await requireDb();
      let query = db
        .select()
        .from(rebateCalculations)
        .orderBy(desc(rebateCalculations.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      return query;
    }),

  /**
   * Update submission status (protected)
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["new", "contacted", "scheduled", "won", "lost"]).optional(),
        assessmentStatus: z.enum(["pending", "scheduled", "completed", "cancelled"]).optional(),
        assignedTo: z.string().optional(),
        internalNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, ...updates } = input;
      const filtered = Object.fromEntries(
        Object.entries(updates).filter(([, v]) => v !== undefined)
      );
      await db
        .update(rebateCalculations)
        .set(filtered)
        .where(eq(rebateCalculations.id, id));
      return { success: true };
    }),

  /**
   * Get a single submission by ID (protected)
   */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [row] = await db
        .select()
        .from(rebateCalculations)
        .where(eq(rebateCalculations.id, input.id))
        .limit(1);
      return row ?? null;
    }),
});

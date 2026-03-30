/**
 * Rebate Calculator Router
 * Public-facing tool for homeowners to estimate HVAC rebates and place assessment orders
 */
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { makeRequest, GeocodingResult } from "../_core/map";
import { z } from "zod";
import { getDb } from "../db";
import { rebateCalculations, calculatorRegistrations } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { randomUUID } from "crypto";

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
        // Electric panel / disconnect adder
        panelAdderCents: z.number().min(0).optional().default(0),
        numCondensers: z.number().min(1).max(4).optional().default(1),
        hasCentralAir: z.string().optional(),
        panelHasSpace: z.string().optional(),
        // Solar interest
        interestedInSolar: z.string().optional(),
        // Preferred contact method
        preferredContact: z.enum(["call", "text", "email"]).optional(),
        // Preferred appointment date/time
        preferredDate: z.string().optional(),
        preferredTime: z.string().optional(),
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
        solarInterest: (input.interestedInSolar as "yes" | "no" | "maybe" | undefined) ?? undefined,
        preferredContact: input.preferredContact ?? undefined,
        status: "new",
      });

      // Notify owner
      if (input.assessmentRequested) {
        const panelAdder = (input.panelAdderCents ?? 0) / 100;
        const panelNote = panelAdder > 0
          ? `Panel/Disconnect Adder: $${panelAdder.toLocaleString()} (${input.numCondensers ?? 1} condenser(s), panel space: ${input.panelHasSpace ?? "unknown"}, central air: ${input.hasCentralAir ?? "unknown"})`
          : "Panel/Disconnect Adder: None";
        const solarNote = input.interestedInSolar
          ? `Solar Interest: ${input.interestedInSolar === "yes" ? "YES — include solar proposal" : input.interestedInSolar === "maybe" ? "Maybe — share info" : "No"}`
          : "Solar Interest: Not answered";
        const contactNote = input.preferredContact
          ? `Preferred Contact: ${input.preferredContact === "call" ? "Phone Call" : input.preferredContact === "text" ? "Text Message" : "Email"}`
          : "Preferred Contact: Not specified";
        await notifyOwner({
          title: `🏠 New Assessment Request: ${input.firstName} ${input.lastName ?? ""} — ${input.address}`,
          content: `A homeowner has requested a FREE assessment via the Rebate Calculator.\n\nContact: ${input.firstName} ${input.lastName ?? ""}\nEmail: ${input.email ?? "N/A"}\nPhone: ${input.phone ?? "N/A"}\nAddress: ${input.address}, ${input.city ?? ""} ${input.state ?? ""} ${input.zip ?? ""}\n${contactNote}\n\nProperty: ${input.squareFootage} sq ft | ${input.bedrooms} bed | ${input.stories ?? 1} stories\nCurrent System: ${input.currentSystem.replace(/_/g, " ")}\n\nSelected Option: ${input.selectedOption === "high_efficiency" ? "High-Efficiency" : "Standard"}\nPayment Tier: ${input.selectedPaymentTier.replace(/_/g, " ")}\nEstimated Project Cost: $${option.totalProjectCost.toLocaleString()}\nTotal Rebates: $${option.totalRebates.toLocaleString()}\nOut of Pocket: $${finalOutOfPocket.toLocaleString()}\n${panelNote}\n${solarNote}\n\nLog in to your dashboard to follow up.`,
        });
      }

      // Send email notifications via Resend
      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        const systemLabel = input.currentSystem.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const optionLabel = input.selectedOption === "high_efficiency" ? "High-Efficiency" : "Standard";
        const tierLabel = input.selectedPaymentTier === "full_finance" ? "100% Financed" : input.selectedPaymentTier === "deposit_12pct" ? "12% Deposit" : "Full Payment";
        const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        const formattedDate = input.preferredDate ? new Date(input.preferredDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
        const timeLabels: Record<string, string> = {
          morning: 'Morning (8am–12pm)',
          afternoon: 'Afternoon (12pm–4pm)',
          evening: 'Evening (4pm–7pm)',
        };
        const formattedTime = input.preferredTime ? (timeLabels[input.preferredTime] ?? input.preferredTime) : null;

        // 1. Client confirmation email
        if (input.email) {
          try {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "Mechanical Enterprise <noreply@mechanicalenterprise.com>",
                to: [input.email],
                subject: `Your Assessment Request is Confirmed – Mechanical Enterprise`,
                html: `
                  <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
                    <h2 style="color:#1e3a5f">${input.firstName}, your assessment request is confirmed!</h2>
                    <p>Your free assessment has been requested. Our team will contact you within 24 hours to confirm your appointment.</p>
                    <h3 style="color:#1e3a5f;margin-bottom:8px">Your Estimate Summary</h3>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0">
                      <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#666">System</td><td style="padding:8px 0;font-weight:bold;text-align:right">${input.currentSystem.includes("electric") || input.currentSystem === "none" ? "Ductless" : "Ducted"}</td></tr>
                      <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#666">Selected Package</td><td style="padding:8px 0;font-weight:bold;text-align:right">${optionLabel} — ${tierLabel}</td></tr>
                      <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#666">Est. Rebate</td><td style="padding:8px 0;font-weight:bold;text-align:right;color:#16a34a">${fmt(option.totalRebates)}</td></tr>
                      ${giftCard > 0 ? `<tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#666">Gift Card</td><td style="padding:8px 0;font-weight:bold;text-align:right;color:#ff6b35">${fmt(giftCard)}</td></tr>` : ""}
                      <tr><td style="padding:8px 0;color:#666">Out-of-Pocket</td><td style="padding:8px 0;font-weight:bold;text-align:right;color:#1e3a5f">${fmt(finalOutOfPocket)}</td></tr>
                    </table>
                    ${formattedDate || formattedTime ? `
                    <h3 style="color:#1e3a5f;margin-bottom:8px">Appointment Request</h3>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0">
                      ${formattedDate ? `<tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#666">Preferred Date</td><td style="padding:8px 0;font-weight:bold;text-align:right">${formattedDate}</td></tr>` : ""}
                      ${formattedTime ? `<tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#666">Preferred Time</td><td style="padding:8px 0;font-weight:bold;text-align:right">${formattedTime}</td></tr>` : ""}
                    </table>
                    ` : ""}
                    <div style="text-align:center;margin:32px 0">
                      <a href="https://mechanicalenterprise.com/rebate-calculator#assessment" style="background:#ff6b35;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px">Schedule Your Free Assessment</a>
                    </div>
                    <p style="color:#666;font-size:14px">Questions? Call us at <strong>(862) 419-1763</strong> — we're happy to help.</p>
                    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
                    <p style="color:#999;font-size:12px">Mechanical Enterprise LLC &bull; Essex County, NJ &bull; <a href="https://mechanicalenterprise.com">mechanicalenterprise.com</a></p>
                  </div>
                `,
              }),
            });
          } catch (e) {
            console.error("submitCalculation client email error:", e);
          }
        }

        // 2. Sales team notification email
        try {
          const propTypeLabel = (input.propertyType ?? "single_family").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Mechanical Enterprise <noreply@mechanicalenterprise.com>",
              to: ["sales@mechanicalenterprise.com"],
              subject: `New Assessment Request – ${input.firstName} ${input.lastName ?? ""}`.trim(),
              html: `
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
                  <h2 style="color:#1e3a5f">New Rebate Calculator Submission</h2>
                  <h3 style="margin-bottom:4px">Contact Info</h3>
                  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                    <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666;width:40%">Name</td><td style="padding:6px 0">${input.firstName} ${input.lastName ?? ""}</td></tr>
                    <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Phone</td><td style="padding:6px 0">${input.phone ?? "N/A"}</td></tr>
                    <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0">${input.email ?? "N/A"}</td></tr>
                    <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Address</td><td style="padding:6px 0">${input.address}, ${input.city ?? ""} ${input.state ?? ""} ${input.zip ?? ""}</td></tr>
                    <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Preferred Contact</td><td style="padding:6px 0">${input.preferredContact === "call" ? "Phone Call" : input.preferredContact === "text" ? "Text Message" : input.preferredContact === "email" ? "Email" : "Not specified"}</td></tr>
                    ${formattedDate ? `<tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Preferred Date</td><td style="padding:6px 0;font-weight:bold">${formattedDate}</td></tr>` : ""}
                    ${formattedTime ? `<tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Preferred Time</td><td style="padding:6px 0;font-weight:bold">${formattedTime}</td></tr>` : ""}
                  </table>
                  <h3 style="margin-bottom:4px">Property Details</h3>
                  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                    <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666;width:40%">Property Type</td><td style="padding:6px 0">${propTypeLabel}</td></tr>
                    <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Square Footage</td><td style="padding:6px 0">${input.squareFootage.toLocaleString()} sq ft</td></tr>
                    <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Bedrooms</td><td style="padding:6px 0">${input.bedrooms}</td></tr>
                    <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Stories</td><td style="padding:6px 0">${input.stories ?? 1}</td></tr>
                    <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Current System</td><td style="padding:6px 0">${systemLabel}</td></tr>
                  </table>
                  <h3 style="margin-bottom:4px">Rebate Estimate</h3>
                  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                    <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666;width:40%">Selected Option</td><td style="padding:6px 0">${optionLabel}</td></tr>
                    <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Payment Tier</td><td style="padding:6px 0">${tierLabel}</td></tr>
                    <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Project Cost</td><td style="padding:6px 0">${fmt(option.totalProjectCost)}</td></tr>
                    <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Total Rebates</td><td style="padding:6px 0;color:#16a34a;font-weight:bold">${fmt(option.totalRebates)}</td></tr>
                    <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Out of Pocket</td><td style="padding:6px 0;font-weight:bold">${fmt(finalOutOfPocket)}</td></tr>
                    ${giftCard > 0 ? `<tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Gift Card</td><td style="padding:6px 0">${fmt(giftCard)}</td></tr>` : ""}
                    <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Assessment Requested</td><td style="padding:6px 0;font-weight:bold;color:${input.assessmentRequested ? "#16a34a" : "#666"}">${input.assessmentRequested ? "YES" : "No"}</td></tr>
                    ${input.interestedInSolar ? `<tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Solar Interest</td><td style="padding:6px 0">${input.interestedInSolar}</td></tr>` : ""}
                  </table>
                  <p style="color:#999;font-size:12px">Log in to the <a href="https://mechanicalenterprise.com/assessment-submissions">dashboard</a> to follow up.</p>
                </div>
              `,
            }),
          });
        } catch (e) {
          console.error("submitCalculation sales email error:", e);
        }
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

  /**
   * Geocode an address using server-side Google Maps API (public)
   * Returns city, state, zip, county, neighborhood, formatted address
   */
  geocodeAddress: publicProcedure
    .input(z.object({ address: z.string().min(3) }))
    .mutation(async ({ input }) => {
      try {
        const result = await makeRequest<GeocodingResult>("/maps/api/geocode/json", {
          address: input.address,
          region: "us",
          components: "country:US|administrative_area:NJ",
        });

        if (result.status !== "OK" || !result.results.length) {
          return { success: false, error: result.status };
        }

        const place = result.results[0];
        const components = place.address_components;

        const get = (type: string) =>
          components.find((c) => c.types.includes(type))?.long_name ?? "";
        const getShort = (type: string) =>
          components.find((c) => c.types.includes(type))?.short_name ?? "";

        const streetNumber = get("street_number");
        const route = get("route");
        const city =
          get("locality") ||
          get("sublocality_level_1") ||
          get("neighborhood") ||
          get("postal_town");
        const county = get("administrative_area_level_2").replace(" County", "") + " County";
        const state = getShort("administrative_area_level_1");
        const zip = get("postal_code");
        const neighborhood = get("neighborhood") || get("sublocality_level_1");

        // Detect property type from place types
        const types = place.types;
        let propertyType = "single_family";
        if (types.includes("premise") || types.includes("subpremise")) {
          propertyType = "condo";
        } else if (types.includes("establishment")) {
          propertyType = "multi_family";
        }

        const streetAddress = [streetNumber, route].filter(Boolean).join(" ");

        return {
          success: true,
          streetAddress,
          city,
          state,
          zip,
          county,
          neighborhood,
          propertyType,
          formattedAddress: place.formatted_address,
          placeId: place.place_id,
        };
      } catch (err) {
        console.error("Geocode error:", err);
        return { success: false, error: "Geocoding failed" };
      }
    }),

  /**
   * Send rebate results via SMS to the homeowner (public)
   * Uses Telnyx to deliver a personalized summary with rebate estimate and booking link
   */
  sendResultsSms: publicProcedure
    .input(
      z.object({
        phone: z.string().min(10),
        firstName: z.string().min(1),
        totalRebates: z.number(),
        outOfPocket: z.number(),
        selectedOption: z.enum(["high_efficiency", "standard"]),
      })
    )
    .mutation(async ({ input }) => {
      const telnyxApiKey = process.env.TELNYX_API_KEY;
      const fromNumber = process.env.TELNYX_FROM_NUMBER;

      if (!telnyxApiKey || !fromNumber) {
        console.error("Telnyx credentials not configured");
        return { success: false, error: "SMS service not configured" };
      }

      // Normalize phone: strip non-digits, ensure E.164 format
      const digits = input.phone.replace(/\D/g, "");
      const toNumber = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;

      const optionLabel = input.selectedOption === "high_efficiency" ? "High-Efficiency" : "Standard";
      const rebateFormatted = `$${input.totalRebates.toLocaleString()}`;
      const oopFormatted = input.outOfPocket === 0 ? "$0 out of pocket" : `$${input.outOfPocket.toLocaleString()} out of pocket`;

      const message = [
        `Hi ${input.firstName}! Here are your NJ Clean Heat rebate results from Mechanical Enterprise:`,
        ``,
        `✅ ${optionLabel} Heat Pump`,
        `💰 Total Rebates: ${rebateFormatted}`,
        `🏠 Your Cost: ${oopFormatted}`,
        ``,
        `Ready to lock in your rebate? Book your FREE assessment:`,
        `https://mechanicalenterprise.com`,
        ``,
        `Questions? Call us: (862) 419-1763`,
        `Reply STOP to opt out.`,
      ].join("\n");

      try {
        const response = await fetch("https://api.telnyx.com/v2/messages", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${telnyxApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromNumber,
            to: toNumber,
            text: message,
          }),
        });

        if (!response.ok) {
          const err = await response.text();
          console.error("Telnyx SMS error:", err);
          return { success: false, error: "Failed to send SMS" };
        }

        return { success: true };
      } catch (err) {
        console.error("Telnyx fetch error:", err);
        return { success: false, error: "Network error sending SMS" };
      }
    }),

  /**
   * Register a homeowner to access the Rebate Calculator.
   * Creates a record, sends a personalized SMS + email with a unique access link.
   */
  register: publicProcedure
    .input(
      z.object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        email: z.string().email(),
        phone: z.string().min(10).max(20),
        address: z.string().optional(),
        city: z.string().optional(),
        zip: z.string().optional(),
        origin: z.string().url(), // window.location.origin passed from frontend
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();

      // Normalize phone to E.164
      const digits = input.phone.replace(/\D/g, "");
      const phone = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;

      // Generate a unique token valid for 30 days
      const token = randomUUID().replace(/-/g, "");
      const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const calculatorUrl = `${input.origin}/rebate-calculator?token=${token}`;

      // Insert registration record
      await db.insert(calculatorRegistrations).values({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone,
        address: input.address,
        city: input.city,
        zip: input.zip,
        state: "NJ",
        token,
        tokenExpiresAt,
        smsSent: false,
        emailSent: false,
        calculatorStarted: false,
        calculatorCompleted: false,
      });

      let smsSent = false;
      let emailSent = false;

      // Send SMS via Telnyx
      const telnyxApiKey = process.env.TELNYX_API_KEY;
      const fromNumber = process.env.TELNYX_FROM_NUMBER;
      if (telnyxApiKey && fromNumber) {
        try {
          const smsBody = [
            `Hi ${input.firstName}! Your NJ Clean Heat Rebate Calculator is ready.`,
            ``,
            `Click your personalized link to see how much you can save:`,
            calculatorUrl,
            ``,
            `Link valid for 30 days. Questions? Call (862) 419-1763`,
            `Reply STOP to opt out.`,
          ].join("\n");

          const smsRes = await fetch("https://api.telnyx.com/v2/messages", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${telnyxApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ from: fromNumber, to: phone, text: smsBody }),
          });
          smsSent = smsRes.ok;
        } catch (e) {
          console.error("Registration SMS error:", e);
        }
      }

      // Send email via Resend
      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        try {
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Mechanical Enterprise <noreply@mechanicalenterprise.com>",
              to: [input.email],
              subject: `${input.firstName}, your NJ Clean Heat Rebate Calculator is ready`,
              html: `
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
                  <h2 style="color:#1e3a5f">Your Rebate Calculator Is Ready, ${input.firstName}!</h2>
                  <p>We've set up a personalized rebate estimate for your home. Click the button below to see how much you could save with a new heat pump system.</p>
                  <div style="text-align:center;margin:32px 0">
                    <a href="${calculatorUrl}" style="background:#ff6b35;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px">Open My Rebate Calculator</a>
                  </div>
                  <p style="color:#666;font-size:14px">Or copy this link: <a href="${calculatorUrl}">${calculatorUrl}</a></p>
                  <p style="color:#666;font-size:14px">This link is valid for 30 days. Questions? Call us at <strong>(862) 419-1763</strong>.</p>
                  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
                  <p style="color:#999;font-size:12px">Mechanical Enterprise LLC &bull; Essex County, NJ &bull; <a href="https://mechanicalenterprise.com">mechanicalenterprise.com</a></p>
                </div>
              `,
            }),
          });
          emailSent = emailRes.ok;
        } catch (e) {
          console.error("Registration email error:", e);
        }
      }

      // Update sent flags
      await db
        .update(calculatorRegistrations)
        .set({ smsSent, emailSent })
        .where(eq(calculatorRegistrations.token, token));

      // Notify owner of new registration
      await notifyOwner({
        title: `📋 New Calculator Registration: ${input.firstName} ${input.lastName}`,
        content: `A homeowner registered for the Rebate Calculator.\n\nName: ${input.firstName} ${input.lastName}\nEmail: ${input.email}\nPhone: ${phone}\nAddress: ${input.address ?? "N/A"}, ${input.city ?? ""} ${input.zip ?? ""}\n\nSMS sent: ${smsSent ? "✅" : "❌"}\nEmail sent: ${emailSent ? "✅" : "❌"}`,
      });

      return { success: true, smsSent, emailSent };
    }),

  /**
   * Load a registration record by token (public).
   * Called when homeowner clicks their personalized link.
   * Marks the calculator as started and returns personal details for pre-population.
   */
  getByToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [row] = await db
        .select()
        .from(calculatorRegistrations)
        .where(eq(calculatorRegistrations.token, input.token))
        .limit(1);

      if (!row) return { valid: false, error: "Link not found" };

      if (row.tokenExpiresAt < new Date()) {
        return { valid: false, error: "This link has expired. Please register again." };
      }

      // Mark calculator as started
      if (!row.calculatorStarted) {
        await db
          .update(calculatorRegistrations)
          .set({ calculatorStarted: true })
          .where(eq(calculatorRegistrations.id, row.id));
      }

      return {
        valid: true,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        address: row.address,
        city: row.city,
        zip: row.zip,
        state: row.state,
      };
    }),

  /**
   * Autocomplete address suggestions (public) — for real-time dropdown as user types
   */
  autocompleteAddress: publicProcedure
    .input(z.object({ input: z.string().min(2) }))
    .query(async ({ input }) => {
      try {
        const result = await makeRequest<{
          predictions: Array<{ description: string; place_id: string }>;
          status: string;
        }>("/maps/api/place/autocomplete/json", {
          input: input.input,
          types: "address",
          components: "country:us",
          region: "us",
        });

        if (result.status !== "OK" && result.status !== "ZERO_RESULTS") {
          return { suggestions: [] };
        }

        return {
          suggestions: (result.predictions || []).slice(0, 5).map((p) => ({
            description: p.description,
            placeId: p.place_id,
          })),
        };
      } catch (err) {
        console.error("Autocomplete error:", err);
        return { suggestions: [] };
      }
    }),
});

import type { Context } from "@netlify/functions";

export const config = {
  bodyParser: {
    sizeLimit: "50mb"
  }
};

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const { fileData, fileType, projName, discipline, location, instructions } = body;

    const isPDF = fileType === "application/pdf";

    const mediaBlock = isPDF
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileData } }
      : { type: "image", source: { type: "base64", media_type: fileType, data: fileData } };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        system: `You are an expert HVAC/MEP mechanical estimator. Extract a complete take-off from the uploaded drawing sheets for project: ${projName || "HVAC Project"}. Discipline: ${discipline}. Location: ${location}. Instructions: ${instructions || "None"}. Extract ALL items: equipment with tags/models/specs, ductwork by size in LF, piping by diameter in LF, air devices by count, insulation SF/LF, accessories, fire dampers, controls, labor hours. For unit pricing, use these NJ contractor DIRECT COST benchmarks (materials + labor, NO markup): VRF/VRV outdoor units: $800-1,200 per ton installed; VRF indoor air handlers: $400-700 per unit; Exhaust fans (small, <500 CFM): $150-300 each; Exhaust fans (large, >1000 CFM): $500-1,500 each; ERV units: $800-2,000 each; Rectangular ductwork: $8-14 per LF (small), $18-28 per LF (large); Round/flex duct: $4-8 per LF; Fire dampers: $180-350 each; Volume dampers: $60-120 each; Air devices (grilles/registers): $35-85 each; Pipe insulation: $4-8 per LF; Duct insulation: $1.50-3.00 per SF; Controls/thermostats: $150-400 each; Labor (mechanical): $85-110 per hour NJ union rates. These are DIRECT costs before any markup. Do not inflate prices. Respond ONLY with valid JSON: {"pages":<number>,"items":[{"category":"MACHINERY|SHEET METAL|COPPER|INSULATION|AIR DEVICES|ACCESSORIES|LABOR|OTHER","description":"<desc>","tag":"<tag>","qty":<number>,"unit":"EA|LF|SF|LS|HR","vendor":"<brand>","model":"<model>","specs":"<specs>","source":"<sheet>","confidence":"high|med|low","unitPrice":<number>,"notes":"<notes>"}],"findings":[{"type":"warning|info|success|alert","title":"<title>","body":"<body>","source":"<ref>"}]}`,
        messages: [{
          role: "user",
          content: [
            mediaBlock,
            { type: "text", text: "Perform a complete mechanical take-off. Extract every item. Return only valid JSON." }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return new Response(JSON.stringify({ error: err }), { status: 500 });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};


import type { Context } from "@netlify/functions";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { files, projName, discipline, location, instructions } = body as {
      files: { base64: string; type: string; name: string }[];
      projName: string;
      discipline: string;
      location: string;
      instructions: string;
    };

    if (!files || files.length === 0) {
      return Response.json({ error: "No files provided" }, { status: 400 });
    }

    // Build content blocks for each uploaded file
    const contentBlocks: any[] = [];

    for (const f of files) {
      if (f.type === "application/pdf") {
        contentBlocks.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: f.base64 },
        });
      } else {
        contentBlocks.push({
          type: "image",
          source: { type: "base64", media_type: f.type, data: f.base64 },
        });
      }
    }

    contentBlocks.push({
      type: "text",
      text: `Project: ${projName || "Untitled"}\nLocation: ${location || ""}\nDiscipline: ${discipline || "HVAC"}\n\n${instructions ? `Additional instructions: ${instructions}` : ""}

Analyze the uploaded mechanical/HVAC drawings and produce a detailed quantity take-off. Return ONLY valid JSON (no markdown) in this format:
{
  "items": [
    {
      "category": "MACHINERY|SHEET METAL|COPPER|INSULATION|AIR DEVICES|ACCESSORIES|LABOR|OTHER",
      "description": "...",
      "tag": "...",
      "qty": 1,
      "unit": "EA|LF|SF|CF|LBS|HR|LS|SET",
      "vendor": "...",
      "model": "...",
      "specs": "...",
      "source": "sheet/detail reference",
      "confidence": 0-100,
      "unitPrice": 0,
      "notes": "..."
    }
  ],
  "findings": [
    { "severity": "info|warning|error", "title": "...", "detail": "..." }
  ]
}`,
    });

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system:
          "You are an expert HVAC mechanical estimator. Analyze construction drawings and produce accurate quantity take-offs with line items and findings. Return ONLY valid JSON.",
        messages: [{ role: "user", content: contentBlocks }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return Response.json(
        { error: `Anthropic API ${anthropicRes.status}: ${errText}` },
        { status: anthropicRes.status }
      );
    }

    const data = await anthropicRes.json();
    return Response.json(data);
  } catch (err: any) {
    return Response.json({ error: err.message || "Internal error" }, { status: 500 });
  }
};

import { describe, expect, it } from "vitest";
import { formatExtraFields } from "./metaLeadWebhook";

describe("formatExtraFields", () => {
  it("keeps custom questions and drops contact fields", () => {
    const lines = formatExtraFields([
      { name: "full_name", values: ["Pat Lee"] },
      { name: "phone_number", values: ["+19735550100"] },
      { name: "email", values: ["pat@example.com"] },
      { name: "what_would_you_like_replaced?", values: ["Furnace"] },
      { name: "zip_code", values: ["07039"] },
    ]);
    expect(lines).toEqual(["what would you like replaced: Furnace", "zip code: 07039"]);
  });
});

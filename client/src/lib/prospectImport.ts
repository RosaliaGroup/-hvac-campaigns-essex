/** Import reviewed business-contact research exports into the existing draft queue.
 * No network requests, scraping, discovery or outbound messages occur here.
 * Import data is untrusted: verification source and personalized draft are required.
 */
export type ProspectImportRow = {
  email: string; company: string; decisionMaker: string;
  sourceUrl: string; draftSubject: string; draftBody: string;
};
export type ProspectImportResult = { rows: ProspectImportRow[]; errors: string[] };

export function parseProspectCsv(text: string): ProspectImportResult {
  const records: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim()); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some(Boolean)) records.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) return { rows: [], errors: ["Unclosed CSV quotation mark"] };
  row.push(cell.trim());
  if (row.some(Boolean)) records.push(row);
  if (!records.length) return { rows: [], errors: ["CSV file is empty"] };
  const headers = records.shift()!.map(x => x.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const aliases: Record<keyof ProspectImportRow, string[]> = {
    email: ["email", "workemail", "businessemail"],
    company: ["company", "companyname", "organization"],
    decisionMaker: ["decisionmaker", "fullname", "contactname", "name"],
    sourceUrl: ["sourceurl", "verificationurl", "linkedinurl", "profileurl"],
    draftSubject: ["draftsubject", "subject"],
    draftBody: ["draftbody", "body", "message"],
  };
  const indexes = Object.fromEntries(Object.entries(aliases).map(([key, options]) =>
    [key, headers.findIndex(header => options.includes(header))])) as Record<keyof ProspectImportRow, number>;
  const missing = Object.entries(indexes).filter(([, i]) => i < 0).map(([key]) => key);
  if (missing.length) return { rows: [], errors: ["Missing required CSV columns: " + missing.join(", ")] };
  const rows: ProspectImportRow[] = [], errors: string[] = [], seen = new Set<string>();
  for (let index = 0; index < records.length; index++) {
    const cells = records[index];
    const item = Object.fromEntries(Object.entries(indexes).map(([key, i]) => [key, (cells[i] ?? "").trim()])) as ProspectImportRow;
    const email = item.email.toLowerCase();
    if (!Object.values(item).every(Boolean) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !item.sourceUrl.startsWith("https://")) {
      errors.push("Row " + (index + 2) + ": missing or invalid required information");
      continue;
    }
    if (seen.has(email)) { errors.push("Row " + (index + 2) + ": duplicate address"); continue; }
    seen.add(email);
    rows.push({ ...item, email });
  }
  return { rows, errors };
}

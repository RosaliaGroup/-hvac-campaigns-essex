/** Lusha V3: on-demand CRM enrichment with strict identity checks.
 * No automatic reveals, no SMS, no LinkedIn follows, no restricted-result retries.
 * The ChatGPT Lusha connector cannot be reused as the CRM's API credential.
 */
import { and, eq, or, isNull } from "drizzle-orm";
import { crmExternalContacts } from "../../drizzle/schema";
import { getDb } from "../db";
import { classifyContactPhone, getContactEnrichment } from "./crmContactEnrichment";
import { saveVerifiedLushaLinkedIn } from "./contactProfile/store";

const API = "https://api.lusha.com/v3";
const TTL_MS = 15 * 60_000;
/** Restricted in the 2026-10-09 connected Lusha lookup. Do not retry these
 * contacts through a different API or route to circumvent provider restrictions. */
const RESTRICTED_LUSHA_EMAILS = new Set([
  "rbowlby@ramapo.edu",
  "dzappala@ripconj.com",
  "rebecca.crespo@njefa.nj.gov",
  "sanjeannetta.worley@njit.edu",
  "mlee@tulfra.com",
  "drasmusson@crownpointgroup.com",
  "adham.ebid@wrdc.net",
  "phyllis@youngandassoc.com",
  "sjennings@sanzari.com",
]);
const previews = new Map<number, {
  lushaId: string; email: string; name: string; company: string;
  previewedAt: number; canRevealPhones: boolean; linkedin: string | null;
}>();

const norm = (s: string | null | undefined) => (s || "").toLowerCase().replace(/[^a-z0-9]/g,"");
const domain = (s: string | null | undefined) =>
  (s || "").toLowerCase().replace(/^https?:\/\//,"").replace(/^www\./,"").split("/")[0];
export type LushaPreviewResult = {
  status: "matched" | "missing_identity" | "not_found" | "mismatch" | "restricted" | "unavailable";
  message: string; phoneRevealCredits: number; linkedin: string | null;
  hasPhoneAvailable: boolean;
};
export function validateLushaIdentity(
  crm: {name: string; company: string | null; email: string | null},
  lusha: any,
): boolean {
  if (!crm.email || !crm.company || !crm.name || crm.name.includes("@")) return false;
  const fullName = [lusha?.firstName, lusha?.lastName].filter(Boolean).join(" ");
  const nameMatch = Boolean(fullName) && norm(fullName) === norm(crm.name);
  const lushaCompany = lusha?.company?.name ?? lusha?.companyName ?? "";
  const companyDomain = lusha?.company?.domain ?? lusha?.companyDomain ?? "";
  const crmDomain = crm.email.split("@")[1];
  const employerMatch = Boolean(lushaCompany && norm(lushaCompany) === norm(crm.company)) ||
    Boolean(!lushaCompany && companyDomain && domain(companyDomain) === domain(crmDomain));
  return nameMatch && employerMatch;
}
function firstResult(body: any) {
  return (Array.isArray(body?.results) ? body.results :
    Array.isArray(body?.contacts) ? body.contacts : [])[0] ?? null;
}
function getLushaKey() {
  const key = process.env.LUSHA_API_KEY?.trim();
  if (!key) throw new Error("LUSHA_API_KEY is not configured in Railway. ChatGPT Lusha access does not authorize CRM API calls.");
  return key;
}
async function lushaPost(path: string, payload: object, fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(API + path, {
    method: "POST",
    headers: { api_key: getLushaKey(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 401 || response.status === 403)
    throw new Error(`Lusha API permission denied (HTTP ${response.status}); check the Railway API key and account entitlements.`);
  if (response.status === 402) throw new Error("Lusha has insufficient credits; no further reveal attempted.");
  if (response.status === 429) throw new Error("Lusha rate limit reached; stop and wait for reset.");
  if (response.status === 451) throw new Error("Lusha compliance restriction; do not retry through another route.");
  if (!response.ok) throw new Error(`Lusha API error HTTP ${response.status}`);
  return response.json();
}
async function contactFor(id: number) {
  const db = await getDb();
  if (!db) throw new Error("CRM database unavailable");
  const [c] = await db.select().from(crmExternalContacts)
    .where(eq(crmExternalContacts.id,id)).limit(1);
  if (!c) throw new Error("CRM contact not found");
  return {db,c};
}
function validLinkedIn(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && /^(www\.)?linkedin\.com$/.test(u.hostname) &&
      u.pathname.startsWith("/in/") ? u.href : null;
  } catch { return null; }
}
function linkedinOf(row: any) {
  return validLinkedIn(row?.socialLinks?.linkedin ?? row?.linkedinUrl ?? row?.linkedin);
}
export function lushaConfigured() { return Boolean(process.env.LUSHA_API_KEY?.trim()); }

/** Preview may consume Lusha's contact search credits, but does not reveal phone numbers. */
export async function previewLushaContact(contactId: number, fetchImpl: typeof fetch = fetch): Promise<LushaPreviewResult> {
  const {c} = await contactFor(contactId);
  if (c.email && RESTRICTED_LUSHA_EMAILS.has(c.email.toLowerCase()))
    return {status:"restricted",message:"Lusha previously restricted this exact contact. No lookup attempted.",phoneRevealCredits:5,linkedin:null,hasPhoneAvailable:false};
  if (!c.email || !c.company || !c.name || c.name.includes("@"))
    return {status:"missing_identity",message:"Verify this contact's name and company in CRM before using Lusha.",phoneRevealCredits:5,linkedin:null,hasPhoneAvailable:false};
  const cached = previews.get(contactId);
  if (cached && Date.now()-cached.previewedAt < TTL_MS &&
      cached.email === c.email && cached.name === c.name && cached.company === c.company)
    return {status:"matched",message:"Verified Lusha preview cached. Phone reveal requires separate approval.",phoneRevealCredits:5,linkedin:cached.linkedin,hasPhoneAvailable:cached.canRevealPhones};
  previews.delete(contactId);
  const body = await lushaPost("/contacts/search", {
    contacts:[{clientReferenceId:String(contactId),email:c.email}],
    options:{includePartialProfiles:true},
  },fetchImpl);
  const row = firstResult(body);
  const error = row?.error?.code ?? row?.statusReason;
  if (error === "COMPLIANCE_RESTRICTED" || error === "LEGAL_RESTRICTED")
    return {status:"restricted",message:"Lusha restricts this contact. No reveal or alternative lookup permitted.",phoneRevealCredits:5,linkedin:null,hasPhoneAvailable:false};
  if (!row || error === "NOT_FOUND")
    return {status:"not_found",message:"Lusha did not find a usable contact match.",phoneRevealCredits:5,linkedin:null,hasPhoneAvailable:false};
  if (error)
    return {status:"unavailable",message:"Lusha lookup unavailable: "+String(error),phoneRevealCredits:5,linkedin:null,hasPhoneAvailable:false};
  if (!validateLushaIdentity(c,row))
    return {status:"mismatch",message:"Lusha returned a different person or employer. Nothing will be saved.",phoneRevealCredits:5,linkedin:null,hasPhoneAvailable:false};
  const phoneReveal = (row.canReveal ?? []).find((x:any)=>x.field==="phones");
  const available = Boolean(phoneReveal || row.has?.includes("phones"));
  const linkedin = linkedinOf(row);
  if (!row.id || typeof row.id !== "string")
    return {status:"unavailable",message:"Lusha match lacks a stable ID; cannot reveal.",phoneRevealCredits:5,linkedin:null,hasPhoneAvailable:false};
  previews.set(contactId,{lushaId:row.id,email:c.email,name:c.name,company:c.company,
    previewedAt:Date.now(),canRevealPhones:available,linkedin});
  return {status:"matched",message:"Name and employer verified. Nothing has been saved or revealed yet.",
    phoneRevealCredits:Number(phoneReveal?.credits ?? 5),linkedin,hasPhoneAvailable:available};
}
/** Explicit paid action: validates the returned identity again before saving a missing phone. */
export async function revealLushaPhone(contactId: number, confirmedCreditSpend: boolean, fetchImpl: typeof fetch = fetch) {
  if (!confirmedCreditSpend) throw new Error("Explicit approval of the Lusha phone-reveal credit cost is required.");
  const cached = previews.get(contactId);
  if (!cached || Date.now()-cached.previewedAt > TTL_MS)
    throw new Error("Run a fresh matching Lusha preview before spending phone credits.");
  const {db,c} = await contactFor(contactId);
  if (cached.email !== c.email || cached.name !== c.name || cached.company !== c.company)
    throw new Error("CRM identity changed; run a new preview.");
  if ((await getContactEnrichment(contactId)).phone?.trim())
    throw new Error("This CRM contact or linked customer already has a phone number; no paid reveal needed.");
  if (!cached.canRevealPhones) throw new Error("Lusha has no phone data to reveal for this contact.");
  const body = await lushaPost("/contacts/enrich",{
    ids:[cached.lushaId],reveal:["phones"],waterfallEnabled:false,
  },fetchImpl);
  const row = firstResult(body);
  previews.delete(contactId);
  if (row?.error?.code === "COMPLIANCE_RESTRICTED" || row?.statusReason === "COMPLIANCE_RESTRICTED")
    return {status:"restricted",saved:false,message:"Lusha compliance restriction; no data saved."};
  if (!row || row.error || !validateLushaIdentity(c,row))
    return {status:"mismatch",saved:false,message:"Enriched identity did not match the CRM name and company; no data saved."};
  const phones = Array.isArray(row.phones) ? row.phones : [];
  const selected = phones.find((p:any)=>["direct","work","office","business"].includes(String(p.type).toLowerCase())) ??
    phones.find((p:any)=>String(p.type).toLowerCase()==="mobile");
  const number = typeof selected?.number==="string" ? selected.number.trim() : "";
  if (number.replace(/\D/g,"").length < 10 || number.replace(/\D/g,"").length > 15)
    return {status:"no_phone",saved:false,message:"Lusha did not return a valid business contact number."};
  if (c.phone?.trim()) return {status:"already_present",saved:false,message:"Existing CRM phone preserved; no overwrite."};
  const type = String(selected.type).toLowerCase()==="mobile" ? "cell" : "business";
  await db.update(crmExternalContacts).set({phone:number})
    .where(and(eq(crmExternalContacts.id,c.id),or(isNull(crmExternalContacts.phone),eq(crmExternalContacts.phone,""))));
  const [saved] = await db.select({phone:crmExternalContacts.phone}).from(crmExternalContacts)
    .where(eq(crmExternalContacts.id,c.id)).limit(1);
  if (saved?.phone !== number) return {status:"write_conflict",saved:false,message:"CRM phone not updated; another value was preserved."};
  await classifyContactPhone({contactId,phoneType:type,sourceUrl:"https://www.lusha.com/",confirmedByUser:false,verifiedByProvider:true});
  return {status:"saved",saved:true,phone:number,phoneType:type,
    message:"Phone saved and read back in CRM. No SMS consent was granted."};
}

/** Save a matched public LinkedIn link after user review, without performing a follow. */
export async function savePreviewedLushaLinkedIn(contactId: number) {
  const cached=previews.get(contactId);
  if (!cached || Date.now()-cached.previewedAt>TTL_MS || !cached.linkedin)
    throw new Error("A current, identity-matched Lusha LinkedIn preview is required.");
  const {c}=await contactFor(contactId);
  if (cached.email!==c.email || cached.name!==c.name || cached.company!==c.company)
    throw new Error("CRM identity changed; run a new preview.");
  return saveVerifiedLushaLinkedIn(contactId,cached.linkedin);
}

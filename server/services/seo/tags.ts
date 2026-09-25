/**
 * SEO page tags (docs/seo-bulk-approve-spec.md §4). Tagging is available from
 * the row menu; removing "claims-review" requires a note (enforced here, not
 * just in the UI — see the spec's "locked server-side" principle).
 */
import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import { seoPageTags, type SeoPageTagRow, SEO_PAGE_TAGS } from "../../../drizzle/schema";
import { logAudit } from "./auditLog";

export type SeoPageTag = (typeof SEO_PAGE_TAGS)[number];

export class TagNoteRequiredError extends Error {
  constructor(tag: SeoPageTag) {
    super(`Removing "${tag}" requires a note explaining why it's safe to unlock.`);
    this.name = "TagNoteRequiredError";
  }
}

export async function listTags(pagePath: string): Promise<SeoPageTagRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(seoPageTags).where(eq(seoPageTags.pagePath, pagePath));
}

export async function addTag(input: {
  pagePath: string;
  tag: SeoPageTag;
  note: string | null;
  actorId: number | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(seoPageTags)
    .values({ pagePath: input.pagePath, tag: input.tag, note: input.note, createdById: input.actorId })
    .onDuplicateKeyUpdate({ set: { note: input.note, createdById: input.actorId, createdAt: new Date() } });
  await logAudit({
    actorId: input.actorId,
    action: "tag_added",
    batchId: null,
    pagePath: input.pagePath,
    before: null,
    after: { tag: input.tag, note: input.note },
    lintResult: null,
  });
}

/** Remove a tag. `claims-review` requires a note explaining why it's safe to unlock (spec §4). */
export async function removeTag(input: {
  pagePath: string;
  tag: SeoPageTag;
  note: string | null;
  actorId: number | null;
}): Promise<void> {
  if (input.tag === "claims-review" && !input.note?.trim()) {
    throw new TagNoteRequiredError(input.tag);
  }
  const db = await getDb();
  if (!db) return;
  await db.delete(seoPageTags).where(and(eq(seoPageTags.pagePath, input.pagePath), eq(seoPageTags.tag, input.tag)));
  await logAudit({
    actorId: input.actorId,
    action: "tag_removed",
    batchId: null,
    pagePath: input.pagePath,
    before: { tag: input.tag },
    after: { note: input.note },
    lintResult: null,
  });
}

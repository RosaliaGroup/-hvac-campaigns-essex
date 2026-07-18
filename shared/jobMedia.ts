/**
 * Job media — pure, framework-free helpers for technician notes and job photos
 * (PR #40). Shared by the client (work order UI) and the server (procedures) so
 * note-edit permissions, note/photo types, and image validation are defined in
 * exactly one place. No DB, no React, no Node APIs.
 */

// ── Note types ───────────────────────────────────────────────────────────────

export const NOTE_TYPES = ["internal", "customer"] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const NOTE_TYPE_LABEL: Record<NoteType, string> = {
  internal: "Internal",
  customer: "Customer",
};

/** Badge classes per note type (Tailwind), matching the field app idiom. */
export const NOTE_TYPE_BADGE: Record<NoteType, string> = {
  internal: "bg-slate-100 text-slate-700 border-slate-200",
  customer: "bg-sky-100 text-sky-700 border-sky-200",
};

/** True only for notes that are safe to show a customer. */
export function isCustomerVisibleNote(note: { visibility: string }): boolean {
  return note.visibility === "customer";
}

/**
 * Filter notes to ONLY the customer-safe ones. Internal notes are STAFF-ONLY and
 * must never reach any customer-facing surface (portal / SMS / email / invoice /
 * appointment confirmation / export / AI context). Any code that shows or sends
 * notes to a customer MUST route them through this filter. The leak-guard test
 * (server/internalNotes.leak.test.ts) additionally enforces that no
 * customer-facing module reads `jobNotes` at all.
 */
export function filterCustomerVisibleNotes<T extends { visibility: string }>(notes: T[]): T[] {
  return notes.filter(isCustomerVisibleNote);
}

// ── Photo categories ─────────────────────────────────────────────────────────

export const PHOTO_CATEGORIES = ["before", "during", "after", "general"] as const;
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

export const PHOTO_CATEGORY_LABEL: Record<PhotoCategory, string> = {
  before: "Before",
  during: "During",
  after: "After",
  general: "General",
};

export function isPhotoCategory(v: unknown): v is PhotoCategory {
  return typeof v === "string" && (PHOTO_CATEGORIES as readonly string[]).includes(v);
}

// ── Image validation ─────────────────────────────────────────────────────────

/** Image MIME types we accept for job photos. Others are rejected. */
export const SUPPORTED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export type SupportedImageMime = (typeof SUPPORTED_IMAGE_MIME)[number];

export function isSupportedImageType(mime: string | null | undefined): mime is SupportedImageMime {
  return typeof mime === "string" && (SUPPORTED_IMAGE_MIME as readonly string[]).includes(mime.toLowerCase());
}

/**
 * Max stored size for a single (already client-compressed) photo. Compression
 * targets well under this; the server rejects anything larger to bound the blob
 * table row size and prevent abuse.
 */
export const MAX_STORED_PHOTO_BYTES = 3 * 1024 * 1024; // 3 MB

/** Approximate the decoded byte length of a base64 string (without decoding it). */
export function base64ByteLength(base64: string): number {
  const len = base64.length;
  if (len === 0) return 0;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

export interface ParsedDataUrl {
  mime: string;
  base64: string;
  bytes: number;
}

/**
 * Parse a `data:<mime>;base64,<data>` URL into its parts, or null if it isn't a
 * well-formed base64 data URL. Used to validate uploads on both ends.
 */
export function parseImageDataUrl(dataUrl: string | null | undefined): ParsedDataUrl | null {
  if (typeof dataUrl !== "string") return null;
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const base64 = m[2];
  return { mime, base64, bytes: base64ByteLength(base64) };
}

export type PhotoRejectReason = "not_data_url" | "unsupported_type" | "too_large" | "empty";

/**
 * Validate an uploaded photo data URL. Returns the parsed parts when valid, or a
 * machine-readable reason so the caller can surface the right message and the
 * server can reject with BAD_REQUEST.
 */
export function validatePhotoUpload(
  dataUrl: string | null | undefined,
  maxBytes: number = MAX_STORED_PHOTO_BYTES,
): { ok: true; value: ParsedDataUrl } | { ok: false; reason: PhotoRejectReason } {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) return { ok: false, reason: "not_data_url" };
  if (parsed.bytes === 0) return { ok: false, reason: "empty" };
  if (!isSupportedImageType(parsed.mime)) return { ok: false, reason: "unsupported_type" };
  if (parsed.bytes > maxBytes) return { ok: false, reason: "too_large" };
  return { ok: true, value: parsed };
}

// ── Note edit permissions ────────────────────────────────────────────────────

/**
 * Whether a user may EDIT an existing note. Rules (PR #40):
 *   - While the job is NOT completed:
 *       · admins may edit any note (full access)
 *       · a technician may edit ONLY their own notes
 *   - After the job is completed (technician work status = "completed"):
 *       · Customer notes are read-only for everyone (locked)
 *       · Internal notes are editable only by an admin
 * Pure and exhaustively testable; the server enforces it before any write.
 */
export function canEditNote(input: {
  isAdmin: boolean;
  memberId: number | null;
  note: { authorId: number | null; visibility: NoteType };
  jobCompleted: boolean;
}): boolean {
  const { isAdmin, memberId, note, jobCompleted } = input;
  if (jobCompleted) {
    if (note.visibility === "customer") return false; // locked after completion
    return isAdmin; // internal notes: admin only after completion
  }
  if (isAdmin) return true;
  return memberId != null && note.authorId === memberId; // own notes only
}

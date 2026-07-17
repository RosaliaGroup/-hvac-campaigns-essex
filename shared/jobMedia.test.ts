import { describe, it, expect } from "vitest";
import {
  NOTE_TYPES, PHOTO_CATEGORIES, PHOTO_CATEGORY_LABEL, isPhotoCategory,
  SUPPORTED_IMAGE_MIME, isSupportedImageType, base64ByteLength,
  parseImageDataUrl, validatePhotoUpload, canEditNote, MAX_STORED_PHOTO_BYTES,
  type NoteType,
} from "./jobMedia";

// Small valid base64 (a few bytes) as a JPEG data URL.
const TINY = "/9j/4AAQSkZJRg=="; // arbitrary valid base64
const jpg = (b64 = TINY) => `data:image/jpeg;base64,${b64}`;

describe("jobMedia — note types & photo categories", () => {
  it("defines the two note types", () => {
    expect(NOTE_TYPES).toEqual(["internal", "customer"]);
  });
  it("defines the four photo categories with labels", () => {
    expect(PHOTO_CATEGORIES).toEqual(["before", "during", "after", "general"]);
    expect(PHOTO_CATEGORY_LABEL.before).toBe("Before");
    expect(isPhotoCategory("during")).toBe(true);
    expect(isPhotoCategory("sideways")).toBe(false);
  });
});

describe("jobMedia — image type validation", () => {
  it("accepts jpeg/png/webp only", () => {
    expect(SUPPORTED_IMAGE_MIME).toEqual(["image/jpeg", "image/png", "image/webp"]);
    for (const m of SUPPORTED_IMAGE_MIME) expect(isSupportedImageType(m)).toBe(true);
    expect(isSupportedImageType("image/gif")).toBe(false);
    expect(isSupportedImageType("application/pdf")).toBe(false);
    expect(isSupportedImageType(null)).toBe(false);
    expect(isSupportedImageType("IMAGE/JPEG")).toBe(true); // case-insensitive
  });

  it("estimates base64 byte length", () => {
    expect(base64ByteLength("")).toBe(0);
    expect(base64ByteLength("QQ==")).toBe(1);
    expect(base64ByteLength("QUJD")).toBe(3);
  });

  it("parses a base64 data URL into mime/base64/bytes", () => {
    const p = parseImageDataUrl(jpg());
    expect(p?.mime).toBe("image/jpeg");
    expect(p?.base64).toBe(TINY);
    expect(parseImageDataUrl("not a data url")).toBeNull();
    expect(parseImageDataUrl(null)).toBeNull();
  });
});

describe("jobMedia — validatePhotoUpload (rejects unsupported/invalid)", () => {
  it("accepts a supported image data URL", () => {
    const r = validatePhotoUpload(jpg());
    expect(r.ok).toBe(true);
  });
  it("rejects a non-data-url", () => {
    expect(validatePhotoUpload("https://x/y.jpg")).toEqual({ ok: false, reason: "not_data_url" });
  });
  it("rejects an unsupported image type (gif) and non-images (pdf)", () => {
    expect(validatePhotoUpload("data:image/gif;base64," + TINY)).toEqual({ ok: false, reason: "unsupported_type" });
    expect(validatePhotoUpload("data:application/pdf;base64," + TINY)).toEqual({ ok: false, reason: "unsupported_type" });
  });
  it("rejects an oversized image", () => {
    // Build a base64 string whose decoded size exceeds the cap.
    const big = "A".repeat(Math.ceil((MAX_STORED_PHOTO_BYTES + 1024) * 4 / 3));
    expect(validatePhotoUpload(`data:image/jpeg;base64,${big}`)).toEqual({ ok: false, reason: "too_large" });
  });
});

describe("jobMedia — canEditNote (edit permissions, visibility, completed lock)", () => {
  const internal = { authorId: 5, visibility: "internal" as NoteType };
  const customer = { authorId: 5, visibility: "customer" as NoteType };

  it("technician may edit their OWN note while job is open", () => {
    expect(canEditNote({ isAdmin: false, memberId: 5, note: internal, jobCompleted: false })).toBe(true);
    expect(canEditNote({ isAdmin: false, memberId: 5, note: customer, jobCompleted: false })).toBe(true);
  });
  it("technician may NOT edit another technician's note", () => {
    expect(canEditNote({ isAdmin: false, memberId: 9, note: internal, jobCompleted: false })).toBe(false);
  });
  it("admin may edit any note while job is open", () => {
    expect(canEditNote({ isAdmin: true, memberId: null, note: internal, jobCompleted: false })).toBe(true);
    expect(canEditNote({ isAdmin: true, memberId: null, note: customer, jobCompleted: false })).toBe(true);
  });

  it("after completion: internal notes editable ONLY by admin", () => {
    expect(canEditNote({ isAdmin: true, memberId: 1, note: internal, jobCompleted: true })).toBe(true);
    expect(canEditNote({ isAdmin: false, memberId: 5, note: internal, jobCompleted: true })).toBe(false); // even the author
  });
  it("after completion: customer notes are READ-ONLY for everyone (locked)", () => {
    expect(canEditNote({ isAdmin: true, memberId: 1, note: customer, jobCompleted: true })).toBe(false);
    expect(canEditNote({ isAdmin: false, memberId: 5, note: customer, jobCompleted: true })).toBe(false);
  });

  it("a login with no team profile cannot edit others' notes", () => {
    expect(canEditNote({ isAdmin: false, memberId: null, note: internal, jobCompleted: false })).toBe(false);
  });
});

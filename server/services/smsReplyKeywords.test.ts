/**
 * Inbound keyword classification tests (Task 9 / Task 12).
 * Covers STOP, START, UNSUBSCRIBE, CANCEL, END, QUIT, HELP + normal messages.
 */
import { describe, it, expect } from "vitest";
import { classifyInbound, isOptOutMessage } from "./smsReplyKeywords";

describe("classifyInbound — opt-out (STOP family)", () => {
  for (const kw of ["STOP", "stop", "Stop", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "STOPALL", "REMOVE"]) {
    it(`classifies "${kw}" as stop`, () => {
      expect(classifyInbound(kw)).toBe("stop");
    });
  }

  it("tolerates surrounding whitespace and trailing punctuation", () => {
    expect(classifyInbound("  STOP  ")).toBe("stop");
    expect(classifyInbound("Stop.")).toBe("stop");
    expect(classifyInbound("STOP!")).toBe("stop");
  });

  it("isOptOutMessage agrees with classifyInbound", () => {
    expect(isOptOutMessage("STOP")).toBe(true);
    expect(isOptOutMessage("hello")).toBe(false);
  });
});

describe("classifyInbound — opt-in (START family)", () => {
  for (const kw of ["START", "start", "UNSTOP", "YES", "RESUME"]) {
    it(`classifies "${kw}" as start`, () => {
      expect(classifyInbound(kw)).toBe("start");
    });
  }
});

describe("classifyInbound — HELP", () => {
  for (const kw of ["HELP", "help", "INFO"]) {
    it(`classifies "${kw}" as help`, () => {
      expect(classifyInbound(kw)).toBe("help");
    });
  }
});

describe("classifyInbound — normal messages", () => {
  it("treats free text as a message", () => {
    expect(classifyInbound("What time is my appointment?")).toBe("message");
    expect(classifyInbound("stop by at 3pm")).toBe("message"); // multi-word, not the keyword
    expect(classifyInbound("")).toBe("message");
    expect(classifyInbound(null)).toBe("message");
    expect(classifyInbound(undefined)).toBe("message");
  });
});

describe("isPotentialHvacInstallReply — qualified positive inbound interest", () => {
  const intro = "Mechanical Enterprise: Are you interested in an HVAC replacement or upgrade? Reply YES to request an estimate.";
  it("qualifies YES only in the context of a relevant prior outbound", async () => {
    const { isPotentialHvacInstallReply } = await import("./smsReplyKeywords");
    expect(isPotentialHvacInstallReply("YES", intro)).toBe(true);
    expect(isPotentialHvacInstallReply("YES", "Your appointment is tomorrow. Reply YES to confirm.")).toBe(false);
    expect(isPotentialHvacInstallReply("YES")).toBe(false);
  });
  it("recognizes explicit requested installation even without previous text", async () => {
    const { isPotentialHvacInstallReply } = await import("./smsReplyKeywords");
    expect(isPotentialHvacInstallReply("Yes, I need to replace my furnace")).toBe(true);
    expect(isPotentialHvacInstallReply("I'm interested in an HVAC upgrade")).toBe(true);
    expect(isPotentialHvacInstallReply("No thanks, not interested in replacement", intro)).toBe(false);
    expect(isPotentialHvacInstallReply("STOP", intro)).toBe(false);
  });
});

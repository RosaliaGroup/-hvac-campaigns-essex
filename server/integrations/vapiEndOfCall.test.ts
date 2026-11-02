import { describe, expect, it } from "vitest";
import {
  TRANSCRIPT_MARKER,
  endOfCallEmailHtml,
  isEndOfCallReport,
  isOtherServerMessage,
  parseEndOfCallReport,
  recapField,
  renderReportBlock,
  renderTranscript,
} from "./vapiEndOfCall";
import { buildRecapRecord } from "./callRecap";

const report = {
  message: {
    type: "end-of-call-report",
    endedReason: "customer-ended-call",
    durationSeconds: 186.4,
    call: { id: "01a1-316ca", type: "inboundPhoneCall", customer: { number: "+12014496850" } },
    analysis: { summary: "Ana booked a free furnace assessment for Thursday at 3 PM." },
    artifact: {
      recordingUrl: "https://storage.vapi.ai/rec.wav",
      transcript: "AI: Thanks for calling.\nUser: I want an appointment.",
      messages: [
        { role: "system", message: "SECRET PROMPT" },
        { role: "bot", message: "Thanks for calling Mechanical Enterprise." },
        { role: "user", message: "I wanna set up an appointment." },
        { role: "tool_calls", toolCalls: [] },
        { role: "bot", message: "You're all set." },
      ],
    },
  },
};

describe("vapiEndOfCall — parsing", () => {
  it("recognises end-of-call reports and other server messages", () => {
    expect(isEndOfCallReport(report)).toBe(true);
    expect(isOtherServerMessage({ message: { type: "status-update" } })).toBe(true);
    expect(isOtherServerMessage(report)).toBe(false);
    expect(isEndOfCallReport({ caller_name: "Ana" })).toBe(false);
    expect(isOtherServerMessage({ caller_name: "Ana" })).toBe(false);
  });

  it("extracts call id, phone, summary, recording, duration and a labelled transcript", () => {
    const r = parseEndOfCallReport(report)!;
    expect(r.callId).toBe("01a1-316ca");
    expect(r.direction).toBe("inbound");
    expect(r.rawPhone).toBe("+12014496850");
    expect(r.durationSeconds).toBe(186);
    expect(r.summary).toContain("furnace");
    expect(r.recordingUrl).toBe("https://storage.vapi.ai/rec.wav");
    expect(r.transcript).toBe(
      "Jessica: Thanks for calling Mechanical Enterprise.\nCaller: I wanna set up an appointment.\nJessica: You're all set.",
    );
    // the system prompt never leaks into the transcript
    expect(r.transcript).not.toContain("SECRET");
  });

  it("falls back to the flat transcript when there is no message list", () => {
    expect(renderTranscript(undefined, "AI: Hi.\nUser: Hello.")).toBe("Jessica: Hi.\nCaller: Hello.");
  });

  it("returns null without a call id", () => {
    expect(parseEndOfCallReport({ message: { type: "end-of-call-report", call: {} } })).toBeNull();
  });

  it("marks outbound calls", () => {
    const r = parseEndOfCallReport({
      message: { ...report.message, call: { ...report.message.call, type: "outboundPhoneCall" } },
    })!;
    expect(r.direction).toBe("outbound");
  });
});

describe("vapiEndOfCall — rendering", () => {
  const r = parseEndOfCallReport(report)!;

  it("report block has summary, recording and the full transcript", () => {
    const block = renderReportBlock(r);
    expect(block).toContain("── AI summary ──");
    expect(block).toContain("Recording: https://storage.vapi.ai/rec.wav");
    expect(block).toContain(TRANSCRIPT_MARKER);
    expect(block).toContain("Caller: I wanna set up an appointment.");
  });

  it("email includes recap, summary, transcript and escapes HTML", () => {
    const recap = "── Call recap ──\nCaller: Ana <b>Haynes</b>\nPhone: 2014496850";
    const html = endOfCallEmailHtml(r, recap);
    expect(html).toContain("Full transcript");
    expect(html).toContain("furnace assessment");
    expect(html).toContain("I wanna set up an appointment.");
    expect(html).toContain("Ana &lt;b&gt;Haynes&lt;/b&gt;");
    expect(html).not.toContain("<b>Haynes</b>");
  });

  it("email says when no recap tool call happened", () => {
    expect(endOfCallEmailHtml(r, null)).toContain("No recap tool call");
  });

  it("reads fields from stored recap text", () => {
    expect(recapField("Caller: Ana\nRequested service: free_consultation", "Requested service")).toBe("free_consultation");
    expect(recapField(null, "Caller")).toBeNull();
  });
});

describe("callRecap — live tool fields", () => {
  it("keeps appointment_date / appointment_time sent by the Vapi tool", () => {
    const rec = buildRecapRecord({
      caller_name: "Ana",
      caller_phone: "2014496850",
      appointment_date: "Thursday, November 5",
      appointment_time: "3 PM",
    });
    expect(rec.appointmentDetails).toBe("Thursday, November 5 at 3 PM");
  });
});

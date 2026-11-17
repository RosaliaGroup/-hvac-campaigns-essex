import { describe, expect, it } from "vitest";
import { parseAnswer } from "./teamHubAnswer";

describe("parseAnswer", () => {
  it("accepts a confident answer", () => {
    expect(parseAnswer('{"confident": true, "answer": "Look only today."}')).toEqual({ confident: true, answer: "Look only today.", clarify: "" });
  });
  it("treats an empty answer as not confident", () => {
    expect(parseAnswer('{"confident": true, "answer": ""}').confident).toBe(false);
  });
  it("handles text around the JSON and bad JSON", () => {
    expect(parseAnswer('Sure: {"confident": false, "answer": ""}').confident).toBe(false);
    expect(parseAnswer("not json")).toEqual({ confident: false, answer: "", clarify: "" });
    expect(parseAnswer(undefined)).toEqual({ confident: false, answer: "", clarify: "" });
  });
  it("passes a clarifying question through when not confident", () => {
    expect(parseAnswer('{"confident": false, "answer": "", "clarify": "Which pages?"}')).toEqual({ confident: false, answer: "", clarify: "Which pages?" });
    expect(parseAnswer('{"confident": true, "answer": "Do X.", "clarify": "Which?"}').clarify).toBe("");
  });
  it("marks chat messages that need no reply", () => {
    expect(parseAnswer('{"confident": false, "answer": "", "clarify": "", "no_reply": true}').noReply).toBe(true);
    expect(parseAnswer('{"confident": true, "answer": "Do X.", "no_reply": true}').noReply).toBeUndefined();
  });
});

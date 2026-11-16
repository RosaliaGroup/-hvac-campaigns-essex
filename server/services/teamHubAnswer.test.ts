import { describe, expect, it } from "vitest";
import { parseAnswer } from "./teamHubAnswer";

describe("parseAnswer", () => {
  it("accepts a confident answer", () => {
    expect(parseAnswer('{"confident": true, "answer": "Look only today."}')).toEqual({ confident: true, answer: "Look only today." });
  });
  it("treats an empty answer as not confident", () => {
    expect(parseAnswer('{"confident": true, "answer": ""}').confident).toBe(false);
  });
  it("handles text around the JSON and bad JSON", () => {
    expect(parseAnswer('Sure: {"confident": false, "answer": ""}').confident).toBe(false);
    expect(parseAnswer("not json")).toEqual({ confident: false, answer: "" });
    expect(parseAnswer(undefined)).toEqual({ confident: false, answer: "" });
  });
});

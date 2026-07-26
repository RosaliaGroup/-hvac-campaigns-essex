import { describe, it, expect } from "vitest";
import { viewState } from "./viewState";

describe("viewState", () => {
  it("prefers loading over everything (loading wins even if error/empty)", () => {
    expect(viewState({ isLoading: true, isError: true, isEmpty: true })).toBe("loading");
    expect(viewState({ isLoading: true, isError: false, isEmpty: false })).toBe("loading");
  });

  it("reports error when not loading (a failed query must not look empty)", () => {
    expect(viewState({ isLoading: false, isError: true, isEmpty: true })).toBe("error");
    expect(viewState({ isLoading: false, isError: true, isEmpty: false })).toBe("error");
  });

  it("reports empty only when settled, successful, and there are no rows", () => {
    expect(viewState({ isLoading: false, isError: false, isEmpty: true })).toBe("empty");
  });

  it("reports ready when settled with data", () => {
    expect(viewState({ isLoading: false, isError: false, isEmpty: false })).toBe("ready");
  });
});

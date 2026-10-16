import { describe, expect, it } from "vitest";
import { checkGbpProject } from "./projectPreflight";
describe("GBP approved project preflight", () => {
  it("accepts the approved project", () => expect(checkGbpProject("408029125716-example.apps.googleusercontent.com").matches).toBe(true));
  it("rejects another project", () => expect(checkGbpProject("123456789-example.apps.googleusercontent.com").matches).toBe(false));
  it("fails closed when no client is configured", () => expect(checkGbpProject(undefined).matches).toBe(false));
});

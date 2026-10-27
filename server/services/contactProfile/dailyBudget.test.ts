import { afterEach, expect, it, vi } from "vitest";
const execute = vi.hoisted(()=>vi.fn());
vi.mock("../../db",()=>({getDb:async()=>({execute})}));
import { dailyResearchLimit, reserveProfileResearch } from "./dailyBudget";
afterEach(()=>{vi.unstubAllEnvs();execute.mockReset();});
it("validates limits and allows an explicit zero spend setting",()=>{
  expect(dailyResearchLimit({})).toBe(10);
  expect(dailyResearchLimit({CRM_PROFILE_DAILY_LIMIT:"0"})).toBe(0);
  expect(dailyResearchLimit({CRM_PROFILE_DAILY_LIMIT:"bad"})).toBe(10);
});
it("does not call the database when disabled",async()=>{
  vi.stubEnv("CRM_PROFILE_DAILY_LIMIT","0");
  expect(await reserveProfileResearch()).toBe(false);
  expect(execute).not.toHaveBeenCalled();
});
it("claims the next free slot and stops when all slots are occupied",async()=>{
  vi.stubEnv("CRM_PROFILE_DAILY_LIMIT","2");
  execute.mockResolvedValueOnce([]).mockResolvedValueOnce([{affectedRows:0}]).mockResolvedValueOnce([{affectedRows:1}]);
  expect(await reserveProfileResearch()).toBe(true);
  execute.mockResolvedValue([{affectedRows:0}]);
  expect(await reserveProfileResearch()).toBe(false);
});
it("fails closed when the budget cannot be reserved",async()=>{
  execute.mockRejectedValueOnce(new Error("database unavailable"));
  await expect(reserveProfileResearch()).rejects.toThrow("database unavailable");
});

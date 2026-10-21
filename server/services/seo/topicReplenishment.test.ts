import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../_core/anthropic", () => ({ callAnthropicModelChain: vi.fn() }));
vi.mock("./contentQueue", () => ({ listContentQueue: vi.fn(), proposeTopic: vi.fn(), updateQueueStatus: vi.fn() }));
import { callAnthropicModelChain } from "../../_core/anthropic";
import { listContentQueue, proposeTopic, updateQueueStatus } from "./contentQueue";
import { selectFreshTopics, replenishContentTopics, RECOVERY_TOPICS } from "./topicReplenishment";
import { VERIFIED_FACTS } from "../../../shared/verifiedFacts";
const facts = { ...VERIFIED_FACTS, incentives: [{program:"verified",amountText:"",verifiedOn:"2026-10-21",source:"owner"}] };
const original = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  process.env.SEO_CONTENT_PIPELINE_ENABLED = "true";
  process.env.SEO_AUTOPUBLISH_ENABLED = "true";
  process.env.ANTHROPIC_API_KEY = "test";
  vi.mocked(listContentQueue).mockResolvedValue([]);
  vi.mocked(proposeTopic).mockImplementation(async t => ({id:1,...t}) as never);
  vi.mocked(callAnthropicModelChain).mockResolvedValue({ok:true,text:JSON.stringify(RECOVERY_TOPICS)} as never);
});
afterEach(() => { process.env = { ...original }; });
describe("automatic topic recovery", () => {
  it("rejects duplicates, malformed topics, unsafe subjects and duplicate rewordings", () => {
    const [first,second] = RECOVERY_TOPICS;
    const selected = selectFreshTopics([first, {...first,title:first.title.toUpperCase()}, {title:"empty"}, {...second,title:"Free homeowner rebates"},second], [first.title]);
    expect(selected).toEqual([second]);
  });
  it("replenishes once for simultaneous requests, with queued provenance", async () => {
    const a = replenishContentTopics(facts,[]); const b = replenishContentTopics(facts,[]);
    expect(a).toBe(b);
    expect(await a).toBe(6);
    expect(callAnthropicModelChain).toHaveBeenCalledTimes(1);
    expect(proposeTopic).toHaveBeenCalledWith(expect.objectContaining({source:"auto-replenishment"}));
    expect(updateQueueStatus).toHaveBeenCalledTimes(6);
  });
  it("uses fresh evergreen subjects when model generation fails", async () => {
    vi.mocked(callAnthropicModelChain).mockRejectedValue(new Error("unavailable"));
    expect(await replenishContentTopics(facts,[RECOVERY_TOPICS[0].title])).toBe(6);
    expect(proposeTopic).not.toHaveBeenCalledWith(expect.objectContaining({title:RECOVERY_TOPICS[0].title}));
  });
  it("does not reactivate old topics or repeat topics from any queue status", async () => {
    vi.mocked(listContentQueue).mockResolvedValue(RECOVERY_TOPICS.map(t=>({...t,status:"published"})) as never);
    expect(await replenishContentTopics(facts,[])).toBe(0);
    expect(updateQueueStatus).not.toHaveBeenCalled();
  });
  it("does not generate while topics remain or automatic publishing is off", async () => {
    vi.mocked(listContentQueue).mockResolvedValue([{status:"queued"}] as never);
    expect(await replenishContentTopics(facts,[])).toBe(0);
    process.env.SEO_AUTOPUBLISH_ENABLED = "false";
    expect(await replenishContentTopics(facts,[])).toBe(0);
    expect(callAnthropicModelChain).not.toHaveBeenCalled();
  });
});

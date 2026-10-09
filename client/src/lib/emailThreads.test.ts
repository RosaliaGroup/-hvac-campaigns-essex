import { expect, it } from "vitest";
import { groupEmailThreads, splitQuotedEmail } from "./emailThreads";
const msg = (id: number, thread: string | null, time: string) => ({
  id,
  channel: "email",
  provider: "gmail",
  providerThreadId: thread,
  occurredAt: time,
  direction: "inbound",
  subject: "Same subject",
});
it("groups only by provider thread and sorts messages oldest first and conversations newest first", () => {
  const groups = groupEmailThreads([
    msg(2, "a", "2026-10-02"),
    msg(1, "a", "2026-10-01"),
    msg(3, "b", "2026-10-03"),
    msg(4, null, "2026-09-01"),
    msg(5, null, "2026-09-02"),
  ]);
  expect(groups).toHaveLength(4);
  expect(groups[0].latest.id).toBe(3);
  expect(groups[1].messages.map(m => m.id)).toEqual([1, 2]);
});
it("keeps a chain intact across inbox and sent messages", () => {
  const groups = groupEmailThreads([
    msg(1, "a", "2026-10-01"),
    { ...msg(2, "a", "2026-10-02"), direction: "outbound" },
  ]);
  expect(groups).toHaveLength(1);
  expect(groups[0].latest.id).toBe(2);
});
it("separates quoted history without discarding it", () => {
  expect(
    splitQuotedEmail("Thank you\nOn Wednesday someone wrote:\nEarlier email")
  ).toEqual({
    text: "Thank you",
    quoted: "On Wednesday someone wrote:\nEarlier email",
  });
  expect(splitQuotedEmail("Normal body")).toEqual({
    text: "Normal body",
    quoted: "",
  });
});

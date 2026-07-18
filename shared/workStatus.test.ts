import { describe, expect, it } from "vitest";
import {
  TECHNICIAN_WORK_STATUSES,
  DEFAULT_WORK_STATUS,
  WORK_STATUS_LABEL,
  WORK_STATUS_BADGE,
  isTechnicianWorkStatus,
  nextWorkStatuses,
  canTransitionWorkStatus,
  isWorkComplete,
  workStatusStep,
  type TechnicianWorkStatus,
} from "./workStatus";

describe("workStatus — enum + presentation", () => {
  it("exposes the seven required lifecycle statuses in order", () => {
    expect(TECHNICIAN_WORK_STATUSES).toEqual([
      "assigned", "accepted", "en_route", "arrived", "working", "waiting_parts", "completed",
    ]);
  });

  it("has a label and a badge class for every status", () => {
    for (const s of TECHNICIAN_WORK_STATUSES) {
      expect(WORK_STATUS_LABEL[s]).toBeTruthy();
      expect(WORK_STATUS_BADGE[s]).toMatch(/bg-.*text-.*border-/);
    }
  });

  it("labels Waiting for Parts and En Route correctly", () => {
    expect(WORK_STATUS_LABEL.waiting_parts).toBe("Waiting for Parts");
    expect(WORK_STATUS_LABEL.en_route).toBe("En Route");
  });

  it("defaults to assigned", () => {
    expect(DEFAULT_WORK_STATUS).toBe("assigned");
  });

  it("isTechnicianWorkStatus guards unknown values", () => {
    expect(isTechnicianWorkStatus("arrived")).toBe(true);
    expect(isTechnicianWorkStatus("done")).toBe(false);
    expect(isTechnicianWorkStatus(null)).toBe(false);
    expect(isTechnicianWorkStatus(3)).toBe(false);
  });
});

describe("workStatus — transitions", () => {
  it("follows the guided linear happy path", () => {
    expect(nextWorkStatuses("assigned")).toEqual(["accepted"]);
    expect(nextWorkStatuses("accepted")).toEqual(["en_route"]);
    expect(nextWorkStatuses("en_route")).toEqual(["arrived"]);
    expect(nextWorkStatuses("arrived")).toEqual(["working"]);
  });

  it("lets working toggle to waiting_parts, but NOT complete via the status control", () => {
    // `completed` is reached only via jobs.completeJob (atomic). The generic
    // status control must not offer it — see fix/technician-field-defects (#3).
    expect(nextWorkStatuses("working")).toEqual(["waiting_parts"]);
    expect(nextWorkStatuses("working")).not.toContain("completed");
  });

  it("lets waiting_parts resume work, but NOT complete via the status control", () => {
    expect(nextWorkStatuses("waiting_parts")).toEqual(["working"]);
    expect(nextWorkStatuses("waiting_parts")).not.toContain("completed");
  });

  it("completed is never a target of the generic status control (only completeJob sets it)", () => {
    for (const from of ["assigned", "accepted", "en_route", "arrived", "working", "waiting_parts", "completed"] as TechnicianWorkStatus[]) {
      expect(canTransitionWorkStatus(from, "completed")).toBe(false);
    }
  });

  it("treats completed as terminal", () => {
    expect(nextWorkStatuses("completed")).toEqual([]);
    expect(isWorkComplete("completed")).toBe(true);
    expect(isWorkComplete("working")).toBe(false);
  });

  it("canTransitionWorkStatus permits only single-step moves", () => {
    expect(canTransitionWorkStatus("assigned", "accepted")).toBe(true);
    expect(canTransitionWorkStatus("working", "waiting_parts")).toBe(true);
    expect(canTransitionWorkStatus("working", "completed")).toBe(false); // completion is via completeJob only
    expect(canTransitionWorkStatus("waiting_parts", "working")).toBe(true);
    // illegal jumps rejected
    expect(canTransitionWorkStatus("assigned", "completed")).toBe(false);
    expect(canTransitionWorkStatus("arrived", "en_route")).toBe(false); // no going back
    expect(canTransitionWorkStatus("completed", "working")).toBe(false); // terminal
  });

  it("every non-terminal status has at least one next step; only completed is a sink", () => {
    for (const s of TECHNICIAN_WORK_STATUSES) {
      const next = nextWorkStatuses(s as TechnicianWorkStatus);
      if (s === "completed") expect(next).toHaveLength(0);
      else expect(next.length).toBeGreaterThan(0);
    }
  });
});

describe("workStatus — timeline step", () => {
  it("maps statuses to increasing timeline positions", () => {
    expect(workStatusStep("assigned")).toBe(0);
    expect(workStatusStep("accepted")).toBe(1);
    expect(workStatusStep("en_route")).toBe(2);
    expect(workStatusStep("arrived")).toBe(3);
    expect(workStatusStep("working")).toBe(4);
    expect(workStatusStep("completed")).toBe(5);
  });

  it("places waiting_parts at the working step (a pause, not a 7th step)", () => {
    expect(workStatusStep("waiting_parts")).toBe(workStatusStep("working"));
  });
});

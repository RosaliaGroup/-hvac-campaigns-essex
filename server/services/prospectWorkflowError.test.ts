import { describe, expect, it } from "vitest";
import { prospectWorkflowErrorKind } from "./prospectWorkflowError";

describe("prospect workflow failure diagnostics", () => {
  it("recognizes a missing table through a wrapped database error", () => {
    expect(prospectWorkflowErrorKind({ cause: { code: "ER_NO_SUCH_TABLE", errno: 1146 } })).toBe("database_table_missing");
  });
  it("does not expose SQL or credentials on an unrecognized error", () => {
    expect(prospectWorkflowErrorKind(new Error("secret and SQL"))).toBe("workflow_error");
  });
  it("handles cyclic error causes", () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(prospectWorkflowErrorKind(error)).toBe("workflow_error");
  });
});

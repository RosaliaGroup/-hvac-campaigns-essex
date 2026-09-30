import { describe, it, expect } from "vitest";
import { resolveRepoPath } from "./repoPath";

describe("resolveRepoPath", () => {
  it("finds files at the repo root and in subfolders (source layout, or cwd)", () => {
    expect(resolveRepoPath("netlify.toml")).toMatch(/netlify.toml$/);
    expect(resolveRepoPath("docs", "intel-notes")).toMatch(/intel-notes$/);
  });
  it("returns null for something that does not exist, never a guessed path", () => {
    expect(resolveRepoPath("definitely", "not", "here.txt")).toBeNull();
  });
});

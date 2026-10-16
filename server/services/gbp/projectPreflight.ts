export function checkGbpProject(clientId: string | undefined, expected = "408029125716") {
  const actual = clientId?.match(/^(\d+)-[^.]+\.apps\.googleusercontent\.com$/)?.[1] ?? null;
  return {
    actual,
    expected,
    matches: actual === expected,
    reason: !actual ? "OAuth client project number unavailable" : actual !== expected ? "OAuth client is not from approved project" : "Approved project matched",
  };
}

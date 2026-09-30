import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { SHARED_GOOGLE_CONNECTION_PATH } from "./sharedGoogleConnection";

const read = (rel: string) => fs.readFileSync(path.resolve(import.meta.dirname, "..", rel), "utf-8");

describe("shared Google connection link target", () => {
  it("is a real, registered route (so the legacy tab's link can't dangle)", () => {
    expect(SHARED_GOOGLE_CONNECTION_PATH).toBe("/settings/integrations");
    expect(read("App.tsx")).toContain(`<Route path={"${SHARED_GOOGLE_CONNECTION_PATH}"}`);
  });

  it("the Integrations page actually hosts the Google connect / reconnect / disconnect control", () => {
    const page = read("pages/settings/Integrations.tsx");
    expect(page).toContain("trpc.googleCalendar.connectStart");
    expect(page).toContain("trpc.googleCalendar.disconnect");
  });
});

describe("AI VA Settings → Google Business tab is marked legacy and links to the shared connection", () => {
  const src = read("pages/AIVASettings.tsx");

  it("the tab trigger carries a Legacy badge", () => {
    const trigger = src.slice(src.indexOf('<TabsTrigger value="google">'), src.indexOf('<TabsTrigger value="google-ads">'));
    expect(trigger).toContain("Google Business");
    expect(trigger).toContain("Legacy");
  });

  it("the tab body shows a legacy notice that links to the shared connection path (not a hard-coded duplicate)", () => {
    const body = src.slice(src.indexOf('<TabsContent value="google">'), src.indexOf("</TabsContent>", src.indexOf('<TabsContent value="google">')));
    expect(body).toContain('data-testid="google-business-legacy-notice"');
    expect(body).toContain("href={SHARED_GOOGLE_CONNECTION_PATH}");
    expect(src).toContain('import { SHARED_GOOGLE_CONNECTION_PATH } from "@/lib/sharedGoogleConnection"');
  });

  it("the legacy credential form is still there and still saves (marking legacy must not remove the old posting path)", () => {
    const body = src.slice(src.indexOf('<TabsContent value="google">'), src.indexOf("</TabsContent>", src.indexOf('<TabsContent value="google">')));
    expect(body).toContain("handleSaveGoogle");
    for (const id of ["google-api-key", "google-client-id", "google-client-secret"]) expect(body).toContain(`id="${id}"`);
  });
});

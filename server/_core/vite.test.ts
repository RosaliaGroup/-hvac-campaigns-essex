import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import { registerStaticRoutes } from "./vite";

describe("Railway production CRM SPA routing", () => {
  let server: Server;
  let root: string;
  let origin: string;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "mechanical-crm-spa-"));
    fs.mkdirSync(path.join(root, "assets"));
    fs.writeFileSync(path.join(root, "index.html"),
      '<!doctype html><html><head><title>Home</title></head><body><div id="root">PRERENDERED HOME</div></body></html>');
    fs.writeFileSync(path.join(root, "200.html"),
      '<!doctype html><html><head><title>Shell</title></head><body><div id="root"></div></body></html>');
    fs.writeFileSync(path.join(root, "about.html"),
      '<!doctype html><html><head><title>About</title></head><body><div id="root">PRERENDERED ABOUT</div></body></html>');
    fs.writeFileSync(path.join(root, "assets", "app-test.js"), "console.log('asset');");

    const app = express();
    registerStaticRoutes(app, root);
    server = await new Promise<Server>(resolve => {
      const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test server port");
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it("serves the prerendered homepage at the exact root", async () => {
    const response = await fetch(origin + "/");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("PRERENDERED HOME");
  });

  it("serves extensionless public pages from their prerendered HTML files", async () => {
    const response = await fetch(origin + "/about");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("PRERENDERED ABOUT");
  });

  it.each(["/tasks", "/team-login", "/command-center", "/contacts/communications"])(
    "serves an empty SPA root for private CRM route %s (no homepage hydration mismatch)",
    async route => {
      const response = await fetch(origin + route);
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(html).toContain('<div id="root"></div>');
      expect(html).not.toContain("PRERENDERED HOME");
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
  );

  it("returns real JavaScript assets, and a 404 for missing assets", async () => {
    const good = await fetch(origin + "/assets/app-test.js");
    expect(good.status).toBe(200);
    expect(await good.text()).toContain("asset");
    const missing = await fetch(origin + "/assets/missing-hash.js");
    expect(missing.status).toBe(404);
    expect(await missing.text()).not.toContain("<div id");
  });
});

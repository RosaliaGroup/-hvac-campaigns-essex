import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { injectMeta } from "../seo";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      let page = await vite.transformIndexHtml(url, template);
      page = injectMeta(page, url);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

/**
 * Railway's production server must match Netlify's static routing:
 *   - /                  -> prerendered index.html
 *   - /about             -> prerendered about.html
 *   - /tasks, /team-login -> original empty-root SPA shell (200.html)
 *
 * scripts/prerender.ts deliberately overwrites index.html with the public
 * homepage and saves the unprerendered shell as 200.html. Serving index.html
 * as the catch-all causes React hydration error #418 on private CRM routes.
 */
export function registerStaticRoutes(app: Express, distPath: string) {
  if (!fs.existsSync(distPath)) {
    console.error(`Could not find the build directory: ${distPath}, make sure to build the client first`);
  }

  // Extensionless public routes use their prerendered HTML. Assets and the
  // exact "/" index retain Express static-file behavior.
  app.use(express.static(distPath, { extensions: ["html"] }));

  // A missing hashed asset must not silently return the HTML SPA shell.
  app.use("/assets", (_req, res) => {
    res.status(404).type("text/plain").send("Asset not found");
  });

  // Internal routes and unknown paths must receive an EMPTY root so the
  // browser uses createRoot() rather than hydrating unrelated homepage HTML.
  app.use("*", (req, res) => {
    const shellPath = path.resolve(distPath, "200.html");
    if (!fs.existsSync(shellPath)) {
      console.error(`SPA shell missing: ${shellPath}`);
      res.status(503).type("text/plain").send("Application shell unavailable");
      return;
    }
    let html = fs.readFileSync(shellPath, "utf-8");
    html = injectMeta(html, req.originalUrl);
    res
      .status(200)
      .set({
        "Content-Type": "text/html",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      })
      .send(html);
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  registerStaticRoutes(app, distPath);
}

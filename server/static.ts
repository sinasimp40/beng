import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { injectThemeIntoHtml } from "./themeInjector";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  // Inject theme colors from database directly into HTML
  app.use("*", async (_req, res) => {
    try {
      const indexPath = path.resolve(distPath, "index.html");
      let html = await fs.promises.readFile(indexPath, "utf-8");
      html = await injectThemeIntoHtml(html);
      res.status(200).set({ "Content-Type": "text/html" }).send(html);
    } catch (e) {
      res.sendFile(path.resolve(distPath, "index.html"));
    }
  });
}

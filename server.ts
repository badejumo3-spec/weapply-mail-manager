import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initDb } from "./server/db";
import { apiRouter } from "./server/api";
import { startPollingDaemon, stopPollingDaemon } from "./server/polling";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  await initDb();
  startPollingDaemon();

  app.use(express.json());

  // ✅ Health endpoint for keepalive
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", uptime: process.uptime() });
  });

  app.use("/api", apiRouter);

  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    console.log("[Server] Integrating dev Vite engine middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Server] Running in Production. Static hosting from /dist directory...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });

    // ✅ Auto self-ping every 10 minutes to prevent Render sleeping
    const SELF_URL = process.env.RENDER_EXTERNAL_URL;

    if (SELF_URL) {
      setInterval(async () => {
        try {
          await fetch(`${SELF_URL}/health`);
          console.log("[KeepAlive] ✓ Self-ping successful");
        } catch (err) {
          console.warn("[KeepAlive] ✗ Self-ping failed:", err);
        }
      }, 10 * 60 * 1000);
    } else {
      console.warn("[KeepAlive] ⚠ RENDER_EXTERNAL_URL not set. Add it in Render dashboard.");
    }
  }

  const server = app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`[Server] WeApply4U Mail Manager listening on http://0.0.0.0:${PORT}`);
  });

  const handleShutdown = () => {
    console.log("[SIGTERM/SIGINT] Shutting down application context safely...");
    stopPollingDaemon();
    server.close(() => {
      console.log("[Server] Express server connection closed.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", handleShutdown);
  process.on("SIGINT", handleShutdown);
}

startServer().catch((error) => {
  console.error("[Server] Fatal bootstrap exception:", error);
  process.exit(1);
});
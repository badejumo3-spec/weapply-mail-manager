import dotenv from "dotenv";
dotenv.config(); // Must run BEFORE database imports to ensure process.env.DATABASE_URL is found

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initDb } from "./server/db";
import { apiRouter } from "./server/api";
import { startPollingDaemon, stopPollingDaemon } from "./server/polling";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Initialize DB Tables DDL securely on startup
  await initDb();

  // Launch background message queue pulling engine
  startPollingDaemon();

  // Basic middleware parse setup
  app.use(express.json());

  // Mount REST backend routes
  app.use("/api", apiRouter);

  // Set up development or production serve configs
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
  }

  const server = app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`[Server] WeApply4U Mail Manager listening on http://0.0.0.0:${PORT}`);
  });

  // Graceful server context termination
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

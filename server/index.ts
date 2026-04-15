import express from "express";
import cors from "cors";
import path from "path";
import "dotenv/config";
import { routerHandler } from "./routes/router.js";
import { conversationTokenHandler } from "./routes/conversationToken.js";

const isProduction = process.env.NODE_ENV === "production";
const app = express();
const PORT = parseInt(process.env.PORT || (isProduction ? "5000" : "3001"), 10);

app.use(cors());
app.use(express.json());

app.post("/api/router", routerHandler);
app.post("/api/elevenlabs-conversation-token", conversationTokenHandler);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

if (isProduction) {
  const distPath = path.resolve(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get(/(.*)/, (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] listening on port ${PORT} (${isProduction ? "production" : "development"})`);
});

export default app;

import express from "express";
import cors from "cors";
import "dotenv/config";
import { routerHandler } from "./routes/router.js";
import { conversationTokenHandler } from "./routes/conversationToken.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(cors());
app.use(express.json());

app.post("/api/router", routerHandler);
app.post("/api/elevenlabs-conversation-token", conversationTokenHandler);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] listening on port ${PORT}`);
});

export default app;

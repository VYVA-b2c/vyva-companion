import type { Request, Response } from "express";

export async function conversationTokenHandler(req: Request, res: Response) {
  const { agent_id } = req.body as { agent_id?: string };

  if (!agent_id) {
    return res.status(400).json({ error: "agent_id required" });
  }

  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: "Missing ElevenLabs API key" });
  }

  try {
    const resp = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agent_id}`,
      { headers: { "xi-api-key": ELEVENLABS_API_KEY } }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({ error: "ElevenLabs token error", detail: errText });
    }

    const data = (await resp.json()) as { token?: string };
    return res.json({ token: data.token });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}

import type { Request, Response } from "express";

export async function conversationTokenHandler(req: Request, res: Response) {
  const { agent_id, prompt_override } = req.body as {
    agent_id?: string;
    prompt_override?: string;
  };

  if (!agent_id) {
    return res.status(400).json({ error: "agent_id required" });
  }

  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: "Missing ElevenLabs API key" });
  }

  try {
    if (prompt_override) {
      const resp = await fetch(
        "https://api.elevenlabs.io/v1/convai/conversation/get_signed_url",
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agent_id,
            overrides: { agent: { prompt: { prompt: prompt_override } } },
          }),
        }
      );

      if (!resp.ok) {
        const errText = await resp.text();
        console.warn("[conversationToken] signed URL with override failed:", errText);
        return signedUrlNoOverride(agent_id, ELEVENLABS_API_KEY, res);
      }

      const data = (await resp.json()) as { signed_url?: string };
      return res.json({ signed_url: data.signed_url });
    }

    return signedUrlNoOverride(agent_id, ELEVENLABS_API_KEY, res);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}

async function signedUrlNoOverride(agent_id: string, apiKey: string, res: Response) {
  const resp = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(agent_id)}`,
    { headers: { "xi-api-key": apiKey } }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    console.warn("[conversationToken] get_signed_url failed:", errText);
    return res.status(resp.status).json({ error: "ElevenLabs signed URL error", detail: errText });
  }

  const data = (await resp.json()) as { signed_url?: string };
  return res.json({ signed_url: data.signed_url });
}

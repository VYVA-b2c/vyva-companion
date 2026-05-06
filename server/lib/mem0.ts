import type { ConversationTurn } from "./voiceContext.js";

export type Mem0Memory = { memory?: string; content?: string; text?: string };

export function getMem0ApiKey(): string {
  return process.env.MEM0_API_KEY?.trim() || process.env.MEMO_API_KEY?.trim() || "";
}

export async function searchMemories(query: string, mem0UserId: string, apiKey = getMem0ApiKey()): Promise<Mem0Memory[]> {
  if (!apiKey || !query.trim() || !mem0UserId.trim()) return [];

  const headers = {
    Authorization: `Token ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const tryV1 = await fetch("https://api.mem0.ai/v1/memories/search/", {
    method: "POST",
    headers,
    body: JSON.stringify({ query, user_id: mem0UserId, limit: 5 }),
  }).catch(() => null);

  if (tryV1?.ok) {
    const data = await tryV1.json().catch(() => null);
    const list = normalizeMem0SearchResponse(data);
    if (list.length) return list;
  }

  const tryV2 = await fetch("https://api.mem0.ai/v2/memories/search/", {
    method: "POST",
    headers,
    body: JSON.stringify({ query, filters: { user_id: mem0UserId }, top_k: 5 }),
  }).catch(() => null);

  if (tryV2?.ok) {
    const data = await tryV2.json().catch(() => null);
    return normalizeMem0SearchResponse(data);
  }
  return [];
}

export function normalizeMem0SearchResponse(data: unknown): Mem0Memory[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as Mem0Memory[];
  if (typeof data === "object" && data !== null) {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.memories)) return o.memories as Mem0Memory[];
    if (Array.isArray(o.results)) return o.results as Mem0Memory[];
  }
  return [];
}

export function memoryText(memory: Mem0Memory): string {
  const text = memory.memory ?? memory.content ?? memory.text ?? "";
  return typeof text === "string" ? text.trim() : "";
}

export function formatMemoryBlock(memories: Mem0Memory[]): string {
  const top = memories.slice(0, 3).map(memoryText).filter(Boolean);
  if (!top.length) return "";
  const labels = ["Memory", "Preference", "Useful context"];
  return top.map((text, index) => `${labels[index] ?? "Memory"}: ${text}.`).join(" ");
}

export function scheduleMem0Add(mem0UserId: string, messages: ConversationTurn[], apiKey = getMem0ApiKey()): void {
  if (!apiKey || !mem0UserId.trim() || messages.length === 0) return;

  fetch("https://api.mem0.ai/v1/memories/", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ user_id: mem0UserId, messages }),
  }).catch((e) => console.error("[mem0] add error:", e));
}

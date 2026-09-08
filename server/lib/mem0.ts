import type { ConversationTurn } from "./voiceContext.js";

export type Mem0Memory = { memory?: string; content?: string; text?: string };

export type Mem0AddResult = {
  providerMemoryId: string;
};

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

export function extractMem0ProviderMemoryId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const candidates = [
    root.id,
    root.memory_id,
    root.memoryId,
    root.provider_memory_id,
    root.providerMemoryId,
    Array.isArray(root.results) && root.results[0] && typeof root.results[0] === "object"
      ? (root.results[0] as Record<string, unknown>).id
      : null,
    Array.isArray(root.memories) && root.memories[0] && typeof root.memories[0] === "object"
      ? (root.memories[0] as Record<string, unknown>).id
      : null,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export async function addMem0MemoryConfirmed(input: {
  mem0UserId: string;
  messages: ConversationTurn[];
  apiKey?: string;
  idempotencyKey?: string;
}): Promise<Mem0AddResult> {
  const apiKey = input.apiKey ?? getMem0ApiKey();
  const mem0UserId = input.mem0UserId.trim();
  if (!apiKey || !mem0UserId || input.messages.length === 0) {
    throw new Error("mem0_write_not_configured");
  }

  const response = await fetch("https://api.mem0.ai/v1/memories/", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      user_id: mem0UserId,
      messages: input.messages,
      ...(input.idempotencyKey
        ? { metadata: { vyva_idempotency_key: input.idempotencyKey } }
        : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`mem0_write_failed_${response.status}`);
  }
  const data = await response.json().catch(() => null);
  const providerMemoryId = extractMem0ProviderMemoryId(data);
  if (!providerMemoryId) {
    throw new Error("mem0_provider_memory_id_missing");
  }
  return { providerMemoryId };
}

export async function deleteMem0MemoryConfirmed(input: {
  providerMemoryId: string;
  apiKey?: string;
}): Promise<void> {
  const apiKey = input.apiKey ?? getMem0ApiKey();
  const providerMemoryId = input.providerMemoryId.trim();
  if (!apiKey || !providerMemoryId) {
    throw new Error("mem0_delete_not_configured");
  }

  const response = await fetch(
    `https://api.mem0.ai/v1/memories/${encodeURIComponent(providerMemoryId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Token ${apiKey}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`mem0_delete_failed_${response.status}`);
  }
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

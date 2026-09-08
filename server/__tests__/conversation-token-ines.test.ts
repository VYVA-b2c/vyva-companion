import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSocialAgentId } from "../routes/conversationToken";

describe("Inés voice agent resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers the dedicated Inés agent key", () => {
    vi.stubEnv("ELEVENLABS_AGENT_INES", "agent-ines");
    vi.stubEnv("ELEVENLABS_COMPANION_AGENT_ID", "agent-shared");

    const result = resolveSocialAgentId("ines");

    expect(result.agentId).toBe("agent-ines");
    expect(result.expectedKeys?.slice(0, 2)).toEqual([
      "ELEVENLABS_AGENT_INES",
      "ELEVENLABS_BENEFITS_AGENT_ID",
    ]);
  });

  it("retains the shared companion fallback until infra provisions Inés", () => {
    vi.stubEnv("ELEVENLABS_COMPANION_AGENT_ID", "agent-shared");

    expect(resolveSocialAgentId("ines").agentId).toBe("agent-shared");
  });
});

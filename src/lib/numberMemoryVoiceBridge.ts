export type NumberMemoryVoiceToolName =
  | "start_number_memory_round"
  | "get_next_number_memory_digit"
  | "begin_number_memory_recall"
  | "submit_number_memory_answer"
  | "number_memory_not_sure";

export type NumberMemoryVoiceToolResult = {
  ok: boolean;
  code: string;
  activity: "number_memory";
  phase?: string;
  round?: number;
  [key: string]: string | number | boolean | undefined;
};

type NumberMemoryVoiceToolDetail = {
  name: NumberMemoryVoiceToolName;
  parameters: Record<string, unknown>;
  respond: (result: NumberMemoryVoiceToolResult) => void;
};

const EVENT_NAME = "vyva:number-memory-voice-tool";

export function requestNumberMemoryVoiceTool(
  name: NumberMemoryVoiceToolName,
  parameters: Record<string, unknown> = {},
): Promise<NumberMemoryVoiceToolResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({ ok: false, code: "number_memory_unavailable", activity: "number_memory" });
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: NumberMemoryVoiceToolResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(result);
    };
    const timeoutId = window.setTimeout(() => {
      finish({ ok: false, code: "number_memory_inactive", activity: "number_memory" });
    }, 3000);

    window.dispatchEvent(new CustomEvent<NumberMemoryVoiceToolDetail>(EVENT_NAME, {
      detail: { name, parameters, respond: finish },
    }));
  });
}

export function subscribeNumberMemoryVoiceTools(
  handler: (name: NumberMemoryVoiceToolName, parameters: Record<string, unknown>) => NumberMemoryVoiceToolResult,
) {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<NumberMemoryVoiceToolDetail>).detail;
    if (!detail?.name || typeof detail.respond !== "function") return;
    detail.respond(handler(detail.name, detail.parameters ?? {}));
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}

export const VYVA_VOICE_SESSION_STORAGE_KEY = "vyva.voice.sessionId";
export const VYVA_VOICE_SESSION_CHANGED_EVENT = "vyva:voice-session-changed";
export const VYVA_VOICE_TRIAGE_TOUCH_ANSWER_EVENT = "vyva:voice-triage-touch-answer";
export const VYVA_DR_AI_SCREEN_SYNC_REQUEST_EVENT = "vyva:dr-ai-screen-sync-request";
export const VYVA_DR_AI_SCREEN_SYNC_ACK_EVENT = "vyva:dr-ai-screen-sync-ack";
export const VYVA_DR_AI_VITALS_OPEN_EVENT = "vyva:dr-ai-vitals-open";

export type VoiceSessionChangedDetail = {
  sessionId: string | null;
};

export type VoiceTriageTouchAnswerDetail = {
  conversationId: string;
  utterance: string;
  choiceId?: string | null;
  vitalsText?: string | null;
  nextQuestion?: string | null;
  status?: string | null;
};

export type DrAiScreenSyncRequestDetail = {
  requestId: string;
  conversationId: string;
};

export type DrAiScreenSyncAckDetail = DrAiScreenSyncRequestDetail & {
  rendered: boolean;
};

function hasWindow() {
  return typeof window !== "undefined";
}

function safeStorageValue(storage: Storage | undefined, key: string) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorageValue(storage: Storage | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Ignore private-mode or blocked storage.
  }
}

function removeStorageValue(storage: Storage | undefined, key: string) {
  try {
    storage?.removeItem(key);
  } catch {
    // Ignore private-mode or blocked storage.
  }
}

function createVoiceSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emitVoiceSessionChanged(sessionId: string | null) {
  if (!hasWindow()) return;
  window.dispatchEvent(new CustomEvent<VoiceSessionChangedDetail>(VYVA_VOICE_SESSION_CHANGED_EVENT, {
    detail: { sessionId },
  }));
}

export function readVoiceSessionId() {
  if (!hasWindow()) return null;
  return safeStorageValue(window.sessionStorage, VYVA_VOICE_SESSION_STORAGE_KEY)
    || safeStorageValue(window.localStorage, VYVA_VOICE_SESSION_STORAGE_KEY);
}

export function writeVoiceSessionId(sessionId: string) {
  if (!hasWindow()) return;
  writeStorageValue(window.sessionStorage, VYVA_VOICE_SESSION_STORAGE_KEY, sessionId);
  writeStorageValue(window.localStorage, VYVA_VOICE_SESSION_STORAGE_KEY, sessionId);
  emitVoiceSessionChanged(sessionId);
}

export function ensureVoiceSessionId() {
  const existing = readVoiceSessionId();
  if (existing) {
    writeVoiceSessionId(existing);
    return existing;
  }

  const next = createVoiceSessionId();
  writeVoiceSessionId(next);
  return next;
}

export function clearVoiceSessionId() {
  if (!hasWindow()) return;
  removeStorageValue(window.sessionStorage, VYVA_VOICE_SESSION_STORAGE_KEY);
  removeStorageValue(window.localStorage, VYVA_VOICE_SESSION_STORAGE_KEY);
  emitVoiceSessionChanged(null);
}

export function emitVoiceTriageTouchAnswer(detail: VoiceTriageTouchAnswerDetail) {
  if (!hasWindow()) return;
  window.dispatchEvent(new CustomEvent<VoiceTriageTouchAnswerDetail>(VYVA_VOICE_TRIAGE_TOUCH_ANSWER_EVENT, {
    detail,
  }));
}

export function acknowledgeDrAiScreenSync(detail: DrAiScreenSyncAckDetail) {
  if (!hasWindow()) return;
  window.dispatchEvent(new CustomEvent<DrAiScreenSyncAckDetail>(VYVA_DR_AI_SCREEN_SYNC_ACK_EVENT, {
    detail,
  }));
}

export function requestDrAiScreenSync(conversationId: string, timeoutMs = 2500) {
  if (!hasWindow() || !conversationId) return Promise.resolve(false);
  const requestId = createVoiceSessionId();

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (rendered: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener(VYVA_DR_AI_SCREEN_SYNC_ACK_EVENT, handleAck);
      resolve(rendered);
    };
    const handleAck = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as DrAiScreenSyncAckDetail | undefined
        : undefined;
      if (detail?.requestId !== requestId || detail.conversationId !== conversationId) return;
      finish(Boolean(detail.rendered));
    };
    const timeoutId = window.setTimeout(() => finish(false), timeoutMs);
    window.addEventListener(VYVA_DR_AI_SCREEN_SYNC_ACK_EVENT, handleAck);
    window.dispatchEvent(new CustomEvent<DrAiScreenSyncRequestDetail>(VYVA_DR_AI_SCREEN_SYNC_REQUEST_EVENT, {
      detail: { requestId, conversationId },
    }));
  });
}

export function openDrAiVitalsCapture() {
  if (!hasWindow()) return;
  window.dispatchEvent(new CustomEvent(VYVA_DR_AI_VITALS_OPEN_EVENT));
}

import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChefHat,
  HeartHandshake,
  Mic,
  Music2,
  RefreshCw,
  ShieldCheck,
  Square,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/queryClient";
import { BottomSheet } from "@/components/vyva-ui";
import type {
  SocialLanguage,
  SocialShareDropBoxNote,
  SocialShareDropBoxNoteType,
  SocialShareDropBoxPublishResponse,
  SocialShareStoryPrompt,
} from "./types";

type ShareDropBoxSheetProps = {
  language: SocialLanguage;
  onClose: () => void;
  onNavigate: (path: string, options?: { state?: unknown }) => void;
  prompt?: SocialShareStoryPrompt;
};

export type ShareDropBoxCaptureProps = {
  language: SocialLanguage;
  onNavigate: (path: string, options?: { state?: unknown }) => void;
  onClose?: () => void;
  prompt?: SocialShareStoryPrompt;
  initialNoteType?: SocialShareDropBoxNoteType;
  initialTypedMode?: boolean;
  autoStartVoice?: boolean;
  surface?: "sheet" | "page";
  autoNavigateOnPublish?: boolean;
  onSaved?: (note: SocialShareDropBoxNote) => void;
  onPlaced?: (payload: SocialShareDropBoxPublishResponse) => void;
};

type CaptureState = "idle" | "recording" | "transcribing" | "review" | "saving" | "blocked" | "error";

const NOTE_TYPES: Array<{
  id: SocialShareDropBoxNoteType;
  label: string;
  description: string;
  Icon: typeof Mic;
}> = [
  { id: "memory", label: "Memory", description: "A story or moment", Icon: ShieldCheck },
  { id: "song", label: "Song", description: "A song and why it matters", Icon: Music2 },
  { id: "recipe", label: "Recipe", description: "A kitchen note", Icon: ChefHat },
  { id: "reading", label: "Reading", description: "A book or reflection", Icon: BookOpen },
  { id: "hello", label: "Hello", description: "A kind first message", Icon: HeartHandshake },
];

const ROOM_LABELS: Record<string, string> = {
  "memory-lane": "Memory Lane",
  "music-room": "Music Room",
  "kitchen-table": "Kitchen Table",
  "reading-room": "Reading Room",
  "together-room": "Together Room",
};

const SHARE_AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

const MAX_RECORDING_MS = 30_000;

function preferredShareAudioMimeType() {
  const recorder = typeof MediaRecorder === "undefined" ? null : MediaRecorder;
  if (!recorder?.isTypeSupported) return "";
  return SHARE_AUDIO_MIME_TYPES.find((type) => recorder.isTypeSupported(type)) ?? "";
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

async function readApiError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { error?: unknown } | null;
  return typeof body?.error === "string" ? body.error : fallback;
}

function noteTypeLabel(noteType: SocialShareDropBoxNoteType) {
  return NOTE_TYPES.find((item) => item.id === noteType)?.label ?? "Note";
}

function suggestedRoomSlug(noteType: SocialShareDropBoxNoteType) {
  if (noteType === "song") return "music-room";
  if (noteType === "recipe") return "kitchen-table";
  if (noteType === "reading") return "reading-room";
  if (noteType === "hello") return "together-room";
  return "memory-lane";
}

function roomLabel(slug: string) {
  return ROOM_LABELS[slug] ?? slug.replace(/-/g, " ");
}

function canRecordVoice() {
  return (
    typeof navigator !== "undefined"
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && typeof MediaRecorder !== "undefined"
  );
}

function compactPromptMetadata(prompt?: SocialShareStoryPrompt) {
  if (!prompt) return {};
  return {
    promptId: prompt.id,
    promptText: prompt.promptText,
    promptKind: prompt.promptKind,
    connectionGoal: prompt.connectionGoal,
  };
}

function appendPromptMetadata(params: URLSearchParams, prompt?: SocialShareStoryPrompt) {
  const metadata = compactPromptMetadata(prompt);
  Object.entries(metadata).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
}

export function ShareDropBoxCapture({
  language,
  onNavigate,
  prompt,
  initialNoteType,
  initialTypedMode = false,
  autoStartVoice = false,
  surface = "sheet",
  autoNavigateOnPublish = surface !== "page",
  onSaved,
  onPlaced,
}: ShareDropBoxCaptureProps) {
  const [state, setState] = useState<CaptureState>("idle");
  const [noteType, setNoteType] = useState<SocialShareDropBoxNoteType>(prompt?.noteType ?? initialNoteType ?? "memory");
  const [note, setNote] = useState<SocialShareDropBoxNote | null>(null);
  const [editedText, setEditedText] = useState("");
  const [typedText, setTypedText] = useState("");
  const [typedMode, setTypedMode] = useState(initialTypedMode);
  const [error, setError] = useState("");
  const [isPublishing, setPublishing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const stopTimerRef = useRef<number | null>(null);
  const autoStartedRef = useRef(false);

  const isPageSurface = surface === "page";
  const selectedNoteType = noteType;
  const showReview = Boolean(note) && (state === "review" || state === "blocked");
  const showTypePicker = !isPageSurface && (!prompt || showReview);
  const roomName = roomLabel(note?.suggestedRoomSlug ?? suggestedRoomSlug(selectedNoteType));
  const statusText = state === "recording"
    ? "Listening. Tap finish when done."
    : state === "transcribing"
      ? "Saving your voice privately..."
      : state === "review"
        ? "Check the words before placing."
        : state === "blocked"
          ? "Private for now. Please edit before sharing."
          : typedMode
            ? "Write one short note."
            : prompt
              ? prompt.promptText
              : "Say one short note.";

  useEffect(() => () => {
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    stopStream(streamRef.current);
  }, []);

  const resetNote = async () => {
    if (note) {
      await apiFetch(`/api/social/share-dropbox/notes/${note.id}`, { method: "DELETE" }).catch(() => null);
    }
    setNote(null);
    setEditedText("");
    setTypedText("");
    setError("");
    setState("idle");
  };

  const uploadAudio = useCallback(async (blob: Blob, durationMs: number) => {
    setState("transcribing");
    setError("");

    try {
      const params = new URLSearchParams({
        noteType,
        lang: language,
        durationMs: String(Math.min(MAX_RECORDING_MS, Math.max(0, durationMs))),
      });
      appendPromptMetadata(params, prompt);
      const response = await apiFetch(`/api/social/share-dropbox/notes/audio?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob,
      });
      if (!response.ok) throw new Error(await readApiError(response, "Could not save the voice note."));

      const result = (await response.json()) as { note: SocialShareDropBoxNote };
      setNote(result.note);
      setNoteType(result.note.noteType);
      setEditedText(result.note.editedText || result.note.transcript);
      setState(result.note.status === "blocked" ? "blocked" : "review");
      onSaved?.(result.note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the voice note.");
      setState("error");
      setTypedMode(true);
    }
  }, [language, noteType, onSaved, prompt]);

  const startRecording = useCallback(async () => {
    if (!canRecordVoice()) {
      setTypedMode(true);
      setError("Voice recording is not available here. You can type the note instead.");
      return;
    }

    setError("");
    setTypedMode(false);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const mimeType = preferredShareAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError("The recorder stopped unexpectedly. You can try again or type the note.");
        setState("error");
        setTypedMode(true);
        stopStream(streamRef.current);
      };
      recorder.onstop = () => {
        if (stopTimerRef.current) {
          window.clearTimeout(stopTimerRef.current);
          stopTimerRef.current = null;
        }
        stopStream(streamRef.current);
        const durationMs = Date.now() - startedAtRef.current;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        void uploadAudio(blob, durationMs);
      };

      startedAtRef.current = Date.now();
      recorder.start();
      setState("recording");
      stopTimerRef.current = window.setTimeout(() => {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      }, MAX_RECORDING_MS);
    } catch {
      setError("Microphone access was not allowed. You can type the note instead.");
      setTypedMode(true);
      setState("idle");
      stopStream(streamRef.current);
    }
  }, [uploadAudio]);

  useEffect(() => {
    if (!autoStartVoice || autoStartedRef.current || initialTypedMode || typedMode || note || state !== "idle") return;
    autoStartedRef.current = true;
    void startRecording();
  }, [autoStartVoice, initialTypedMode, note, startRecording, state, typedMode]);

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  };

  const saveTypedNote = async () => {
    const text = typedText.trim();
    if (!text) return;

    setState("saving");
    setError("");
    try {
      const response = await apiFetch("/api/social/share-dropbox/notes", {
        method: "POST",
        body: JSON.stringify({
          noteType,
          source: "typed",
          transcript: text,
          editedText: text,
          lang: language,
          ...compactPromptMetadata(prompt),
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Could not save the note."));
      const result = (await response.json()) as { note: SocialShareDropBoxNote };
      setNote(result.note);
      setNoteType(result.note.noteType);
      setEditedText(result.note.editedText || result.note.transcript);
      setState(result.note.status === "blocked" ? "blocked" : "review");
      onSaved?.(result.note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the note.");
      setState("error");
    }
  };

  const saveReviewChanges = async () => {
    if (!note) return null;
    const text = editedText.trim();
    if (!text) return null;
    const promptMetadata = compactPromptMetadata(prompt);
    const promptMatches = !prompt || (
      note.promptId === prompt.id
      && note.promptText === prompt.promptText
      && note.promptKind === prompt.promptKind
      && note.connectionGoal === prompt.connectionGoal
    );
    if (text === note.editedText && selectedNoteType === note.noteType && promptMatches) return note;

    const response = await apiFetch(`/api/social/share-dropbox/notes/${note.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        noteType: selectedNoteType,
        editedText: text,
        lang: language,
        ...promptMetadata,
      }),
    });
    if (!response.ok) throw new Error(await readApiError(response, "Could not update the note."));
    const result = (await response.json()) as { note: SocialShareDropBoxNote };
    setNote(result.note);
    setEditedText(result.note.editedText || result.note.transcript);
    setState(result.note.status === "blocked" ? "blocked" : "review");
    onSaved?.(result.note);
    return result.note;
  };

  const publishNote = async () => {
    if (!note || isPublishing) return;

    setPublishing(true);
    setError("");
    try {
      const updated = await saveReviewChanges();
      const current = updated ?? note;
      const response = await apiFetch(`/api/social/share-dropbox/notes/${current.id}/publish`, {
        method: "POST",
        body: JSON.stringify({ lang: language, editedText: editedText.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as SocialShareDropBoxPublishResponse & { error?: string } | null;
      if (!response.ok) {
        if (payload?.note) {
          setNote(payload.note);
          setEditedText(payload.note.editedText || payload.note.transcript);
          setState("blocked");
        }
        throw new Error(payload?.error || "Could not place this note.");
      }

      if (payload?.note) setNote(payload.note);
      if (payload) onPlaced?.(payload);
      if (!autoNavigateOnPublish) return;

      const handoff = payload?.handoff;
      if (handoff) {
        onNavigate(handoff.path, { state: handoff.state });
        return;
      }
      onNavigate(payload?.roomPath || payload?.connection?.roomPath || current.roomPath || "/social-rooms");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place this note.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div
      data-testid={surface === "page" ? "share-dropbox-capture" : "share-dropbox-sheet"}
      className={isPageSurface ? "w-full min-w-0 rounded-[28px] border border-[#E4D5F8] bg-white p-4 shadow-[0_14px_30px_rgba(67,35,103,0.06)] sm:p-5" : "w-full min-w-0"}
    >
      <div className={isPageSurface ? "min-w-0 rounded-[24px] bg-[#F8F4FF] p-4 text-[#24172F]" : "min-w-0 rounded-[28px] bg-[#2D1F42] p-5 text-white shadow-[0_18px_40px_rgba(45,31,66,0.18)]"}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`font-body text-[12px] font-black uppercase tracking-[0.13em] ${isPageSurface ? "text-[#6D28D9]" : "text-white/70"}`}>
              {showReview ? "Review" : typedMode ? "Type" : state === "recording" ? "Recording" : "Voice note"}
            </p>
            <h3 className={`${isPageSurface ? "font-body text-[22px] font-black leading-tight" : "mt-2 font-display text-[30px] leading-[1.02]"}`}>
              {showReview ? "Check the words" : typedMode ? (prompt?.promptText ?? "Write one short note") : (prompt?.promptText ?? "Say one short note")}
            </h3>
          </div>
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] ${isPageSurface ? "bg-white text-[#6D28D9]" : "bg-white/14"}`}>
            {showReview ? <CheckCircle2 size={28} strokeWidth={2.35} aria-hidden="true" /> : <Mic size={28} strokeWidth={2.35} aria-hidden="true" />}
          </span>
        </div>

        {!isPageSurface ? <div className="mt-5 social-voice-line" aria-hidden="true">
          <span>
            <b />
            <b />
            <b />
            <b />
            <b />
          </span>
        </div> : null}

        <p className={`mt-3 font-body text-[16px] font-semibold leading-snug ${isPageSurface ? "text-[#5B4A68]" : "text-white/86"}`} aria-live="polite">
          {statusText}
        </p>
      </div>

      {state === "recording" ? (
        <button
          type="button"
          onClick={stopRecording}
          data-testid="button-share-dropbox-finish"
          className="mt-4 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-full bg-[#0A7C4E] px-5 font-body text-[18px] font-bold text-white shadow-[0_14px_28px_rgba(10,124,78,0.18)]"
        >
          <Square size={19} strokeWidth={2.4} aria-hidden="true" />
          Finish note
        </button>
      ) : null}

      {showTypePicker ? <section className="mt-5">
        <p className="font-body text-[16px] font-black text-[#24172F]">What kind of note is this?</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {NOTE_TYPES.map((item) => {
            const Icon = item.Icon;
            const active = selectedNoteType === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setNoteType(item.id)}
                aria-label={`${item.label} ${item.description}`}
                aria-pressed={active}
                className={`min-h-[58px] rounded-[18px] border px-4 text-left font-body transition ${
                  active
                    ? "border-[#6D28D9] bg-[#F2EBFF] text-[#6D28D9]"
                    : "border-[#E8DDCF] bg-white text-[#6E5A8A]"
                }`}
              >
                <span className="flex items-center gap-2 text-[15px] font-black">
                  <Icon size={18} strokeWidth={2.4} aria-hidden="true" />
                  {item.label}
                </span>
                <span className="sr-only">{item.description}</span>
              </button>
            );
          })}
        </div>
      </section> : null}

      {typedMode && !showReview ? (
        <section className="mt-5">
          <textarea
            value={typedText}
            onChange={(event) => setTypedText(event.target.value)}
            placeholder="Write the note you want VYVA to place later..."
            rows={5}
            className="min-h-[132px] w-full resize-none rounded-[22px] border border-[#E5D9F0] bg-[#FFFCF7] px-4 py-3 font-body text-[18px] leading-[1.35] text-[#5B4A68] outline-none placeholder:text-[#9A8EA8] focus:border-[#D8C8FB]"
            data-testid="share-dropbox-typed-input"
          />
        </section>
      ) : null}

      {showReview && note ? (
        <section className="mt-5">
          {note.audio ? (
            <div className="mb-4 rounded-[22px] border border-[#D9C7F8] bg-[#FCF9FF] px-4 py-4">
              <p className="mb-3 font-body text-[15px] font-black text-[#4C2C7A]">Private audio playback</p>
              <audio controls src={note.audio.url} className="w-full" data-testid="share-dropbox-audio" />
            </div>
          ) : null}

          <textarea
            value={editedText}
            onChange={(event) => setEditedText(event.target.value)}
            rows={6}
            className="min-h-[154px] w-full resize-none rounded-[22px] border border-[#E5D9F0] bg-[#FFFCF7] px-4 py-3 font-body text-[18px] leading-[1.35] text-[#5B4A68] outline-none placeholder:text-[#9A8EA8] focus:border-[#D8C8FB]"
            data-testid="share-dropbox-review-text"
            aria-label="Edit Share note text"
          />

          <div className="mt-4 rounded-[22px] border border-[#BDEBD8] bg-[#F0FDF7] px-4 py-4">
            <div className="flex items-start gap-3">
              <ShieldCheck size={22} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
              <p className="font-body text-[15px] font-semibold leading-snug text-[#346B5D]">
                Suggested for {roomName}. Audio stays private.
              </p>
            </div>
          </div>

          {state === "blocked" ? (
            <div className="mt-4 rounded-[22px] border border-[#F8D97B] bg-[#FFFBEB] px-4 py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={22} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#B45309]" aria-hidden="true" />
                <p className="font-body text-[15px] font-semibold leading-snug text-[#7C4A03]">
                  This stays private. Try removing private contact details, money, or pressure before sharing.
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void resetNote()}
              className="vyva-tap flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-[#E8DDCF] bg-white px-4 font-body text-[15px] font-bold text-[#6E5A8A]"
            >
              <RefreshCw size={18} strokeWidth={2.4} aria-hidden="true" />
              Re-record
            </button>
            <button
              type="button"
              onClick={() => void resetNote()}
              className="vyva-tap flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-[#F5C2C7] bg-white px-4 font-body text-[15px] font-bold text-[#BE123C]"
            >
              <Trash2 size={18} strokeWidth={2.4} aria-hidden="true" />
              Delete
            </button>
          </div>
        </section>
      ) : null}

      {!typedMode && !showReview && state !== "recording" && state !== "transcribing" ? (
        <button
          type="button"
          onClick={() => {
            setTypedMode(true);
            setError("");
          }}
          className="mt-4 w-full rounded-full border border-[#D9C7F8] bg-white px-4 py-3 font-body text-[15px] font-bold text-[#6D28D9]"
        >
          Type instead
        </button>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-[18px] border border-[#F5C2C7] bg-[#FFF1F2] px-4 py-3 font-body text-[15px] font-bold leading-snug text-[#BE123C]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4">
        {showReview ? (
          <button
            type="button"
            onClick={publishNote}
            disabled={isPublishing || state === "blocked" || !editedText.trim()}
            data-testid="button-share-dropbox-primary"
            className="min-h-[58px] w-full rounded-full bg-[#6D28D9] px-6 font-body text-[18px] font-bold text-white shadow-[0_14px_28px_rgba(109,40,217,0.22)] disabled:bg-[#BDA8E8] disabled:shadow-none"
          >
            {isPublishing ? "Placing..." : isPageSurface ? "Place story" : note?.publishLabel ?? "Place with VYVA"}
          </button>
        ) : typedMode ? (
          <button
            type="button"
            onClick={saveTypedNote}
            disabled={!typedText.trim() || state === "saving"}
            data-testid="button-share-dropbox-save-typed"
            className="min-h-[58px] w-full rounded-full bg-[#6D28D9] px-6 font-body text-[18px] font-bold text-white shadow-[0_14px_28px_rgba(109,40,217,0.22)] disabled:bg-[#BDA8E8] disabled:shadow-none"
          >
            {state === "saving" ? "Saving..." : "Save private note"}
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={state === "recording" || state === "transcribing"}
            data-testid="button-share-dropbox-primary"
            className="min-h-[58px] w-full rounded-full bg-[#6D28D9] px-6 font-body text-[18px] font-bold text-white shadow-[0_14px_28px_rgba(109,40,217,0.22)] disabled:bg-[#BDA8E8] disabled:shadow-none"
          >
            {state === "transcribing" ? "Saving voice..." : "Start voice note"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ShareDropBoxSheet({ language, onClose, onNavigate, prompt }: ShareDropBoxSheetProps) {
  return (
    <BottomSheet
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      closeLabel="Close voice drop box"
      title="Voice Drop Box"
      description="Leave a short private note. VYVA keeps the audio private and places only your edited text."
    >
      <ShareDropBoxCapture
        language={language}
        onNavigate={onNavigate}
        onClose={onClose}
        prompt={prompt}
        surface="sheet"
      />
    </BottomSheet>
  );
}

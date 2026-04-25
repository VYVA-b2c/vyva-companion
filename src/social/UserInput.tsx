import { useState, type RefObject } from "react";
import { Mic, SendHorizonal } from "lucide-react";
import type { LanguageCode } from "@/i18n/languages";
import { useSpeechRecognition } from "@/games/memory/useSpeechRecognition";
import { getSocialCopy } from "./roomUtils";
import type { SocialLanguage } from "./types";

type UserInputProps = {
  language: SocialLanguage;
  onSend: (message: string) => Promise<void> | void;
  disabled?: boolean;
  onVoiceToggle?: () => void;
  voiceStateLabel?: string | null;
  isVoiceModeActive?: boolean;
  isVoiceModeBusy?: boolean;
  hideVoiceButton?: boolean;
  inputRef?: RefObject<HTMLInputElement>;
  simple?: boolean;
};

const UserInput = ({
  language,
  onSend,
  disabled = false,
  onVoiceToggle,
  voiceStateLabel = null,
  isVoiceModeActive = false,
  isVoiceModeBusy = false,
  hideVoiceButton = false,
  inputRef,
  simple = false,
}: UserInputProps) => {
  const copy = getSocialCopy(language);
  const [value, setValue] = useState("");
  const [isSending, setIsSending] = useState(false);

  const { isSupported, isListening, startListening } = useSpeechRecognition({
    language: language as LanguageCode,
    onTranscript: async (transcript) => {
      const trimmed = transcript.trim();
      if (!trimmed) return;
      setValue("");
      setIsSending(true);
      try {
        await onSend(trimmed);
      } finally {
        setIsSending(false);
      }
    },
  });

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isSending) return;
    setValue("");
    setIsSending(true);
    try {
      await onSend(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  const usingExternalVoice = Boolean(onVoiceToggle);
  const micDisabled = usingExternalVoice ? disabled || isVoiceModeBusy : disabled || !isSupported || isSending;
  const statusText = hideVoiceButton ? null : usingExternalVoice ? voiceStateLabel : isListening ? "Te escucho..." : null;

  if (simple) {
    return (
      <div className="rounded-[24px] border border-[#E2D6EE] bg-[#FFFDFC] p-3 shadow-[0_12px_28px_rgba(91,33,182,0.08)]">
        <div className="flex items-center gap-3">
          <label className="flex-1">
            <span className="sr-only">{copy.shareThought}</span>
            <input
              ref={inputRef}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              disabled={disabled || isSending}
              placeholder={copy.writePlaceholder}
              className="h-[66px] w-full rounded-[20px] border border-[#E8DDCF] bg-[#FFFCF7] px-5 font-body text-[22px] text-[#5B4A68] outline-none placeholder:text-[#9A8EA8]"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={disabled || isSending || !value.trim()}
            className="min-h-[66px] rounded-[20px] bg-[#7C3AED] px-6 font-body text-[22px] font-semibold text-white disabled:opacity-50"
            title={copy.send}
          >
            {copy.send}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-[#E8DDCF] bg-[#FFFDFC] p-4 shadow-[0_14px_30px_rgba(91,33,182,0.05)]">
      <div className="flex items-center gap-3">
        {!hideVoiceButton && (
          <button
            type="button"
            onClick={() => {
              if (usingExternalVoice) {
                onVoiceToggle?.();
              } else {
                startListening();
              }
            }}
            disabled={micDisabled}
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-white disabled:opacity-50"
            style={{ background: usingExternalVoice && isVoiceModeActive ? "#0A7C4E" : "#6B3CC7" }}
            title={copy.voiceInput}
          >
            <Mic size={28} />
          </button>
        )}
        <label className="flex-1">
          <span className="sr-only">{copy.shareThought}</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            disabled={disabled || isSending}
            placeholder={copy.writePlaceholder}
            className="h-[72px] w-full rounded-[24px] border border-[#E2D6EE] bg-[#FFFCF7] px-5 font-body text-[22px] text-[#5B4A68] outline-none placeholder:text-[#9A8EA8]"
          />
        </label>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={disabled || isSending || !value.trim()}
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-white disabled:opacity-50"
          style={{ background: "#9A6AF2" }}
          title={copy.send}
        >
          <SendHorizonal size={26} />
        </button>
      </div>
      <div className="mt-3 min-h-[24px] px-2 font-body text-[18px] text-[#8B7D9A]">
        {statusText}
      </div>
    </div>
  );
};

export default UserInput;

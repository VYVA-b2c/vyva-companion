import { useRef } from "react";
import AgentAvatar from "./AgentAvatar";
import { getAgentFirstName, getSocialCopy, getSpeechLangTag } from "./roomUtils";
import { speak } from "./voiceEngine";
import type { SocialLanguage, SocialRoom, SocialTranscriptItem } from "./types";

type AgentBubbleProps = {
  room: SocialRoom;
  message: SocialTranscriptItem;
  language: SocialLanguage;
};

const AgentBubble = ({ room, message, language }: AgentBubbleProps) => {
  const avatarRef = useRef<HTMLButtonElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const copy = getSocialCopy(language);
  const firstName = getAgentFirstName(room.agentFullName);

  const handleSpeak = () => {
    speak(message.text, {
      btn: buttonRef.current,
      avEl: avatarRef.current,
      lang: getSpeechLangTag(language),
    });
  };

  return (
    <div className="rounded-[30px] border border-[#E8DDCF] bg-[#FFFDFC] p-5 shadow-[0_16px_34px_rgba(91,33,182,0.05)]">
      <div className="flex items-start gap-4">
        <AgentAvatar
          ref={avatarRef}
          agentSlug={room.agentSlug}
          fullName={room.agentFullName}
          colour={room.agentColour}
          size={56}
          onClick={handleSpeak}
          title={copy.listenTo(firstName)}
        />
        <div className="flex-1 min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <span className="font-body text-[18px] font-semibold" style={{ color: room.agentColour }}>
              {firstName}
            </span>
            <button
              ref={buttonRef}
              type="button"
              onClick={handleSpeak}
              className="min-h-[64px] rounded-full border border-[#DECBEF] bg-[#F8F3FF] px-5 font-body text-[20px] font-semibold text-[#6B3CC7]"
            >
              {copy.listenTo(firstName)}
            </button>
          </div>
          <p className="font-display italic text-[26px] leading-[1.34] text-[#5A456D]">
            {message.text}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AgentBubble;

import { useRef } from "react";
import AgentAvatar from "./AgentAvatar";
import { formatLiveText, getAgentFirstName, getRoomBadge, getSocialCopy, getSpeechLangTag } from "./roomUtils";
import { speak } from "./voiceEngine";
import type { SocialLanguage, SocialRoom } from "./types";

type RoomCardProps = {
  room: SocialRoom;
  language: SocialLanguage;
  onEnter: (slug: string) => void;
};

const RoomCard = ({ room, language, onEnter }: RoomCardProps) => {
  const firstName = getAgentFirstName(room.agentFullName);
  const avatarRef = useRef<HTMLButtonElement>(null);

  const handleSpeak = () => {
    speak(room.opener, {
      avEl: avatarRef.current,
      lang: getSpeechLangTag(language),
    });
  };

  return (
    <article className="rounded-[30px] border border-[#E8DDCF] bg-[#FFFDFC] p-6 shadow-[0_18px_36px_rgba(91,33,182,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <AgentAvatar
          ref={avatarRef}
          agentSlug={room.agentSlug}
          fullName={room.agentFullName}
          colour={room.agentColour}
          size={36}
          onClick={handleSpeak}
          title={firstName}
        />
        <span className="rounded-full bg-[#F6F0FF] px-4 py-2 font-body text-[18px] font-semibold text-[#5B21B6]">
          {getRoomBadge(room.slug, language)}
        </span>
      </div>

      <p className="mt-4 font-body text-[18px] font-semibold text-[#7C3AED]">
        {formatLiveText(room, language)}
      </p>
      <h3 className="mt-3 font-body text-[24px] font-semibold text-[#5A456D] leading-[1.25]">{room.name}</h3>
      <p className="mt-2 font-body text-[21px] font-semibold" style={{ color: room.agentColour }}>
        {room.agentFullName}
      </p>
      <p className="mt-2 font-body text-[19px] leading-[1.35] text-[#8B7D9A]">
        {room.contentTitle}
      </p>

      <button
        type="button"
        onClick={() => onEnter(room.slug)}
        className="mt-6 w-full min-h-[64px] rounded-full px-6 font-body text-[22px] font-semibold text-white"
        style={{ background: room.agentColour }}
      >
        {room.ctaLabel}
      </button>
    </article>
  );
};

export default RoomCard;

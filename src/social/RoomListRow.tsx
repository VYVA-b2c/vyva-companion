import { useRef } from "react";
import { Mic } from "lucide-react";
import AgentAvatar from "./AgentAvatar";
import { formatLiveText, getAgentFirstName, getRoomBadge, getSocialCopy, getSpeechLangTag } from "./roomUtils";
import { speak } from "./voiceEngine";
import type { SocialLanguage, SocialRoom } from "./types";

type RoomListRowProps = {
  room: SocialRoom;
  language: SocialLanguage;
  onEnter: (slug: string) => void;
};

const RoomListRow = ({ room, language, onEnter }: RoomListRowProps) => {
  const avatarRef = useRef<HTMLButtonElement>(null);
  const copy = getSocialCopy(language);
  const firstName = getAgentFirstName(room.agentFullName);

  const handleSpeak = () => {
    speak(room.opener, {
      avEl: avatarRef.current,
      lang: getSpeechLangTag(language),
    });
  };

  return (
    <article className="rounded-[30px] border border-[#E8DDCF] bg-[#FFFDFC] p-6 shadow-[0_16px_30px_rgba(91,33,182,0.05)]">
      <div className="flex items-start gap-4">
        <AgentAvatar
          ref={avatarRef}
          agentSlug={room.agentSlug}
          fullName={room.agentFullName}
          colour={room.agentColour}
          size={46}
          onClick={handleSpeak}
          title={copy.listenTo(firstName)}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-body text-[24px] font-semibold text-[#5A456D] leading-[1.25]">{room.name}</h3>
            <span className="rounded-full bg-[#F8F3FF] px-4 py-2 font-body text-[18px] font-semibold text-[#6B3CC7]">
              {formatLiveText(room, language)}
            </span>
          </div>
          <p className="mt-2 font-body text-[22px] font-semibold" style={{ color: room.agentColour }}>
            {room.agentFullName}
          </p>
          <p className="mt-1 font-body text-[19px] text-[#8B7D9A]">{room.contentTitle}</p>
          <div className="mt-4">
            <span className="rounded-full border border-[#E8DDCF] bg-[#FFF8EF] px-4 py-2 font-body text-[18px] font-semibold text-[#8B5E34]">
              {getRoomBadge(room.slug, language)}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onEnter(room.slug)}
        className="mt-6 w-full min-h-[64px] rounded-full px-6 font-body text-[22px] font-semibold text-white"
        style={{ background: room.agentColour }}
      >
        {copy.enterRoom(room.ctaLabel)}
      </button>

      <div className="mt-4 flex items-center gap-3 font-body text-[17px] text-[#9A8EA8]">
        <Mic size={18} />
        <span>{copy.tapAvatarHint(firstName)}</span>
      </div>
    </article>
  );
};

export default RoomListRow;

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AgentAvatar from "./AgentAvatar";
import { getAgentFirstName, getRoomBadge, getSocialCopy, getSpeechLangTag } from "./roomUtils";
import { speak } from "./voiceEngine";
import type { SocialLanguage, SocialRoom } from "./types";

type HeroCarouselProps = {
  rooms: SocialRoom[];
  language: SocialLanguage;
  onEnter: (slug: string) => void;
};

const HeroCarousel = ({ rooms, language, onEnter }: HeroCarouselProps) => {
  const [index, setIndex] = useState(0);
  const pauseUntilRef = useRef<number>(0);
  const avatarRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const copy = getSocialCopy(language);

  useEffect(() => {
    if (rooms.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      if (Date.now() < pauseUntilRef.current) return;
      setIndex((value) => (value + 1) % rooms.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [rooms.length]);

  useEffect(() => {
    if (index >= rooms.length) setIndex(0);
  }, [index, rooms.length]);

  const pauseCarousel = () => {
    pauseUntilRef.current = Date.now() + 9000;
  };

  if (!rooms.length) return null;

  const room = rooms[index];
  const firstName = getAgentFirstName(room.agentFullName);

  return (
    <div>
      <div className="relative overflow-hidden rounded-[34px]">
        <section
          className="px-6 py-6"
          style={{ background: room.agentColour }}
        >
          <div className="flex items-center justify-between gap-3 text-white/95">
            <span className="rounded-full bg-white/16 px-4 py-2 font-body text-[18px] font-semibold">
              ● {room.participantCount} {language === "en" ? "inside" : language === "de" ? "drin" : "dentro"}
            </span>
            <span className="rounded-full bg-white/12 px-4 py-2 font-body text-[18px] font-semibold">
              {getRoomBadge(room.slug, language)}
            </span>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <AgentAvatar
              ref={(element) => {
                avatarRefs.current[index] = element;
              }}
              agentSlug={room.agentSlug}
              fullName={room.agentFullName}
              colour={room.agentColour}
              size={54}
              borderMode="dark"
              onClick={() => {
                pauseCarousel();
                speak(room.opener, {
                  avEl: avatarRefs.current[index],
                  lang: getSpeechLangTag(language),
                });
              }}
              title={copy.listenTo(firstName)}
            />
            <div className="min-w-0">
              <p className="font-body text-[24px] font-semibold text-white">{room.agentFullName}</p>
            </div>
          </div>

          <h3 className="mt-6 font-display text-[34px] leading-[1.18] text-white">{room.topic}</h3>
          <p
            className="mt-3 max-w-[34rem] font-body text-[21px] leading-[1.38]"
            style={{ color: "rgba(255,255,255,0.92)" }}
          >
            {room.contentTitle}
          </p>

          <button
            type="button"
            onClick={() => onEnter(room.slug)}
            className="mt-6 w-full min-h-[68px] rounded-full bg-white px-6 font-body text-[22px] font-semibold"
            style={{ color: room.agentColour }}
          >
            {room.ctaLabel}
          </button>
        </section>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              pauseCarousel();
              setIndex((value) => (value - 1 + rooms.length) % rooms.length);
            }}
            className="w-[64px] h-[64px] rounded-full border border-[#D9CCFF] bg-white flex items-center justify-center text-[#5B21B6]"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            type="button"
            onClick={() => {
              pauseCarousel();
              setIndex((value) => (value + 1) % rooms.length);
            }}
            className="w-[64px] h-[64px] rounded-full border border-[#D9CCFF] bg-white flex items-center justify-center text-[#5B21B6]"
          >
            <ChevronRight size={28} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {rooms.map((room, roomIndex) => (
            <button
              key={room.slug}
              type="button"
              onClick={() => {
                pauseCarousel();
                setIndex(roomIndex);
              }}
              className="rounded-full transition-all"
              style={{
                width: roomIndex === index ? 28 : 12,
                height: 12,
                background: roomIndex === index ? "#5B21B6" : "#D8C8FB",
              }}
              aria-label={`Slide ${roomIndex + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroCarousel;

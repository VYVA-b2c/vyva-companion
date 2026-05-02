import { Users, Volume2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/contexts/ProfileContext";
import AgentAvatar from "./AgentAvatar";
import SocialStyles from "./SocialStyles";
import {
  filterRoomsByCategory,
  formatLiveText,
  getAgentFirstName,
  getRoomBadge,
  getRoomPickerName,
  getSocialCopy,
  getSocialLanguage,
  getSpeechLangTag,
} from "./roomUtils";
import type { SocialHubResponse, SocialLanguage, SocialRoom, SocialRoomCategory } from "./types";
import { speak } from "./voiceEngine";

type RoomPickerTileProps = {
  room: SocialRoom;
  language: SocialLanguage;
  onSelect: (room: SocialRoom) => void;
};

function RoomPickerTile({ room, language, onSelect }: RoomPickerTileProps) {
  const topic = room.contentTitle || room.topic;
  const pickerName = getRoomPickerName(room.slug, language, room.name);
  const participantLabel = room.participantCount.toLocaleString(language);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(room)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(room);
        }
      }}
      className="min-h-[188px] cursor-pointer overflow-hidden rounded-[28px] border border-[#E6DCCF] bg-white p-4 shadow-[0_18px_42px_rgba(45,31,66,0.08)] transition-transform active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <AgentAvatar
          agentSlug={room.agentSlug}
          fullName={room.agentFullName}
          colour={room.agentColour}
          size={54}
          title={room.agentFullName}
        />
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F7F2FF] px-2.5 py-1.5 font-body text-[14px] font-bold text-[#6D28D9]">
          <Users size={17} />
          {participantLabel}
        </span>
      </div>

      <h2
        className="mt-5 min-w-0 overflow-hidden break-words font-body text-[21px] font-bold leading-[1.12] text-[#24172F]"
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
        }}
      >
        {pickerName}
      </h2>
      <p
        className="mt-2 min-w-0 overflow-hidden break-words font-body text-[16px] leading-[1.3] text-[#7A677F]"
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
        }}
      >
        {topic}
      </p>
    </article>
  );
}

type RoomDetailSheetProps = {
  room: SocialRoom;
  language: SocialLanguage;
  onClose: () => void;
  onEnter: (slug: string) => void;
};

function RoomDetailSheet({ room, language, onClose, onEnter }: RoomDetailSheetProps) {
  const copy = getSocialCopy(language);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const firstName = getAgentFirstName(room.agentFullName);
  const description = room.contentBody || room.opener || room.topic;

  const handleListen = () => {
    speak(room.opener || room.topic, {
      avEl: avatarRef.current,
      lang: getSpeechLangTag(language),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-[rgba(45,31,66,0.35)] px-3 pb-3 md:items-center md:justify-center md:p-6"
      onClick={onClose}
    >
      <section
        className="w-full max-w-[620px] rounded-t-[38px] border border-[#E6DCCF] bg-[#FFFCF8] p-6 shadow-[0_26px_70px_rgba(45,31,66,0.22)] md:rounded-[38px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <AgentAvatar
            ref={avatarRef}
            agentSlug={room.agentSlug}
            fullName={room.agentFullName}
            colour={room.agentColour}
            size={76}
            title={copy.listenTo(firstName)}
            onClick={handleListen}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.closeDetails}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F4EEE7] text-[#7A677F]"
          >
            <X size={24} />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[#F2EBFF] px-4 py-2 font-body text-[17px] font-semibold text-[#6D28D9]">
            {getRoomBadge(room.slug, language)}
          </span>
          <span className="rounded-full bg-white px-4 py-2 font-body text-[17px] font-semibold text-[#6E5A8A]">
            {formatLiveText(room, language)}
          </span>
        </div>

        <h2 className="mt-5 font-display text-[38px] leading-[1.02] text-[#24172F]">
          {room.name}
        </h2>
        <p className="mt-2 font-body text-[22px] font-semibold text-[#5D4777]">
          {room.agentFullName}
        </p>
        <p className="mt-1 font-body text-[18px] text-[#7A677F]">
          {room.agentCredential}
        </p>

        <div className="mt-5 rounded-[26px] bg-white p-5">
          <p className="font-body text-[16px] font-bold uppercase tracking-[0.16em] text-[#6D28D9]">
            {copy.topicLabel}
          </p>
          <p className="mt-2 font-body text-[22px] leading-[1.35] text-[#24172F]">
            {room.topic}
          </p>
          <p className="mt-3 font-body text-[18px] leading-[1.45] text-[#7A677F]">
            {description}
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
          <button
            type="button"
            onClick={() => onEnter(room.slug)}
            className="min-h-[64px] rounded-full bg-[#6D28D9] px-6 font-body text-[21px] font-bold text-white shadow-[0_14px_28px_rgba(109,40,217,0.22)]"
          >
            {copy.enterSelectedRoom}
          </button>
          <button
            type="button"
            onClick={handleListen}
            className="min-h-[64px] rounded-full border border-[#D8C8FB] bg-white px-6 font-body text-[19px] font-bold text-[#6D28D9]"
          >
            <span className="inline-flex items-center gap-2">
              <Volume2 size={22} />
              {copy.listenWelcome}
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}

const SocialHub = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const language = getSocialLanguage(profile?.language);
  const copy = getSocialCopy(language);
  const [category, setCategory] = useState<"all" | SocialRoomCategory>("all");
  const [selectedRoomSlug, setSelectedRoomSlug] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<SocialHubResponse>({
    queryKey: [`/api/social/hub?lang=${language}`],
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const hubRooms = useMemo(() => data?.listRooms ?? [], [data?.listRooms]);
  const filteredRooms = useMemo(
    () => filterRoomsByCategory(hubRooms, category),
    [category, hubRooms],
  );
  const selectedRoom = useMemo(
    () => hubRooms.find((room) => room.slug === selectedRoomSlug) ?? null,
    [hubRooms, selectedRoomSlug],
  );

  const filters: Array<"all" | SocialRoomCategory> = ["all", "activity", "social", "useful", "connection"];

  return (
    <div className="px-5 pb-10">
      <SocialStyles />

      <header className="pt-6">
        <p className="font-body text-[18px] tracking-[0.28em] text-[#8E7FAA]">{copy.dayLabel}</p>
        <h1 className="mt-3 font-display text-[42px] leading-[1.06] text-[#2D1F42]">
          {copy.chooseRoom}
        </h1>
        <p className="mt-3 font-body text-[21px] leading-[1.4] text-[#6E5A8A]">
          {copy.chooseRoomSubtitle}
        </p>
      </header>

      <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
        {filters.map((value) => {
          const active = value === category;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className="min-h-[58px] whitespace-nowrap rounded-full px-5 font-body text-[19px] font-semibold"
              style={
                active
                  ? { background: "#5B21B6", color: "#FFFFFF" }
                  : { background: "#FFFFFF", color: "#5B21B6", border: "1px solid #D8C8FB" }
              }
            >
              {copy.filters[value]}
            </button>
          );
        })}
      </div>

      <main className="mt-6">
        {isLoading && (
          <div className="rounded-[28px] bg-white p-6 font-body text-[22px] text-[#6E5A8A]">
            ...
          </div>
        )}

        {isError && !filteredRooms.length && (
          <div className="rounded-[28px] bg-white p-6 font-body text-[22px] text-[#6E5A8A]">
            {copy.noRooms}
          </div>
        )}

        {!isLoading && !isError && !filteredRooms.length && (
          <div className="rounded-[28px] bg-white p-6 font-body text-[22px] text-[#6E5A8A]">
            {copy.noRooms}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {filteredRooms.map((room) => (
            <RoomPickerTile
              key={room.slug}
              room={room}
              language={language}
              onSelect={(nextRoom) => setSelectedRoomSlug(nextRoom.slug)}
            />
          ))}
        </div>
      </main>

      {selectedRoom && (
        <RoomDetailSheet
          room={selectedRoom}
          language={language}
          onClose={() => setSelectedRoomSlug(null)}
          onEnter={(slug) => navigate(`/social-rooms/${slug}`)}
        />
      )}
    </div>
  );
};

export default SocialHub;

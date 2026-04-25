import { Bell } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/contexts/ProfileContext";
import SocialStyles from "./SocialStyles";
import HeroCarousel from "./HeroCarousel";
import RoomCard from "./RoomCard";
import RoomListRow from "./RoomListRow";
import { filterRoomsByCategory, getGreeting, getSocialCopy, getSocialLanguage, sortHeroRooms } from "./roomUtils";
import type { SocialHubResponse, SocialRoomCategory } from "./types";

const SocialHub = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const language = getSocialLanguage(profile?.language);
  const copy = getSocialCopy(language);
  const [category, setCategory] = useState<"all" | SocialRoomCategory>("all");

  const { data, isLoading, isError } = useQuery<SocialHubResponse>({
    queryKey: [`/api/social/hub?lang=${language}`],
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const filteredRooms = useMemo(
    () => filterRoomsByCategory(data?.listRooms ?? [], category),
    [category, data?.listRooms],
  );

  const heroRooms = useMemo(
    () => sortHeroRooms(filterRoomsByCategory(data?.heroRooms ?? [], category)).slice(0, 6),
    [category, data?.heroRooms],
  );

  const alsoForYou = useMemo(
    () => filterRoomsByCategory(data?.alsoForYou ?? [], category),
    [category, data?.alsoForYou],
  );

  const filters: Array<"all" | SocialRoomCategory> = ["all", "activity", "social", "useful", "connection"];

  return (
    <div className="px-6 pb-10">
      <SocialStyles />

      <header className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-body text-[18px] tracking-[0.28em] text-[#8E7FAA]">{copy.dayLabel}</p>
            <h1 className="mt-3 font-display text-[38px] leading-[1.12] text-[#2D1F42]">
              {getGreeting(language, data?.user.firstName ?? profile?.firstName)}
            </h1>
          </div>
          <button
            type="button"
            className="w-[64px] h-[64px] rounded-full border border-[#D9CCFF] bg-white flex items-center justify-center text-[#5B21B6] shadow-[0_10px_24px_rgba(91,33,182,0.08)]"
          >
            <Bell size={28} />
          </button>
        </div>
        <p className="mt-4 font-body text-[22px] text-[#6E5A8A]">
          {copy.subline(data?.activeCount ?? 0)}
        </p>
      </header>

      <div className="mt-6 flex gap-3 overflow-x-auto pb-1">
        {filters.map((value) => {
          const active = value === category;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className="min-h-[64px] whitespace-nowrap rounded-full px-6 font-body text-[22px] font-semibold"
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

      <section className="mt-8">
        <h2 className="font-display text-[34px] text-[#2D1F42]">{copy.featuredNow}</h2>
        <div className="mt-4">
          <HeroCarousel
            rooms={heroRooms}
            language={language}
            onEnter={(slug) => navigate(`/social-rooms/${slug}`)}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-[34px] text-[#2D1F42]">{copy.alsoForYou}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {(alsoForYou.length ? alsoForYou : filteredRooms.slice(0, 4)).map((room) => (
            <RoomCard
              key={room.slug}
              room={room}
              language={language}
              onEnter={(slug) => navigate(`/social-rooms/${slug}`)}
            />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-[34px] text-[#2D1F42]">{copy.allRooms}</h2>
        <div className="mt-4 space-y-4">
          {isLoading && (
            <div className="rounded-[28px] bg-white p-6 font-body text-[22px] text-[#6E5A8A]">
              Cargando…
            </div>
          )}
          {isError && (
            <div className="rounded-[28px] bg-white p-6 font-body text-[22px] text-[#6E5A8A]">
              {copy.noRooms}
            </div>
          )}
          {!isLoading && !filteredRooms.length && (
            <div className="rounded-[28px] bg-white p-6 font-body text-[22px] text-[#6E5A8A]">
              {copy.noRooms}
            </div>
          )}
          {filteredRooms.map((room) => (
            <RoomListRow
              key={room.slug}
              room={room}
              language={language}
              onEnter={(slug) => navigate(`/social-rooms/${slug}`)}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

export default SocialHub;


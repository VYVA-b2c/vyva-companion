import { forwardRef } from "react";
import { AGENT_PERSONAS, type AgentGlyph } from "./agentPersonas";

type AgentAvatarProps = {
  agentSlug: string;
  fullName: string;
  colour: string;
  size?: number;
  borderMode?: "light" | "dark";
  onClick?: () => void;
  className?: string;
  title?: string;
};

function GlyphIcon({ glyph, colour }: { glyph: AgentGlyph; colour: string }) {
  switch (glyph) {
    case "leaf":
      return (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 14c4-8 10-9 12-9 0 3-1 9-9 12" />
          <path d="M6 18c1-2 3-4 5-5" />
        </svg>
      );
    case "chess":
      return (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round">
          <path d="M7 8h10" />
          <path d="M6 13h12" />
        </svg>
      );
    case "pot":
      return (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 10h12" />
          <path d="M8 10c0 5 2 8 4 8s4-3 4-8" />
          <path d="M9 8a3 3 0 0 1 6 0" />
        </svg>
      );
    case "voice":
      return (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 6a3 3 0 0 1 3 3v3a3 3 0 1 1-6 0V9a3 3 0 0 1 3-3Z" />
          <path d="M7 11a5 5 0 0 0 10 0" />
        </svg>
      );
    case "figure":
      return (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="6" r="2.2" />
          <path d="M12 8.5v5" />
          <path d="M8 20l4-6 4 6" />
        </svg>
      );
    case "moon":
      return (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 14A7 7 0 0 1 10 7a7 7 0 1 0 7 7Z" />
        </svg>
      );
    case "book":
      return (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 6h6a3 3 0 0 1 3 3v9H9a3 3 0 0 0-3 3Z" />
          <path d="M18 6h-6a3 3 0 0 0-3 3v9h6a3 3 0 0 1 3 3Z" />
        </svg>
      );
    case "palette":
      return (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4a8 8 0 1 0 0 16h1a2 2 0 0 0 0-4h-1" />
          <circle cx="8" cy="10" r="1" fill={colour} stroke="none" />
          <circle cx="12" cy="8" r="1" fill={colour} stroke="none" />
          <circle cx="16" cy="10" r="1" fill={colour} stroke="none" />
        </svg>
      );
    case "news":
      return (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 7h10v10H6z" />
          <path d="M9 10h4" />
          <path d="M9 13h4" />
        </svg>
      );
    case "music":
      return (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V6l9-2v12" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="16" cy="16" r="2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4v4" />
          <path d="M18 12h-4" />
          <path d="M12 20v-4" />
          <path d="M6 12h4" />
        </svg>
      );
  }
}

const AgentAvatar = forwardRef<HTMLButtonElement, AgentAvatarProps>(function AgentAvatar(
  {
    agentSlug,
    fullName,
    colour,
    size = 54,
    borderMode = "light",
    onClick,
    className = "",
    title,
  },
  ref,
) {
  const persona = AGENT_PERSONAS[agentSlug] ?? AGENT_PERSONAS.vyva;
  const border =
    borderMode === "dark"
      ? "2.5px solid rgba(255,255,255,0.32)"
      : "2px solid #EDE9FE";
  const centerGlyphSize = Math.max(22, Math.round(size * 0.42));

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title ?? fullName}
      className={`relative rounded-full flex items-center justify-center transition-transform active:scale-[0.98] ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        className="social-avatar-core absolute inset-0 rounded-full flex items-center justify-center"
        style={{ background: colour, border }}
      >
        <span
          style={{
            width: centerGlyphSize,
            height: centerGlyphSize,
          }}
        >
          <GlyphIcon glyph={persona.glyph} colour="#FFFFFF" />
        </span>
      </span>
    </button>
  );
});

export default AgentAvatar;

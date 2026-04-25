const SocialStyles = () => (
  <style>{`
    @keyframes speakPulse {
      0% { box-shadow: 0 0 0 0 rgba(91,33,182,0.42); }
      70% { box-shadow: 0 0 0 14px rgba(91,33,182,0); }
      100% { box-shadow: 0 0 0 0 rgba(91,33,182,0); }
    }
    .av-speaking .social-avatar-core {
      animation: speakPulse 1.6s ease-out infinite;
    }
    .social-wave {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      height: 18px;
    }
    .social-wave b {
      display: block;
      width: 4px;
      border-radius: 999px;
      background: currentColor;
      animation: socialWave 0.9s ease-in-out infinite;
    }
    .social-wave b:nth-child(1) { height: 8px; animation-delay: 0s; }
    .social-wave b:nth-child(2) { height: 14px; animation-delay: 0.08s; }
    .social-wave b:nth-child(3) { height: 18px; animation-delay: 0.16s; }
    .social-wave b:nth-child(4) { height: 12px; animation-delay: 0.24s; }
    .social-wave b:nth-child(5) { height: 9px; animation-delay: 0.32s; }
    .social-mini-wave {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      height: 14px;
      color: inherit;
    }
    .social-mini-wave b {
      display: block;
      width: 3px;
      border-radius: 999px;
      background: currentColor;
      animation: socialWave 0.95s ease-in-out infinite;
    }
    .social-mini-wave b:nth-child(1) { height: 6px; animation-delay: 0s; }
    .social-mini-wave b:nth-child(2) { height: 11px; animation-delay: 0.08s; }
    .social-mini-wave b:nth-child(3) { height: 14px; animation-delay: 0.16s; }
    .social-mini-wave b:nth-child(4) { height: 9px; animation-delay: 0.24s; }
    .social-presence-dot,
    .social-thinking-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: currentColor;
      flex-shrink: 0;
    }
    .social-thinking-dot {
      animation: socialPresencePulse 1.4s ease-in-out infinite;
      opacity: 0.82;
    }
    @keyframes socialWave {
      0%, 100% { transform: scaleY(0.65); opacity: 0.65; }
      50% { transform: scaleY(1); opacity: 1; }
    }
    @keyframes socialPresencePulse {
      0%, 100% { transform: scale(0.88); opacity: 0.45; }
      50% { transform: scale(1.06); opacity: 0.95; }
    }
    .social-speaker-pill {
      transition: box-shadow 180ms ease, background 180ms ease, border-color 180ms ease, transform 180ms ease;
    }
    .social-speaker-pill.active {
      box-shadow: 0 12px 28px rgba(91,33,182,0.12);
      transform: translateY(-1px);
    }
    .social-speaker-avatar {
      transition: box-shadow 180ms ease, transform 180ms ease, border-color 180ms ease;
    }
    .social-speaker-avatar.active {
      transform: scale(1.03);
      box-shadow: 0 0 0 4px rgba(124,58,237,0.12);
    }
    .social-voice-line {
      position: relative;
      overflow: hidden;
      height: 44px;
      border-radius: 999px;
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.18);
    }
    .social-voice-line::before,
    .social-voice-line::after {
      content: "";
      position: absolute;
      inset: 50% -10% auto -10%;
      height: 2px;
      border-radius: 999px;
      background: rgba(255,255,255,0.75);
      transform-origin: center;
    }
    .social-voice-line::before {
      animation: socialVoiceFlow 2.4s ease-in-out infinite;
    }
    .social-voice-line::after {
      background: rgba(255,255,255,0.45);
      animation: socialVoiceFlowAlt 2.8s ease-in-out infinite;
    }
    .social-voice-line span {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    .social-voice-line span b {
      width: 4px;
      border-radius: 999px;
      background: #ffffff;
      animation: socialVoiceBars 1s ease-in-out infinite;
      opacity: 0.92;
    }
    .social-voice-line span b:nth-child(1) { height: 10px; animation-delay: 0s; }
    .social-voice-line span b:nth-child(2) { height: 18px; animation-delay: 0.08s; }
    .social-voice-line span b:nth-child(3) { height: 24px; animation-delay: 0.16s; }
    .social-voice-line span b:nth-child(4) { height: 16px; animation-delay: 0.24s; }
    .social-voice-line span b:nth-child(5) { height: 10px; animation-delay: 0.32s; }
    @keyframes socialVoiceFlow {
      0%, 100% { transform: translateY(-50%) scaleX(1) scaleY(0.8); opacity: 0.28; }
      50% { transform: translateY(-50%) scaleX(1.04) scaleY(2.4); opacity: 0.78; }
    }
    @keyframes socialVoiceFlowAlt {
      0%, 100% { transform: translateY(-50%) scaleX(1) scaleY(1.7); opacity: 0.22; }
      50% { transform: translateY(-50%) scaleX(0.98) scaleY(0.6); opacity: 0.6; }
    }
    @keyframes socialVoiceBars {
      0%, 100% { transform: scaleY(0.55); opacity: 0.55; }
      50% { transform: scaleY(1.08); opacity: 1; }
    }
  `}</style>
);

export default SocialStyles;

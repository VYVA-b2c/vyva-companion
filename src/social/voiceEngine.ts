const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

let activeBtn: HTMLElement | null = null;
let activeAvatar: HTMLElement | null = null;
let activeOnEnd: (() => void) | null = null;

function renderWave() {
  return '<span class="sr-only">Speaking</span><span class="social-wave" aria-hidden="true"><b></b><b></b><b></b><b></b><b></b></span>';
}

function resetUi() {
  if (activeBtn) {
    activeBtn.classList.remove("live");
    activeBtn.innerHTML = activeBtn.dataset.origLabel ?? activeBtn.innerHTML;
  }
  if (activeAvatar) {
    activeAvatar.classList.remove("av-speaking");
  }
  if (activeOnEnd) {
    activeOnEnd();
  }
  activeBtn = null;
  activeAvatar = null;
  activeOnEnd = null;
}

export function stopSpeaking() {
  if (synth?.speaking) {
    synth.cancel();
  }
  resetUi();
}

export function speak(
  text: string,
  {
    btn = null,
    avEl = null,
    lang = "es-ES",
    rate = 0.88,
    pitch = 1.05,
    onStart,
    onEnd,
  }: {
    btn?: HTMLElement | null;
    avEl?: HTMLElement | null;
    lang?: string;
    rate?: number;
    pitch?: number;
    onStart?: () => void;
    onEnd?: () => void;
  } = {},
) {
  if (!synth) return;
  if (!text.trim()) return;

  if (synth.speaking) synth.cancel();
  resetUi();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  utterance.pitch = pitch;

  const voices = synth.getVoices();
  const voice = voices.find((entry) => entry.lang.startsWith(lang.split("-")[0]));
  if (voice) utterance.voice = voice;

  utterance.onstart = () => {
    activeOnEnd = onEnd ?? null;
    if (btn) {
      if (!btn.dataset.origLabel) btn.dataset.origLabel = btn.innerHTML;
      btn.classList.add("live");
      btn.innerHTML = renderWave();
      activeBtn = btn;
    }
    if (avEl) {
      avEl.classList.add("av-speaking");
      activeAvatar = avEl;
    }
    onStart?.();
  };

  utterance.onend = resetUi;
  utterance.onerror = resetUi;

  synth.speak(utterance);
}

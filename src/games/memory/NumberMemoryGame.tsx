import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Delete, RotateCcw } from "lucide-react";
import type { LanguageCode } from "@/i18n/languages";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { cn } from "@/lib/utils";
import {
  subscribeNumberMemoryVoiceTools,
  type NumberMemoryVoiceToolResult,
} from "@/lib/numberMemoryVoiceBridge";
import BrainGameCompletionDialog from "../shared/BrainGameCompletionDialog";
import { saveGameResult } from "./gameStorage";
import {
  getNumberMemoryExpectedAnswer,
  NUMBER_MEMORY_MAX_LEVEL,
  scoreNumberMemoryRounds,
  type NumberMemoryMode,
  type NumberMemoryPayload,
} from "./numberMemoryData";
import type { CognitiveDomain, MemoryGameVariantContent, Recommendation } from "./types";

type Phase = "guidance" | "ready" | "countdown" | "presentation" | "recall" | "review" | "complete";

type NumberMemoryGameProps = {
  plan: Recommendation;
  localizedVariant: MemoryGameVariantContent;
  cognitiveDomain: CognitiveDomain;
  userId: string;
  language: LanguageCode;
  onBack: () => void;
  onOpenSameGame: (levelOverride?: number) => void | Promise<void>;
  actionLoading: "recommended" | "repeat" | "nextLevel" | null;
  voiceConnected?: boolean;
  onVoiceContextChange?: (context: Record<string, string | number | boolean>) => void;
};

type Copy = {
  level: string; round: string; of: string; showNumbers: string; ready: string; enterAnswer: string;
  forward: string; reverse: string; ascending: string; forwardGuide: string; reverseGuide: string; ascendingGuide: string;
  forwardExample: string; reverseExample: string; ascendingExample: string; begin: string; delete: string; clear: string;
  submit: string; notSure: string; review: string; expected: string; yourAnswer: string; noAnswer: string;
  seeResults: string; complete: string; passed: string; keepPractising: string; exactRounds: string; accuracy: string;
  time: string; nextLevel: string; tryAgain: string; moreActivities: string; voiceOn: string;
};

const COPY: Record<LanguageCode, Copy> = {
  en: { level: "Level", round: "Round", of: "of", showNumbers: "Show numbers", ready: "Ready", enterAnswer: "Enter your answer", forward: "Same order", reverse: "Reverse order", ascending: "Lowest to highest", forwardGuide: "Watch or listen, then repeat the numbers in the same order.", reverseGuide: "Watch or listen, then repeat the numbers in reverse order.", ascendingGuide: "Watch or listen, then give the numbers from lowest to highest.", forwardExample: "Example: 4  ·  7  ·  2  →  4 7 2", reverseExample: "Example: 4  ·  7  ·  2  →  2 7 4", ascendingExample: "Example: 4  ·  7  ·  2  →  2 4 7", begin: "Continue", delete: "Delete", clear: "Clear", submit: "Submit", notSure: "I’m not sure", review: "Review", expected: "Expected", yourAnswer: "Your answer", noAnswer: "Not sure", seeResults: "See results", complete: "Number Memory complete", passed: "Level complete", keepPractising: "Keep practising", exactRounds: "Exact rounds", accuracy: "Accuracy", time: "Time", nextLevel: "Next level", tryAgain: "Try again", moreActivities: "More activities", voiceOn: "Voice play on" },
  es: { level: "Nivel", round: "Ronda", of: "de", showNumbers: "Mostrar números", ready: "Prepárate", enterAnswer: "Introduce tu respuesta", forward: "Mismo orden", reverse: "Orden inverso", ascending: "De menor a mayor", forwardGuide: "Mira o escucha y repite los números en el mismo orden.", reverseGuide: "Mira o escucha y repite los números en orden inverso.", ascendingGuide: "Mira o escucha y di los números de menor a mayor.", forwardExample: "Ejemplo: 4  ·  7  ·  2  →  4 7 2", reverseExample: "Ejemplo: 4  ·  7  ·  2  →  2 7 4", ascendingExample: "Ejemplo: 4  ·  7  ·  2  →  2 4 7", begin: "Continuar", delete: "Borrar", clear: "Limpiar", submit: "Enviar", notSure: "No estoy seguro", review: "Revisión", expected: "Esperado", yourAnswer: "Tu respuesta", noAnswer: "No estoy seguro", seeResults: "Ver resultados", complete: "Memoria de números completada", passed: "Nivel completado", keepPractising: "Sigue practicando", exactRounds: "Rondas exactas", accuracy: "Precisión", time: "Tiempo", nextLevel: "Siguiente nivel", tryAgain: "Intentar de nuevo", moreActivities: "Más actividades", voiceOn: "Modo de voz activo" },
  fr: { level: "Niveau", round: "Manche", of: "sur", showNumbers: "Afficher les nombres", ready: "Prêt", enterAnswer: "Saisissez votre réponse", forward: "Même ordre", reverse: "Ordre inverse", ascending: "Du plus petit au plus grand", forwardGuide: "Regardez ou écoutez, puis répétez les nombres dans le même ordre.", reverseGuide: "Regardez ou écoutez, puis répétez les nombres dans l’ordre inverse.", ascendingGuide: "Regardez ou écoutez, puis donnez les nombres du plus petit au plus grand.", forwardExample: "Exemple : 4  ·  7  ·  2  →  4 7 2", reverseExample: "Exemple : 4  ·  7  ·  2  →  2 7 4", ascendingExample: "Exemple : 4  ·  7  ·  2  →  2 4 7", begin: "Continuer", delete: "Effacer", clear: "Vider", submit: "Valider", notSure: "Je ne sais pas", review: "Révision", expected: "Attendu", yourAnswer: "Votre réponse", noAnswer: "Je ne sais pas", seeResults: "Voir les résultats", complete: "Mémoire des nombres terminée", passed: "Niveau terminé", keepPractising: "Continuez à vous entraîner", exactRounds: "Manches exactes", accuracy: "Précision", time: "Temps", nextLevel: "Niveau suivant", tryAgain: "Réessayer", moreActivities: "Plus d’activités", voiceOn: "Mode vocal activé" },
  de: { level: "Level", round: "Runde", of: "von", showNumbers: "Zahlen zeigen", ready: "Bereit", enterAnswer: "Antwort eingeben", forward: "Gleiche Reihenfolge", reverse: "Umgekehrte Reihenfolge", ascending: "Aufsteigend", forwardGuide: "Sehen oder hören Sie zu und wiederholen Sie die Zahlen in derselben Reihenfolge.", reverseGuide: "Sehen oder hören Sie zu und wiederholen Sie die Zahlen in umgekehrter Reihenfolge.", ascendingGuide: "Sehen oder hören Sie zu und nennen Sie die Zahlen von klein nach groß.", forwardExample: "Beispiel: 4  ·  7  ·  2  →  4 7 2", reverseExample: "Beispiel: 4  ·  7  ·  2  →  2 7 4", ascendingExample: "Beispiel: 4  ·  7  ·  2  →  2 4 7", begin: "Weiter", delete: "Löschen", clear: "Leeren", submit: "Bestätigen", notSure: "Nicht sicher", review: "Rückblick", expected: "Erwartet", yourAnswer: "Ihre Antwort", noAnswer: "Nicht sicher", seeResults: "Ergebnisse ansehen", complete: "Zahlengedächtnis abgeschlossen", passed: "Level abgeschlossen", keepPractising: "Weiter üben", exactRounds: "Exakte Runden", accuracy: "Genauigkeit", time: "Zeit", nextLevel: "Nächstes Level", tryAgain: "Erneut versuchen", moreActivities: "Mehr Aktivitäten", voiceOn: "Sprachmodus aktiv" },
  it: { level: "Livello", round: "Round", of: "di", showNumbers: "Mostra i numeri", ready: "Preparati", enterAnswer: "Inserisci la risposta", forward: "Stesso ordine", reverse: "Ordine inverso", ascending: "Dal più piccolo al più grande", forwardGuide: "Guarda o ascolta, poi ripeti i numeri nello stesso ordine.", reverseGuide: "Guarda o ascolta, poi ripeti i numeri in ordine inverso.", ascendingGuide: "Guarda o ascolta, poi pronuncia i numeri dal più piccolo al più grande.", forwardExample: "Esempio: 4  ·  7  ·  2  →  4 7 2", reverseExample: "Esempio: 4  ·  7  ·  2  →  2 7 4", ascendingExample: "Esempio: 4  ·  7  ·  2  →  2 4 7", begin: "Continua", delete: "Cancella", clear: "Azzera", submit: "Invia", notSure: "Non sono sicuro", review: "Revisione", expected: "Atteso", yourAnswer: "La tua risposta", noAnswer: "Non sono sicuro", seeResults: "Vedi risultati", complete: "Memoria dei numeri completata", passed: "Livello completato", keepPractising: "Continua ad allenarti", exactRounds: "Round esatti", accuracy: "Precisione", time: "Tempo", nextLevel: "Livello successivo", tryAgain: "Riprova", moreActivities: "Altre attività", voiceOn: "Modalità vocale attiva" },
  pt: { level: "Nível", round: "Ronda", of: "de", showNumbers: "Mostrar números", ready: "Prepare-se", enterAnswer: "Introduza a resposta", forward: "Mesma ordem", reverse: "Ordem inversa", ascending: "Do menor para o maior", forwardGuide: "Veja ou ouça e repita os números pela mesma ordem.", reverseGuide: "Veja ou ouça e repita os números pela ordem inversa.", ascendingGuide: "Veja ou ouça e diga os números do menor para o maior.", forwardExample: "Exemplo: 4  ·  7  ·  2  →  4 7 2", reverseExample: "Exemplo: 4  ·  7  ·  2  →  2 7 4", ascendingExample: "Exemplo: 4  ·  7  ·  2  →  2 4 7", begin: "Continuar", delete: "Apagar", clear: "Limpar", submit: "Enviar", notSure: "Não tenho a certeza", review: "Revisão", expected: "Esperado", yourAnswer: "A sua resposta", noAnswer: "Não tenho a certeza", seeResults: "Ver resultados", complete: "Memória de números concluída", passed: "Nível concluído", keepPractising: "Continue a praticar", exactRounds: "Rondas exatas", accuracy: "Precisão", time: "Tempo", nextLevel: "Nível seguinte", tryAgain: "Tentar novamente", moreActivities: "Mais atividades", voiceOn: "Modo de voz ativo" },
};

const MODE_ACCENT: Record<NumberMemoryMode, string> = { forward: "#6D28D9", reverse: "#2563EB", ascending: "#0F766E" };
const START_ROUND_LABEL: Record<LanguageCode, string> = {
  en: "Let’s start",
  es: "Empecemos",
  fr: "C’est parti",
  de: "Los geht’s",
  it: "Iniziamo",
  pt: "Vamos começar",
};
const CONTINUE_ROUND_LABEL: Record<LanguageCode, string> = {
  en: "Start round",
  es: "Empezar ronda",
  fr: "Commencer la manche",
  de: "Runde starten",
  it: "Inizia il round",
  pt: "Começar ronda",
};
const NEXT_LEVEL_REQUIREMENT: Record<LanguageCode, string> = {
  en: "Reach 80% to unlock the next level",
  es: "Alcanza el 80 % para desbloquear el siguiente nivel",
  fr: "Atteignez 80 % pour débloquer le niveau suivant",
  de: "Erreiche 80 %, um das nächste Level freizuschalten",
  it: "Raggiungi l’80% per sbloccare il livello successivo",
  pt: "Alcance 80% para desbloquear o nível seguinte",
};
const ROUND_MOTIVATION: Record<LanguageCode, [string, string]> = {
  en: ["You’re underway — keep going", "Final round — you’ve got this"],
  es: ["Ya estás en marcha — sigue así", "Última ronda — tú puedes"],
  fr: ["Vous êtes lancé — continuez", "Dernière manche — vous pouvez le faire"],
  de: ["Du bist mittendrin — weiter so", "Letzte Runde — du schaffst das"],
  it: ["Hai iniziato — continua così", "Ultimo round — ce la puoi fare"],
  pt: ["Já começou — continue assim", "Última ronda — consegue fazê-lo"],
};
const FORWARD_MODE_LABEL: Record<LanguageCode, string> = {
  en: "Remember in the same order",
  es: "Recuerda en el mismo orden",
  fr: "Mémoriser dans le même ordre",
  de: "In derselben Reihenfolge merken",
  it: "Ricorda nello stesso ordine",
  pt: "Lembre-se na mesma ordem",
};

function NumberMemoryMotif({ compact = false }: { compact?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative mx-auto flex items-center justify-center overflow-hidden rounded-[26px] border border-[#E7DDF0] bg-[radial-gradient(circle_at_50%_30%,#FFFFFF_0%,#F6EEFF_58%,#F1F8F5_100%)]",
        compact ? "h-[126px] max-w-[360px]" : "h-[170px] max-w-[470px]",
      )}
    >
      <span className="absolute h-40 w-40 rounded-full border border-vyva-purple/10" />
      <span className="absolute h-28 w-28 rounded-full border border-vyva-purple/10" />
      {["1", "2", "3"].map((digit, index) => (
        <span
          key={digit}
          className={cn(
            "relative grid place-items-center rounded-[20px] border bg-white font-mono font-black shadow-[0_14px_34px_rgba(73,42,103,0.12)]",
            index === 1
              ? "z-10 h-[88px] w-[72px] border-vyva-purple/25 text-[44px] text-vyva-purple"
              : "h-[68px] w-[58px] border-[#E7DDF0] text-[30px] text-[#8B729D]",
            index === 0 && "-mr-2 -rotate-6",
            index === 2 && "-ml-2 rotate-6",
          )}
        >
          {digit}
        </span>
      ))}
    </div>
  );
}

function readPayload(content: MemoryGameVariantContent): NumberMemoryPayload | null {
  const payload = content.payload as Partial<NumberMemoryPayload>;
  return payload.roundVersion === "number_memory_v2" && Array.isArray(payload.rounds) && payload.rounds.length === 3
    ? payload as NumberMemoryPayload
    : null;
}

function guidanceKey(userId: string, mode: NumberMemoryMode) {
  return `numberMemory:guidance:v2:${userId}:${mode}`;
}

function hasSeenMode(userId: string, mode: NumberMemoryMode) {
  if (typeof window === "undefined") return true;
  try { return window.localStorage.getItem(guidanceKey(userId, mode)) === "true"; } catch { return false; }
}

function markModesSeen(userId: string, modes: NumberMemoryMode[]) {
  if (typeof window === "undefined") return;
  try { modes.forEach((mode) => window.localStorage.setItem(guidanceKey(userId, mode), "true")); } catch { /* Play does not depend on local storage. */ }
}

export default function NumberMemoryGame({ plan, localizedVariant, cognitiveDomain, userId, language, onBack, onOpenSameGame, actionLoading, voiceConnected = false, onVoiceContextChange }: NumberMemoryGameProps) {
  const { isDark } = useHomeMasterTheme();
  const copy = COPY[language] ?? COPY.en;
  const startRoundLabel = START_ROUND_LABEL[language] ?? START_ROUND_LABEL.en;
  const labelForMode = useCallback((mode: NumberMemoryMode) => mode === "forward" ? (FORWARD_MODE_LABEL[language] ?? FORWARD_MODE_LABEL.en) : copy[mode], [copy, language]);
  const payload = useMemo(() => readPayload(localizedVariant), [localizedVariant]);
  const modes = useMemo(() => [...new Set(payload?.rounds.map((round) => round.mode) ?? [])], [payload]);
  const unseenModes = useMemo(() => modes.filter((mode) => !hasSeenMode(userId, mode)), [modes, userId]);
  const [phase, setPhase] = useState<Phase>(() => unseenModes.length > 0 ? "guidance" : "ready");
  const [guidanceIndex, setGuidanceIndex] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const readyButtonLabel = roundIndex === 0
    ? startRoundLabel
    : `${CONTINUE_ROUND_LABEL[language] ?? CONTINUE_ROUND_LABEL.en} ${roundIndex + 1}`;
  const [digitIndex, setDigitIndex] = useState(-1);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [startedAt] = useState(() => Date.now());
  const [completedDurationSeconds, setCompletedDurationSeconds] = useState<number | null>(null);
  const [voicePresentation, setVoicePresentation] = useState(false);
  const timerRef = useRef<number | null>(null);
  const savedRef = useRef(false);
  const lastReleasedAtRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>(phase);
  const roundIndexRef = useRef(roundIndex);
  const digitIndexRef = useRef(digitIndex);
  const voicePresentationRef = useRef(voicePresentation);
  const wasVoiceConnectedRef = useRef(voiceConnected);
  const voiceAssistedRef = useRef(voiceConnected);
  const voicePresentationUsedRef = useRef(false);
  const responseModesRef = useRef(new Set<"keypad" | "voice">());

  const currentRound = payload?.rounds[roundIndex];
  phaseRef.current = phase;
  roundIndexRef.current = roundIndex;
  digitIndexRef.current = digitIndex;
  voicePresentationRef.current = voicePresentation;
  const result = useMemo(() => payload && answers.length === 3 ? scoreNumberMemoryRounds(payload.rounds, answers) : null, [answers, payload]);
  const modeLabel = currentRound ? labelForMode(currentRound.mode) : "";
  const readyHeadline = roundIndex === 0
    ? modeLabel
    : (ROUND_MOTIVATION[language] ?? ROUND_MOTIVATION.en)[roundIndex - 1];

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  useEffect(() => {
    if (voiceConnected) voiceAssistedRef.current = true;
    onVoiceContextChange?.({ activity: "number_memory", level: plan.level, round: roundIndex + 1, mode: currentRound?.mode ?? "forward", phase, language, presentation_mode: "audio_visual", voice_connected: voiceConnected });
  }, [currentRound?.mode, language, onVoiceContextChange, phase, plan.level, roundIndex, voiceConnected]);

  useEffect(() => {
    if (wasVoiceConnectedRef.current && !voiceConnected && phaseRef.current === "presentation" && voicePresentationRef.current) {
      clearTimer();
      digitIndexRef.current = -1;
      phaseRef.current = "ready";
      voicePresentationRef.current = false;
      setDigitIndex(-1);
      setVoicePresentation(false);
      setPhase("ready");
    }
    wasVoiceConnectedRef.current = voiceConnected;
  }, [clearTimer, voiceConnected]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && (phase === "countdown" || phase === "presentation")) {
        clearTimer();
        digitIndexRef.current = -1;
        phaseRef.current = "ready";
        voicePresentationRef.current = false;
        setDigitIndex(-1);
        setVoicePresentation(false);
        setPhase("ready");
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [clearTimer, phase]);

  useEffect(() => {
    if (!currentRound || voicePresentation) return;
    if (phase === "countdown") {
      clearTimer();
      timerRef.current = window.setTimeout(() => { setDigitIndex(0); setPhase("presentation"); }, 700);
      return clearTimer;
    }
    if (phase === "presentation") {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        if (digitIndex + 1 < currentRound.digits.length) setDigitIndex((current) => current + 1);
        else { setDigitIndex(-1); setPhase("recall"); }
      }, currentRound.presentationMsPerDigit);
      return clearTimer;
    }
  }, [clearTimer, currentRound, digitIndex, phase, voicePresentation]);

  const finishAnswer = useCallback((value: string, responseMode: "keypad" | "voice" = "keypad") => {
    if (!payload || phase !== "recall") return;
    responseModesRef.current.add(responseMode);
    const nextAnswers = [...answers, value];
    setAnswers(nextAnswers);
    setAnswer("");
    if (roundIndex < 2) {
      roundIndexRef.current = roundIndex + 1;
      phaseRef.current = "ready";
      setRoundIndex((current) => current + 1);
      setPhase("ready");
    } else {
      phaseRef.current = "review";
      setCompletedDurationSeconds(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
      setPhase("review");
    }
  }, [answers, payload, phase, roundIndex, startedAt]);

  useEffect(() => subscribeNumberMemoryVoiceTools((name, parameters): NumberMemoryVoiceToolResult => {
    const activeRoundIndex = roundIndexRef.current;
    const activeRound = payload?.rounds[activeRoundIndex];
    const activePhase = phaseRef.current;
    const base = { activity: "number_memory" as const, phase: activePhase, round: activeRoundIndex + 1 };
    const requestedRound = Number(parameters.round ?? activeRoundIndex + 1);
    if (!voiceConnected || !activeRound) return { ...base, ok: false, code: "voice_play_inactive" };
    if (requestedRound !== activeRoundIndex + 1) return { ...base, ok: false, code: "stale_round" };

    if (name === "start_number_memory_round") {
      if (activePhase === "guidance") {
        const activeGuidanceMode = unseenModes[guidanceIndex] ?? activeRound.mode;
        markModesSeen(userId, [activeGuidanceMode]);
        if (guidanceIndex < unseenModes.length - 1) setGuidanceIndex((current) => current + 1);
        else { phaseRef.current = "ready"; setPhase("ready"); }
        voiceAssistedRef.current = true;
        return { ...base, ok: true, code: "guidance_acknowledged", phase: guidanceIndex < unseenModes.length - 1 ? "guidance" : "ready", mode: activeGuidanceMode };
      }
      if (activePhase !== "ready") return { ...base, ok: false, code: "out_of_order" };
      voiceAssistedRef.current = true;
      voicePresentationUsedRef.current = true;
      voicePresentationRef.current = true;
      digitIndexRef.current = -1;
      lastReleasedAtRef.current = null;
      setVoicePresentation(true);
      setDigitIndex(-1);
      phaseRef.current = "presentation";
      setPhase("presentation");
      return { ...base, ok: true, code: "round_started", phase: "presentation", mode: activeRound.mode, digit_count: activeRound.digits.length, pace_ms: activeRound.presentationMsPerDigit, next_digit_index: 0 };
    }

    if (name === "get_next_number_memory_digit") {
      if (activePhase !== "presentation" || !voicePresentationRef.current) return { ...base, ok: false, code: "out_of_order" };
      const nextIndex = digitIndexRef.current + 1;
      const requestedIndex = Number(parameters.expected_index ?? nextIndex);
      if (requestedIndex !== nextIndex) return { ...base, ok: false, code: "stale_or_skipped_digit", expected_index: nextIndex };
      if (nextIndex >= activeRound.digits.length) return { ...base, ok: false, code: "presentation_complete" };
      const waitMs = lastReleasedAtRef.current === null
        ? 0
        : Math.max(0, activeRound.presentationMsPerDigit - (Date.now() - lastReleasedAtRef.current));
      if (waitMs > 0) return { ...base, ok: false, code: "digit_not_ready", retry_after_ms: waitMs, expected_index: nextIndex };
      lastReleasedAtRef.current = Date.now();
      digitIndexRef.current = nextIndex;
      setDigitIndex(nextIndex);
      return { ...base, ok: true, code: "digit_released", digit: activeRound.digits[nextIndex], digit_index: nextIndex, digit_count: activeRound.digits.length, is_last: nextIndex === activeRound.digits.length - 1 };
    }

    if (name === "begin_number_memory_recall") {
      if (activePhase !== "presentation" || !voicePresentationRef.current || digitIndexRef.current !== activeRound.digits.length - 1) return { ...base, ok: false, code: "presentation_not_complete" };
      voicePresentationRef.current = false;
      digitIndexRef.current = -1;
      phaseRef.current = "recall";
      setVoicePresentation(false);
      setDigitIndex(-1);
      setPhase("recall");
      return { ...base, ok: true, code: "recall_started", phase: "recall", expected_length: getNumberMemoryExpectedAnswer(activeRound).length, mode: activeRound.mode };
    }

    if (name === "submit_number_memory_answer") {
      if (activePhase !== "recall") return { ...base, ok: false, code: "out_of_order" };
      const raw = typeof parameters.digits === "string" ? parameters.digits.trim() : "";
      if (!raw || /[^\d\s,.-]/.test(raw)) return { ...base, ok: false, code: "ambiguous_answer" };
      const digits = raw.replace(/[^\d]/g, "");
      if (digits.length !== getNumberMemoryExpectedAnswer(activeRound).length) return { ...base, ok: false, code: "wrong_answer_length", expected_length: getNumberMemoryExpectedAnswer(activeRound).length };
      finishAnswer(digits, "voice");
      return { ...base, ok: true, code: "answer_submitted", phase: activeRoundIndex < 2 ? "ready" : "review", next_round: activeRoundIndex < 2 ? activeRoundIndex + 2 : undefined };
    }

    if (name === "number_memory_not_sure") {
      if (activePhase !== "recall") return { ...base, ok: false, code: "out_of_order" };
      finishAnswer("", "voice");
      return { ...base, ok: true, code: "not_sure_submitted", phase: activeRoundIndex < 2 ? "ready" : "review", next_round: activeRoundIndex < 2 ? activeRoundIndex + 2 : undefined };
    }
    return { ...base, ok: false, code: "unknown_tool" };
  }), [finishAnswer, guidanceIndex, payload, unseenModes, userId, voiceConnected]);

  useEffect(() => {
    if (phase !== "recall" || !currentRound) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) { event.preventDefault(); setAnswer((current) => current.length < getNumberMemoryExpectedAnswer(currentRound).length ? current + event.key : current); }
      else if (event.key === "Backspace") { event.preventDefault(); setAnswer((current) => current.slice(0, -1)); }
      else if (event.key === "Delete") { event.preventDefault(); setAnswer(""); }
      else if (event.key === "Enter" && answer.length > 0) { event.preventDefault(); finishAnswer(answer); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [answer, currentRound, finishAnswer, phase]);

  useEffect(() => {
    if (!payload || !result || savedRef.current) return;
    savedRef.current = true;
    const durationSeconds = completedDurationSeconds ?? Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    void saveGameResult({
      userId, gameType: plan.gameType, cognitiveDomain, variantId: plan.variantId, level: plan.level,
      score: result.accuracy, accuracy: result.accuracy, mistakes: result.mistakes, durationSeconds,
      completedAt: new Date().toISOString(), language,
      metadata: {
        roundVersion: "number_memory_v2", roundCount: 3, exactRoundCount: result.exactRoundCount,
        correctDigitCount: result.correctDigitCount, totalDigitCount: result.totalDigitCount,
        modeSequence: payload.rounds.map((round) => round.mode),
        sequenceLengths: payload.rounds.map((round) => round.digits.length),
        presentationMsPerDigit: payload.rounds.map((round) => round.presentationMsPerDigit),
        levelPassed: result.levelPassed,
        presentationMode: voicePresentationUsedRef.current ? "audio_visual" : "visual",
        responseMode: responseModesRef.current.size > 1 ? "mixed" : responseModesRef.current.has("voice") ? "voice" : "keypad",
        voiceAssisted: voiceAssistedRef.current,
      },
    });
  }, [cognitiveDomain, completedDurationSeconds, language, payload, plan, result, startedAt, userId]);

  if (!payload || !currentRound) return null;

  const durationSeconds = completedDurationSeconds ?? Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  const guidanceMode = unseenModes[guidanceIndex] ?? currentRound.mode;
  const answerLength = getNumberMemoryExpectedAnswer(currentRound).length;
  const startAfterGuidance = () => {
    markModesSeen(userId, [guidanceMode]);
    if (guidanceIndex < unseenModes.length - 1) setGuidanceIndex((current) => current + 1);
    else setPhase("ready");
  };
  const appendDigit = (digit: string) => setAnswer((current) => current.length < answerLength ? current + digit : current);

  if (phase === "complete" && result) {
    const canAdvance = result.levelPassed && plan.level < NUMBER_MEMORY_MAX_LEVEL;
    return (
      <div className={cn("min-h-[100dvh]", isDark ? "bg-[#100A18]" : "bg-[#FFF9F3]")}> 
        <BrainGameCompletionDialog
          title={copy.complete}
          summary={result.levelPassed ? copy.passed : (NEXT_LEVEL_REQUIREMENT[language] ?? NEXT_LEVEL_REQUIREMENT.en)}
          metrics={[
            { label: copy.exactRounds, value: `${result.exactRoundCount}/3` },
            { label: copy.accuracy, value: `${result.accuracy}%` },
            { label: copy.time, value: `${durationSeconds}s` },
          ]}
          nextLevelLabel={canAdvance ? `${copy.nextLevel} ${plan.level + 1}` : undefined}
          nextLevelDisplayLabel={canAdvance ? copy.nextLevel : undefined}
          replayLabel={copy.tryAgain}
          anotherLabel={copy.moreActivities}
          onNextLevel={canAdvance ? () => void onOpenSameGame(plan.level + 1) : undefined}
          onReplay={() => void onOpenSameGame(plan.level)}
          onAnother={onBack}
          disabled={actionLoading !== null}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[680px] px-1 pb-5 pt-2 sm:px-4">
      <section className={cn("overflow-hidden rounded-[30px] border p-5 shadow-[0_22px_60px_rgba(72,42,92,0.12)] sm:p-8", isDark ? "border-white/10 bg-white/[0.07]" : "border-[#E8DEED] bg-white")}>
        <div className="flex items-center justify-between gap-3">
          <p className={cn("rounded-full px-3 py-1.5 text-[12px] font-black uppercase tracking-[0.06em]", isDark ? "bg-white/10 text-[#DCC8F8]" : "bg-[#F3E9FF] text-vyva-purple")}>{copy.level} {plan.level}</p>
          {phase !== "guidance" && phase !== "review" ? <p className={cn("text-[14px] font-bold", isDark ? "text-[#CFC5D8]" : "text-vyva-text-2")}>{voiceConnected ? `${copy.voiceOn} · ` : ""}{copy.round} {roundIndex + 1} {copy.of} 3</p> : null}
        </div>

        {phase === "guidance" ? (
          <div className="pb-1 pt-5 text-center">
            <NumberMemoryMotif />
            <h2 className="mt-7 font-display text-[30px] font-semibold tracking-[-0.02em]">{labelForMode(guidanceMode)}</h2>
            <p className={cn("mx-auto mt-2 max-w-[32rem] text-[17px] font-semibold leading-relaxed", isDark ? "text-[#D8CDDF]" : "text-vyva-text-2")}>{copy[`${guidanceMode}Guide` as const]}</p>
            {guidanceMode !== "forward" ? (
              <p className={cn("mx-auto mt-4 max-w-[420px] rounded-[16px] px-4 py-3 font-mono text-[16px] font-bold", isDark ? "bg-white/[0.08]" : "bg-[#FAF6FF]")}>{copy[`${guidanceMode}Example` as const]}</p>
            ) : null}
            <button type="button" onClick={startAfterGuidance} className="mt-6 min-h-[60px] w-full rounded-full bg-vyva-purple px-6 text-[20px] font-black text-white shadow-[0_14px_28px_rgba(109,40,217,0.24)] transition-transform active:scale-[0.99]">{copy.begin}</button>
          </div>
        ) : null}

        {phase === "ready" ? (
          <div className="pb-2 pt-5 text-center">
            <NumberMemoryMotif compact />
            <h2 className="mt-6 font-display text-[30px] font-semibold tracking-[-0.02em]">{readyHeadline}</h2>
            {roundIndex > 0 ? <p className={cn("mt-2 text-[15px] font-black", isDark ? "text-[#DCC8F8]" : "text-vyva-purple")}>{modeLabel}</p> : null}
            <div className="mt-4 flex justify-center gap-2" aria-label={`${currentRound.digits.length} digits`}>
              {Array.from({ length: currentRound.digits.length }, (_, index) => <span key={index} className={cn("h-2.5 w-7 rounded-full", isDark ? "bg-white/25" : "bg-[#DDCBEF]")} />)}
            </div>
            <button type="button" onClick={() => setPhase("countdown")} className="mt-7 min-h-[62px] w-full rounded-full bg-vyva-purple px-6 text-[21px] font-black text-white shadow-[0_14px_28px_rgba(109,40,217,0.24)] transition-transform active:scale-[0.99]">{readyButtonLabel}</button>
          </div>
        ) : null}

        {phase === "countdown" || phase === "presentation" ? (
          <div aria-live="polite" className="grid min-h-[390px] place-items-center py-6 text-center">
            {phase === "countdown" ? <p className="font-display text-[34px] font-semibold">{copy.ready}</p> : (
              <div>
                <div className="mx-auto grid h-[190px] w-[160px] place-items-center rounded-[34px] border border-vyva-purple/20 bg-[radial-gradient(circle_at_50%_30%,#FFFFFF_0%,#F4E8FF_100%)] shadow-[0_24px_54px_rgba(109,40,217,0.18)]">
                  <p key={digitIndex} className="font-mono text-[104px] font-black leading-none text-vyva-purple motion-safe:animate-[fade-in_180ms_ease-out] motion-reduce:animate-none">{currentRound.digits[digitIndex]}</p>
                </div>
                <div className="mt-7 flex justify-center gap-2">
                  {Array.from(currentRound.digits, (_, index) => <span key={index} className={cn("h-2 w-7 rounded-full transition-colors", index <= digitIndex ? "bg-vyva-purple" : isDark ? "bg-white/20" : "bg-[#E3D7EA]")} />)}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {phase === "recall" ? (
          <div className="pt-5 text-center">
            <p className="text-[16px] font-black" style={{ color: MODE_ACCENT[currentRound.mode] }}>{modeLabel}</p>
            <h2 className="mt-2 font-display text-[28px] font-semibold">{copy.enterAnswer}</h2>
            <div aria-label={copy.enterAnswer} className="mt-5 flex min-h-[72px] items-center justify-center gap-2 rounded-[20px] border border-[#DCCDED] bg-[#FBF8FF] px-3">
              {Array.from({ length: answerLength }, (_, index) => <span key={index} className={cn("grid h-11 min-w-8 place-items-center border-b-2 font-mono text-[28px] font-black text-[#241C30]", answer[index] ? "border-vyva-purple" : "border-[#CFC1DB]")}>{answer[index] ?? ""}</span>)}
            </div>
            <div className="mx-auto mt-5 grid max-w-[430px] grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => <button key={digit} type="button" onClick={() => appendDigit(digit)} className="min-h-[58px] rounded-[17px] border border-[#E4D9ED] bg-white text-[25px] font-black text-[#241C30] shadow-sm active:bg-[#F4EAFF]">{digit}</button>)}
              <button type="button" aria-label={copy.clear} onClick={() => setAnswer("")} className="min-h-[58px] rounded-[17px] border border-[#E4D9ED] bg-[#FAF7FC] text-[14px] font-black text-vyva-text-2">{copy.clear}</button>
              <button type="button" onClick={() => appendDigit("0")} className="min-h-[58px] rounded-[17px] border border-[#E4D9ED] bg-white text-[25px] font-black text-[#241C30] shadow-sm">0</button>
              <button type="button" aria-label={copy.delete} onClick={() => setAnswer((current) => current.slice(0, -1))} className="grid min-h-[58px] place-items-center rounded-[17px] border border-[#E4D9ED] bg-[#FAF7FC] text-vyva-purple"><Delete size={23} /></button>
            </div>
            <button type="button" disabled={!answer} onClick={() => finishAnswer(answer)} className="mt-5 min-h-[60px] w-full rounded-full bg-vyva-purple px-6 text-[20px] font-black text-white shadow-vyva-card disabled:cursor-not-allowed disabled:opacity-40">{copy.submit}</button>
            <button type="button" onClick={() => finishAnswer("")} className={cn("mt-2 min-h-[48px] px-5 text-[16px] font-black underline underline-offset-4", isDark ? "text-[#DCC8F8]" : "text-vyva-purple")}>{copy.notSure}</button>
          </div>
        ) : null}

        {phase === "review" && result ? (
          <div className="pt-5">
            <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#E9F7F1] text-[#0F766E]"><Check size={24} /></span><div><p className="text-[13px] font-black uppercase tracking-[0.05em] text-vyva-text-2">{copy.review}</p><h2 className="font-display text-[26px] font-semibold">{result.exactRoundCount}/3 {copy.exactRounds.toLowerCase()}</h2></div></div>
            <div className="mt-5 grid gap-3">
              {payload.rounds.map((round, index) => {
                const exact = result.editDistances[index] === 0;
                return <article key={round.id} className={cn("rounded-[18px] border p-4", exact ? "border-[#CBE9DC] bg-[#F3FBF7]" : "border-[#F0DFC2] bg-[#FFF9F1]")}><div className="flex items-center justify-between gap-3"><p className="font-black text-[#241C30]">{copy.round} {index + 1} · {labelForMode(round.mode)}</p>{exact ? <Check size={20} className="text-[#0F766E]" /> : <RotateCcw size={19} className="text-[#A45B00]" />}</div><div className="mt-3 grid grid-cols-2 gap-3"><div><p className="text-[11px] font-black uppercase text-vyva-text-2">{copy.yourAnswer}</p><p className="mt-1 font-mono text-[20px] font-black text-[#241C30]">{answers[index] || copy.noAnswer}</p></div><div><p className="text-[11px] font-black uppercase text-vyva-text-2">{copy.expected}</p><p className="mt-1 font-mono text-[20px] font-black text-[#0F766E]">{result.expectedAnswers[index]}</p></div></div></article>;
              })}
            </div>
            <button type="button" onClick={() => setPhase("complete")} className="mt-5 min-h-[60px] w-full rounded-full bg-vyva-purple px-6 text-[20px] font-black text-white shadow-vyva-card">{copy.seeResults}</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

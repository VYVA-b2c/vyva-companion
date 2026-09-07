import { useMemo, useState } from "react";
import { BriefcaseBusiness, Check, Clock3, ListOrdered, MapPin } from "lucide-react";
import type { LanguageCode } from "@/i18n/languages";
import { BRAIN_COACH_MAX_LEVEL, getBrainCoachProgressLabel } from "../shared/brainCoachProgression";
import BrainGameCompletionDialog from "../shared/BrainGameCompletionDialog";
import type { ConnectionsPayload, ConnectionRecord } from "./connectionsData";
import { saveGameResult } from "./gameStorage";
import type { CognitiveDomain, MemoryGameVariantContent, Recommendation } from "./types";

type ConnectionsResult = {
  correctCount: number;
  questionCount: number;
  accuracy: number;
  durationSeconds: number;
  answers: Array<string | null>;
};

type ConnectionsGameProps = {
  plan: Recommendation;
  localizedVariant: MemoryGameVariantContent;
  cognitiveDomain: CognitiveDomain;
  userId: string;
  language: LanguageCode;
  onBack: () => void;
  onOpenRecommended: () => void;
  onOpenSameGame: (levelOverride?: number) => void | Promise<void>;
  actionLoading: "recommended" | "repeat" | "nextLevel" | null;
};

const COPY: Record<LanguageCode, {
  study: string; studyHint: string; startRecall: string; reset: string; resetHint: string; resetTry: string;
  recall: string; question: string; notSure: string; review: string; remembered: string; missed: string;
  yourAnswer: string; correctAnswer: string; noAnswer: string; seeResults: string; nextActivity: string; nextLevel: string; tryAgain: string;
  moreActivities: string; complete: string; accuracy: string; time: string;
}> = {
  en: { study: "Remember these plans", studyHint: "Each person has different details.", startRecall: "Start recall", reset: "Clear your mind", resetHint: "Tap the numbers from lowest to highest.", resetTry: "Choose the next smallest number.", recall: "Recall the connections", question: "Question", notSure: "Not sure", review: "Review", remembered: "Connections remembered", missed: "Take another look", yourAnswer: "Your answer", correctAnswer: "Correct connection", noAnswer: "Not sure", seeResults: "See results", nextActivity: "Next activity", nextLevel: "Next level", tryAgain: "Try again", moreActivities: "More activities", complete: "Connections complete", accuracy: "Accuracy", time: "Time" },
  es: { study: "Recuerda estos planes", studyHint: "Cada persona tiene datos diferentes.", startRecall: "Empezar a recordar", reset: "Despeja la mente", resetHint: "Toca los números de menor a mayor.", resetTry: "Elige el siguiente número más pequeño.", recall: "Recuerda las conexiones", question: "Pregunta", notSure: "No estoy seguro", review: "Revisión", remembered: "Conexiones recordadas", missed: "Repasa estas conexiones", yourAnswer: "Tu respuesta", correctAnswer: "Conexión correcta", noAnswer: "No estoy seguro", seeResults: "Ver resultados", nextActivity: "Siguiente actividad", nextLevel: "Siguiente nivel", tryAgain: "Intentar de nuevo", moreActivities: "Más actividades", complete: "Conexiones completadas", accuracy: "Precisión", time: "Tiempo" },
  fr: { study: "Retenez ces projets", studyHint: "Chaque personne a des détails différents.", startRecall: "Commencer le rappel", reset: "Faites le vide", resetHint: "Touchez les nombres du plus petit au plus grand.", resetTry: "Choisissez le prochain nombre le plus petit.", recall: "Retrouvez les connexions", question: "Question", notSure: "Je ne sais pas", review: "Révision", remembered: "Connexions retenues", missed: "Revoyez ces connexions", yourAnswer: "Votre réponse", correctAnswer: "Bonne connexion", noAnswer: "Je ne sais pas", seeResults: "Voir les résultats", nextActivity: "Activité suivante", nextLevel: "Niveau suivant", tryAgain: "Réessayer", moreActivities: "Plus d'activités", complete: "Connexions terminées", accuracy: "Précision", time: "Temps" },
  de: { study: "Merken Sie sich diese Pläne", studyHint: "Jede Person hat andere Details.", startRecall: "Erinnerung starten", reset: "Kopf frei machen", resetHint: "Tippen Sie die Zahlen von klein nach groß.", resetTry: "Wählen Sie die nächstkleinere Zahl.", recall: "Verbindungen erinnern", question: "Frage", notSure: "Nicht sicher", review: "Rückblick", remembered: "Erinnerte Verbindungen", missed: "Noch einmal ansehen", yourAnswer: "Ihre Antwort", correctAnswer: "Richtige Verbindung", noAnswer: "Nicht sicher", seeResults: "Ergebnisse ansehen", nextActivity: "Nächste Aktivität", nextLevel: "Nächstes Level", tryAgain: "Erneut versuchen", moreActivities: "Mehr Aktivitäten", complete: "Verbindungen abgeschlossen", accuracy: "Genauigkeit", time: "Zeit" },
  it: { study: "Ricorda questi programmi", studyHint: "Ogni persona ha dettagli diversi.", startRecall: "Inizia a ricordare", reset: "Libera la mente", resetHint: "Tocca i numeri dal più piccolo al più grande.", resetTry: "Scegli il prossimo numero più piccolo.", recall: "Ricorda le connessioni", question: "Domanda", notSure: "Non sono sicuro", review: "Revisione", remembered: "Connessioni ricordate", missed: "Rivedi queste connessioni", yourAnswer: "La tua risposta", correctAnswer: "Connessione corretta", noAnswer: "Non sono sicuro", seeResults: "Vedi risultati", nextActivity: "Attività successiva", nextLevel: "Livello successivo", tryAgain: "Riprova", moreActivities: "Altre attività", complete: "Connessioni completate", accuracy: "Precisione", time: "Tempo" },
  pt: { study: "Recorde estes planos", studyHint: "Cada pessoa tem detalhes diferentes.", startRecall: "Começar a recordar", reset: "Liberte a mente", resetHint: "Toque nos números do menor para o maior.", resetTry: "Escolha o próximo número mais pequeno.", recall: "Recorde as ligações", question: "Pergunta", notSure: "Não tenho a certeza", review: "Revisão", remembered: "Ligações recordadas", missed: "Reveja estas ligações", yourAnswer: "A sua resposta", correctAnswer: "Ligação correta", noAnswer: "Não tenho a certeza", seeResults: "Ver resultados", nextActivity: "Atividade seguinte", nextLevel: "Nível seguinte", tryAgain: "Tentar novamente", moreActivities: "Mais atividades", complete: "Ligações concluídas", accuracy: "Precisão", time: "Tempo" },
};

const TONE_CLASSES: Record<ConnectionRecord["tone"], string> = {
  purple: "bg-[#F3E8FF] text-[#6B21A8]",
  teal: "bg-[#DDF7F1] text-[#0F766E]",
  blue: "bg-[#E7F0FF] text-[#2563EB]",
  amber: "bg-[#FFF2CC] text-[#9A5B00]",
  rose: "bg-[#FDE8EE] text-[#BE185D]",
};

function readPayload(content: MemoryGameVariantContent): ConnectionsPayload | null {
  const payload = content.payload as Partial<ConnectionsPayload>;
  if (payload.roundVersion !== "connections_v2" || !Array.isArray(payload.connections) || !Array.isArray(payload.questions)) return null;
  return payload as ConnectionsPayload;
}

function getDurationSeconds(startedAt: number) {
  return Math.max(1, Math.round((Date.now() - startedAt) / 1000));
}

export default function ConnectionsGame({
  plan,
  localizedVariant,
  cognitiveDomain,
  userId,
  language,
  onBack,
  onOpenRecommended,
  onOpenSameGame,
  actionLoading,
}: ConnectionsGameProps) {
  const payload = useMemo(() => readPayload(localizedVariant), [localizedVariant]);
  const copy = COPY[language] ?? COPY.en;
  const [phase, setPhase] = useState<"study" | "reset" | "recall" | "review" | "complete">("study");
  const [startedAt] = useState(() => Date.now());
  const [resetProgress, setResetProgress] = useState(0);
  const [resetMessage, setResetMessage] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<string | null>>([]);
  const [result, setResult] = useState<ConnectionsResult | null>(null);

  if (!payload) return null;

  const sortedResetNumbers = [...payload.resetNumbers].sort((a, b) => a - b);
  const currentQuestion = payload.questions[questionIndex] ?? null;

  const beginRecall = () => {
    setPhase(payload.resetNumbers.length > 0 ? "reset" : "recall");
  };

  const chooseResetNumber = (value: number) => {
    if (value !== sortedResetNumbers[resetProgress]) {
      setResetMessage(copy.resetTry);
      return;
    }
    setResetMessage("");
    const nextProgress = resetProgress + 1;
    setResetProgress(nextProgress);
    if (nextProgress === sortedResetNumbers.length) setPhase("recall");
  };

  const finishRound = (nextAnswers: Array<string | null>) => {
    const correctCount = payload.questions.reduce((total, question, index) => total + (nextAnswers[index] === question.answer ? 1 : 0), 0);
    const questionCount = payload.questions.length;
    const accuracy = Math.round((correctCount / Math.max(1, questionCount)) * 100);
    const durationSeconds = getDurationSeconds(startedAt);
    const nextResult = { correctCount, questionCount, accuracy, durationSeconds, answers: nextAnswers };
    setResult(nextResult);
    setPhase("review");
    void saveGameResult({
        userId,
        gameType: plan.gameType,
        cognitiveDomain,
        variantId: plan.variantId,
        level: plan.level,
        score: accuracy,
        accuracy,
        mistakes: questionCount - correctCount,
        durationSeconds,
        completedAt: new Date().toISOString(),
        language,
        metadata: {
          roundVersion: "connections_v2",
          associationCount: payload.connections.length,
          questionCount,
          correctCount,
          questionsAnswered: nextAnswers.filter((answer) => answer !== null).length,
          resetKind: payload.resetNumbers.length > 0 ? "number_order" : "none",
        },
    });
  };

  const answerQuestion = (answer: string | null) => {
    if (!currentQuestion) return;
    const nextAnswers = [...answers, answer];
    setAnswers(nextAnswers);
    if (questionIndex < payload.questions.length - 1) {
      setQuestionIndex((current) => current + 1);
      return;
    }
    finishRound(nextAnswers);
  };

  if (phase === "complete" && result) {
    const nextLevel = Math.min(BRAIN_COACH_MAX_LEVEL, plan.level + 1);
    const canAdvance = result.accuracy >= 80 && plan.level < BRAIN_COACH_MAX_LEVEL;
    return (
      <div className="min-h-[100dvh] bg-[#FFF9F3]">
        <BrainGameCompletionDialog
          title={copy.complete}
          summary={`${result.correctCount}/${result.questionCount} ${copy.remembered.toLowerCase()}`}
          metrics={[
            { label: copy.remembered, value: `${result.correctCount}/${result.questionCount}` },
            { label: copy.accuracy, value: `${result.accuracy}%` },
            { label: copy.time, value: `${result.durationSeconds}s` },
          ]}
          continueLabel={copy.nextActivity}
          nextLevelLabel={canAdvance ? `${copy.nextLevel} ${nextLevel}` : undefined}
          nextLevelDisplayLabel={canAdvance ? copy.nextLevel : undefined}
          replayLabel={copy.tryAgain}
          anotherLabel={copy.moreActivities}
          onContinue={onOpenRecommended}
          onNextLevel={canAdvance ? () => void onOpenSameGame(nextLevel) : undefined}
          onReplay={() => void onOpenSameGame(plan.level)}
          onAnother={onBack}
          disabled={actionLoading !== null}
        />
      </div>
    );
  }

  const missedQuestions = result
    ? payload.questions.filter((question, index) => result.answers[index] !== question.answer)
    : [];

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-5 pt-2">
      <section className="rounded-[26px] border border-[#E8DDF2] bg-white p-4 shadow-vyva-card sm:p-6">
        <p className="text-[12px] font-black uppercase tracking-[0.06em] text-vyva-purple">{getBrainCoachProgressLabel(plan.level)}</p>

        {phase === "study" ? (
          <>
            <div className="mt-4">
              <h2 className="font-display text-[24px] text-vyva-text-1">{copy.study}</h2>
              <p className="mt-1 text-[15px] font-semibold text-vyva-text-2">{copy.studyHint}</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {payload.connections.map((connection) => (
                <article key={connection.id} className="rounded-[20px] border border-[#EEE6F4] bg-[#FFFCF8] p-4">
                  <div className="flex items-center gap-3">
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[16px] font-black ${TONE_CLASSES[connection.tone]}`}>{connection.person.slice(0, 1)}</span>
                    <h3 className="text-[20px] font-black text-vyva-text-1">{connection.person}</h3>
                  </div>
                  <div className="mt-3 grid gap-2 text-[15px] font-semibold text-vyva-text-2">
                    {connection.place ? <p className="flex items-center gap-2"><MapPin size={17} className="text-[#0F766E]" />{connection.place}</p> : null}
                    {connection.item ? <p className="flex items-center gap-2"><BriefcaseBusiness size={17} className="text-[#B45309]" />{connection.item}</p> : null}
                    {connection.time ? <p className="flex items-center gap-2"><Clock3 size={17} className="text-[#2563EB]" />{connection.time}</p> : null}
                  </div>
                </article>
              ))}
            </div>
            <button type="button" onClick={beginRecall} className="mt-5 min-h-[60px] w-full rounded-full bg-vyva-purple px-6 text-[20px] font-black text-white shadow-vyva-card">{copy.startRecall}</button>
          </>
        ) : null}

        {phase === "reset" ? (
          <div className="mt-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-[18px] bg-[#E7F0FF] text-[#2563EB]"><ListOrdered size={27} /></div>
            <h2 className="mt-4 font-display text-[26px] text-vyva-text-1">{copy.reset}</h2>
            <p className="mt-1 text-[16px] font-semibold text-vyva-text-2">{copy.resetHint}</p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {payload.resetNumbers.map((number) => {
                const completed = sortedResetNumbers.slice(0, resetProgress).includes(number);
                return <button key={number} type="button" disabled={completed} onClick={() => chooseResetNumber(number)} className="min-h-[66px] rounded-[18px] border border-[#D7E4FA] bg-[#F4F8FF] text-[22px] font-black text-[#1D4ED8] disabled:opacity-25">{number}</button>;
              })}
            </div>
            <p aria-live="polite" className="mt-3 min-h-6 text-[14px] font-bold text-[#B45309]">{resetMessage}</p>
          </div>
        ) : null}

        {phase === "recall" && currentQuestion ? (
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3 text-[13px] font-black text-vyva-text-2">
              <span>{copy.recall}</span><span>{copy.question} {questionIndex + 1}/{payload.questions.length}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEE6F4]"><div className="h-full rounded-full bg-vyva-purple transition-[width]" style={{ width: `${((questionIndex + 1) / payload.questions.length) * 100}%` }} /></div>
            <h2 className="mt-6 font-display text-[28px] leading-tight text-vyva-text-1">{currentQuestion.prompt}</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {currentQuestion.options.map((option) => <button key={option} type="button" onClick={() => answerQuestion(option)} className="min-h-[64px] rounded-[18px] border border-[#E4D7EF] bg-[#FFFCF8] px-4 text-left text-[18px] font-bold text-vyva-text-1 transition hover:border-vyva-purple focus-visible:border-vyva-purple">{option}</button>)}
            </div>
            <button type="button" onClick={() => answerQuestion(null)} className="mt-3 min-h-[54px] w-full rounded-[18px] border border-[#E4D7EF] bg-white px-4 text-[16px] font-bold text-vyva-text-2">{copy.notSure}</button>
          </div>
        ) : null}

        {phase === "review" && result ? (
          <div className="mt-6">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#E8F7F1] text-[#0F766E]"><Check size={23} /></span><div><p className="text-[13px] font-black uppercase tracking-[0.05em] text-vyva-text-2">{copy.review}</p><h2 className="font-display text-[25px] text-vyva-text-1">{result.correctCount}/{result.questionCount} {copy.remembered.toLowerCase()}</h2></div></div>
            {missedQuestions.length > 0 ? <div className="mt-5"><h3 className="text-[17px] font-black text-vyva-text-1">{copy.missed}</h3><div className="mt-3 grid gap-3">{missedQuestions.map((question) => { const index = payload.questions.indexOf(question); return <article key={question.id} className="rounded-[18px] border border-[#F0DFC2] bg-[#FFF9F1] p-4"><p className="text-[16px] font-black text-vyva-text-1">{question.prompt}</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><p className="rounded-[14px] bg-white px-3 py-2 text-[14px] text-vyva-text-2"><span className="block text-[11px] font-black uppercase">{copy.yourAnswer}</span>{result.answers[index] ?? copy.noAnswer}</p><p className="rounded-[14px] bg-[#EEF9F4] px-3 py-2 text-[14px] text-[#0F6B50]"><span className="block text-[11px] font-black uppercase">{copy.correctAnswer}</span>{question.answer}</p></div></article>; })}</div></div> : <p className="mt-5 rounded-[18px] bg-[#EEF9F4] px-4 py-4 text-[16px] font-bold text-[#0F6B50]">{copy.remembered}: {result.questionCount}/{result.questionCount}</p>}
            <button type="button" onClick={() => setPhase("complete")} className="mt-5 min-h-[60px] w-full rounded-full bg-vyva-purple px-6 text-[20px] font-black text-white shadow-vyva-card">{copy.seeResults}</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

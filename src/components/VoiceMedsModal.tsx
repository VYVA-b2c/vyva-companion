import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, RefreshCw, CheckCircle2, Loader2, AlertTriangle, Info } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";

const DISCLAIMER =
  "This is information only, not medical advice — always check with your doctor or pharmacist.";

const MEDS_QA_PROMPT_SUFFIX = `IMPORTANT INSTRUCTION — MEDICATION Q&A MODE:
You are answering medication management questions. After every single response you give, you MUST append this disclaimer verbatim on a new line: "${DISCLAIMER}"
This disclaimer must appear at the end of every spoken and written response without exception.`;

const FREQ_LABELS: Record<string, string> = {
  once_daily: "Once daily",
  twice_daily: "Twice daily",
  three_daily: "3× daily",
  as_needed: "As needed",
};
const FOOD_LABELS: Record<string, string> = {
  with_food: "With food",
  without_food: "Without food",
  doesnt_matter: "Doesn't matter",
};

interface ParsedMedication {
  name?: string;
  dosage?: string;
  frequency?: string;
  times?: string;
  withFood?: string;
  prescribedBy?: string;
}

export interface MedicationForForm {
  name: string;
  dosage: string;
  frequency: string;
  times: string;
  with_food: string;
  prescribed_by: string;
}

interface VoiceMedsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddMedication: (med: MedicationForForm) => void;
}

type ParseState = "idle" | "parsing" | "confirming" | "error";

function hasMicSupport(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

export default function VoiceMedsModal({ open, onOpenChange, onAddMedication }: VoiceMedsModalProps) {
  const [activeTab, setActiveTab] = useState<"add" | "ask">("add");
  const [parseState, setParseState] = useState<ParseState>("idle");
  const [parsedResult, setParsedResult] = useState<ParsedMedication | null>(null);
  const [micSupported] = useState(() => hasMicSupport());

  const sessionStartIdx = useRef(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const { startVoice, stopVoice, status, isSpeaking, isConnecting, transcript } = useVyvaVoice();

  const isActive = status === "connected";

  const statusLabel = isConnecting
    ? "Connecting..."
    : isActive
    ? isSpeaking
      ? "VYVA is speaking..."
      : "Listening to you..."
    : "Tap to start speaking";

  const tabTranscript = transcript.slice(sessionStartIdx.current);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [tabTranscript.length]);

  const resetSession = useCallback(() => {
    sessionStartIdx.current = transcript.length;
    setParseState("idle");
    setParsedResult(null);
  }, [transcript.length]);

  const handleTabChange = useCallback(
    async (tab: string) => {
      if (isActive) await stopVoice();
      setActiveTab(tab as "add" | "ask");
      sessionStartIdx.current = transcript.length;
      setParseState("idle");
      setParsedResult(null);
    },
    [isActive, stopVoice, transcript.length]
  );

  const handleClose = useCallback(async () => {
    if (isActive) await stopVoice();
    onOpenChange(false);
  }, [isActive, stopVoice, onOpenChange]);

  const handleStartAdd = useCallback(async () => {
    sessionStartIdx.current = transcript.length;
    setParseState("idle");
    setParsedResult(null);
    await startVoice("medication details entry");
  }, [transcript.length, startVoice]);

  const handleStopAndParse = useCallback(async () => {
    const userText = transcript
      .slice(sessionStartIdx.current)
      .filter((e) => e.from === "user")
      .map((e) => e.text)
      .join(" ");

    await stopVoice();

    if (!userText.trim()) {
      setParseState("idle");
      return;
    }

    setParseState("parsing");
    try {
      const res = await fetch("/api/meds-voice-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: userText }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ParsedMedication = await res.json();
      setParsedResult(data);
      setParseState("confirming");
    } catch {
      setParseState("error");
    }
  }, [transcript, stopVoice]);

  const handleStartAsk = useCallback(async () => {
    sessionStartIdx.current = transcript.length;
    await startVoice("medication management questions", MEDS_QA_PROMPT_SUFFIX);
  }, [transcript.length, startVoice]);

  const handleStopAsk = useCallback(async () => {
    await stopVoice();
  }, [stopVoice]);

  const handleConfirm = useCallback(() => {
    if (!parsedResult) return;
    const med: MedicationForForm = {
      name: parsedResult.name ?? "",
      dosage: parsedResult.dosage ?? "",
      frequency: parsedResult.frequency ?? "",
      times: parsedResult.times ?? "",
      with_food: parsedResult.withFood ?? "",
      prescribed_by: parsedResult.prescribedBy ?? "",
    };
    onAddMedication(med);
    onOpenChange(false);
  }, [parsedResult, onAddMedication, onOpenChange]);

  const handleTryAgain = useCallback(() => {
    resetSession();
  }, [resetSession]);

  const hasAnyParsed =
    parsedResult &&
    (parsedResult.name ||
      parsedResult.dosage ||
      parsedResult.frequency ||
      parsedResult.times ||
      parsedResult.withFood ||
      parsedResult.prescribedBy);

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="bottom"
        className="rounded-t-[24px] px-0 pb-0 max-h-[90vh] flex flex-col"
        data-testid="modal-voice-meds"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <SheetTitle className="text-left font-display text-[18px] text-gray-900">
            Voice Medication Assistant
          </SheetTitle>
          <SheetDescription className="sr-only">
            Speak to add a medication by voice or ask questions about medication management.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {!micSupported ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-10">
              <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
                <AlertTriangle size={24} className="text-amber-500" />
              </div>
              <div className="text-center">
                <p className="font-body text-[15px] font-semibold text-gray-800 mb-1">
                  Microphone not available
                </p>
                <p className="font-body text-[13px] text-gray-500">
                  Your browser or device doesn't support microphone access. Please use a modern browser
                  and ensure microphone permissions are granted.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-voice-meds-close-fallback"
              >
                Close
              </Button>
            </div>
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <TabsList className="mx-5 mt-3 flex-shrink-0 bg-gray-100 rounded-xl h-10">
                <TabsTrigger
                  value="add"
                  className="flex-1 rounded-lg text-[13px] font-body data-[state=active]:bg-white"
                  data-testid="tab-voice-meds-add"
                >
                  Add by voice
                </TabsTrigger>
                <TabsTrigger
                  value="ask"
                  className="flex-1 rounded-lg text-[13px] font-body data-[state=active]:bg-white"
                  data-testid="tab-voice-meds-ask"
                >
                  Ask a question
                </TabsTrigger>
              </TabsList>

              {/* Add by voice tab */}
              <TabsContent value="add" className="flex-1 flex flex-col overflow-hidden mt-0 px-5">
                <div className="flex-1 flex flex-col gap-4 overflow-hidden py-4">
                  {/* Status indicator */}
                  <MicStatusBar
                    isActive={isActive}
                    isSpeaking={isSpeaking}
                    isConnecting={isConnecting}
                    label={
                      parseState === "parsing"
                        ? "Analysing what you said..."
                        : statusLabel
                    }
                  />

                  {/* Hint */}
                  {parseState === "idle" && !isActive && (
                    <p className="font-body text-[13px] text-gray-500 text-center">
                      Say something like: <em>"I take Metformin 500mg twice a day with food, prescribed by Dr Ahmed"</em>
                    </p>
                  )}

                  {/* Transcript scroll area */}
                  {tabTranscript.length > 0 && parseState !== "confirming" && (
                    <div className="flex-1 overflow-y-auto rounded-xl bg-gray-50 border border-gray-100 p-3 flex flex-col gap-2 min-h-0">
                      {tabTranscript.map((entry) => (
                        <div
                          key={entry.timestamp}
                          className={`flex ${entry.from === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-2 font-body text-[13px] ${
                              entry.from === "user"
                                ? "bg-purple-600 text-white"
                                : "bg-white border border-gray-200 text-gray-800"
                            }`}
                          >
                            {entry.text}
                          </div>
                        </div>
                      ))}
                      <div ref={transcriptEndRef} />
                    </div>
                  )}

                  {/* Parsing spinner */}
                  {parseState === "parsing" && (
                    <div className="flex items-center justify-center gap-2 py-6">
                      <Loader2 size={20} className="animate-spin text-purple-600" />
                      <span className="font-body text-[14px] text-gray-600">Analysing your medication details…</span>
                    </div>
                  )}

                  {/* Parse error */}
                  {parseState === "error" && (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <p className="font-body text-[14px] text-red-600 text-center">
                        Couldn't analyse what you said. Please try again.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTryAgain}
                        data-testid="button-voice-meds-retry"
                      >
                        <RefreshCw size={14} className="mr-1.5" />
                        Try again
                      </Button>
                    </div>
                  )}

                  {/* Confirmation card */}
                  {parseState === "confirming" && parsedResult && (
                    <div className="flex flex-col gap-3 overflow-y-auto">
                      <p className="font-body text-[14px] font-semibold text-gray-800">
                        Here's what I heard:
                      </p>
                      <div
                        className="rounded-xl border border-purple-200 bg-purple-50 p-4 flex flex-col gap-2"
                        data-testid="card-voice-meds-parsed"
                      >
                        {!hasAnyParsed && (
                          <p className="font-body text-[13px] text-gray-500 italic">
                            No medication details were detected. Please try speaking more clearly.
                          </p>
                        )}
                        {parsedResult.name && (
                          <ParsedField label="Medication" value={parsedResult.name} testId="text-parsed-name" />
                        )}
                        {parsedResult.dosage && (
                          <ParsedField label="Dosage" value={parsedResult.dosage} testId="text-parsed-dosage" />
                        )}
                        {parsedResult.frequency && (
                          <ParsedField
                            label="Frequency"
                            value={FREQ_LABELS[parsedResult.frequency] ?? parsedResult.frequency}
                            testId="text-parsed-frequency"
                          />
                        )}
                        {parsedResult.times && (
                          <ParsedField label="Time(s)" value={parsedResult.times} testId="text-parsed-times" />
                        )}
                        {parsedResult.withFood && (
                          <ParsedField
                            label="With food?"
                            value={FOOD_LABELS[parsedResult.withFood] ?? parsedResult.withFood}
                            testId="text-parsed-food"
                          />
                        )}
                        {parsedResult.prescribedBy && (
                          <ParsedField
                            label="Prescribed by"
                            value={parsedResult.prescribedBy}
                            testId="text-parsed-prescriber"
                          />
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={handleTryAgain}
                          data-testid="button-voice-meds-tryagain"
                        >
                          <RefreshCw size={14} className="mr-1.5" />
                          Try again
                        </Button>
                        {hasAnyParsed && (
                          <Button
                            className="flex-1 bg-purple-700 hover:bg-purple-800 text-white"
                            onClick={handleConfirm}
                            data-testid="button-voice-meds-confirm"
                          >
                            <CheckCircle2 size={14} className="mr-1.5" />
                            Looks right – add it
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Start / Stop button */}
                {parseState !== "confirming" && parseState !== "parsing" && (
                  <div className="flex-shrink-0 pb-6 pt-2">
                    {isActive ? (
                      <Button
                        className="w-full h-12 bg-red-500 hover:bg-red-600 text-white font-body text-[15px] rounded-full"
                        onClick={handleStopAndParse}
                        data-testid="button-voice-meds-stop"
                      >
                        <Square size={16} className="mr-2" />
                        Stop & analyse
                      </Button>
                    ) : (
                      <Button
                        className="w-full h-12 font-body text-[15px] rounded-full"
                        style={{ background: "#6B21A8" }}
                        onClick={handleStartAdd}
                        disabled={isConnecting}
                        data-testid="button-voice-meds-start"
                      >
                        {isConnecting ? (
                          <Loader2 size={16} className="mr-2 animate-spin" />
                        ) : (
                          <Mic size={16} className="mr-2" />
                        )}
                        {isConnecting ? "Connecting…" : "Start speaking"}
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Ask a question tab */}
              <TabsContent value="ask" className="flex-1 flex flex-col overflow-hidden mt-0 px-5">
                <div className="flex-1 flex flex-col gap-4 overflow-hidden py-4">
                  {/* Status indicator */}
                  <MicStatusBar
                    isActive={isActive}
                    isSpeaking={isSpeaking}
                    isConnecting={isConnecting}
                    label={statusLabel}
                  />

                  {/* Hint */}
                  {!isActive && tabTranscript.length === 0 && (
                    <p className="font-body text-[13px] text-gray-500 text-center">
                      Ask anything about medication management, interactions, side effects, and more.
                    </p>
                  )}

                  {/* Transcript with disclaimer injection */}
                  {tabTranscript.length > 0 && (
                    <div className="flex-1 overflow-y-auto rounded-xl bg-gray-50 border border-gray-100 p-3 flex flex-col gap-2 min-h-0">
                      {tabTranscript.map((entry) => (
                        <div key={entry.timestamp} className="flex flex-col gap-1.5">
                          <div
                            className={`flex ${entry.from === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-3 py-2 font-body text-[13px] ${
                                entry.from === "user"
                                  ? "bg-purple-600 text-white"
                                  : "bg-white border border-gray-200 text-gray-800"
                              }`}
                            >
                              {entry.text}
                            </div>
                          </div>
                          {entry.from === "vyva" && (
                            <div
                              className="flex items-start gap-1.5 pl-2"
                              data-testid={`disclaimer-${entry.timestamp}`}
                            >
                              <Info size={11} className="text-amber-500 mt-0.5 flex-shrink-0" />
                              <p className="font-body text-[11px] text-amber-700 italic">{DISCLAIMER}</p>
                            </div>
                          )}
                        </div>
                      ))}
                      <div ref={transcriptEndRef} />
                    </div>
                  )}
                </div>

                {/* Disclaimer banner */}
                <div
                  className="flex-shrink-0 mx-0 mb-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2"
                  data-testid="banner-disclaimer"
                >
                  <Info size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="font-body text-[12px] text-amber-700">{DISCLAIMER}</p>
                </div>

                {/* Start / Stop button */}
                <div className="flex-shrink-0 pb-6 pt-1">
                  {isActive ? (
                    <Button
                      className="w-full h-12 bg-red-500 hover:bg-red-600 text-white font-body text-[15px] rounded-full"
                      onClick={handleStopAsk}
                      data-testid="button-voice-ask-stop"
                    >
                      <Square size={16} className="mr-2" />
                      Stop
                    </Button>
                  ) : (
                    <Button
                      className="w-full h-12 font-body text-[15px] rounded-full"
                      style={{ background: "#6B21A8" }}
                      onClick={handleStartAsk}
                      disabled={isConnecting}
                      data-testid="button-voice-ask-start"
                    >
                      {isConnecting ? (
                        <Loader2 size={16} className="mr-2 animate-spin" />
                      ) : (
                        <Mic size={16} className="mr-2" />
                      )}
                      {isConnecting ? "Connecting…" : "Ask a question"}
                    </Button>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MicStatusBar({
  isActive,
  isSpeaking,
  isConnecting,
  label,
}: {
  isActive: boolean;
  isSpeaking: boolean;
  isConnecting: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
          isActive
            ? isSpeaking
              ? "bg-green-100"
              : "bg-purple-100"
            : "bg-gray-100"
        }`}
      >
        {isConnecting ? (
          <Loader2 size={14} className="animate-spin text-gray-500" />
        ) : (
          <Mic
            size={14}
            className={
              isActive
                ? isSpeaking
                  ? "text-green-600"
                  : "text-purple-600"
                : "text-gray-400"
            }
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-body text-[13px] text-gray-700 truncate">{label}</p>
      </div>
      {isActive && (
        <div className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all ${
                isSpeaking ? "bg-green-500 animate-pulse" : "bg-purple-400"
              }`}
              style={{ height: isSpeaking ? `${12 + i * 4}px` : "8px" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ParsedField({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="font-body text-[12px] text-gray-500 flex-shrink-0">{label}</span>
      <span
        className="font-body text-[13px] font-semibold text-gray-800 text-right"
        data-testid={testId}
      >
        {value}
      </span>
    </div>
  );
}

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, RefreshCw, CheckCircle2, Loader2, AlertTriangle, Info } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";

const DISCLAIMER =
  "This information is for general guidance only — always consult your doctor or allergist before making health decisions.";

const ALLERGY_QA_PROMPT_SUFFIX = `IMPORTANT INSTRUCTION — ALLERGY Q&A MODE:
You are answering allergy-related questions. Focus on natural remedies, avoidance strategies, symptom management tips, and lifestyle advice for allergy sufferers. After every single response you give, you MUST append this disclaimer verbatim on a new line: "${DISCLAIMER}"
This disclaimer must appear at the end of every spoken and written response without exception.`;

type ParseState = "idle" | "parsing" | "confirming" | "error";

function hasMicSupport(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

interface VoiceAllergiesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddAllergies: (allergens: string[]) => void;
}

export default function VoiceAllergiesModal({
  open,
  onOpenChange,
  onAddAllergies,
}: VoiceAllergiesModalProps) {
  const [activeTab, setActiveTab] = useState<"add" | "ask">("add");
  const [parseState, setParseState] = useState<ParseState>("idle");
  const [parsedAllergens, setParsedAllergens] = useState<string[]>([]);
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
    setParsedAllergens([]);
  }, [transcript.length]);

  const handleTabChange = useCallback(
    async (tab: string) => {
      if (isActive) await stopVoice();
      setActiveTab(tab as "add" | "ask");
      sessionStartIdx.current = transcript.length;
      setParseState("idle");
      setParsedAllergens([]);
    },
    [isActive, stopVoice, transcript.length]
  );

  const handleClose = useCallback(async () => {
    if (isActive || isConnecting) await stopVoice();
    onOpenChange(false);
  }, [isActive, isConnecting, stopVoice, onOpenChange]);

  const handleStartAdd = useCallback(async () => {
    sessionStartIdx.current = transcript.length;
    setParseState("idle");
    setParsedAllergens([]);
    await startVoice("allergy details entry");
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
      const res = await fetch("/api/allergies-voice-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: userText }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { allergens: string[] } = await res.json();
      setParsedAllergens(data.allergens ?? []);
      setParseState("confirming");
    } catch {
      setParseState("error");
    }
  }, [transcript, stopVoice]);

  const handleStartAsk = useCallback(async () => {
    sessionStartIdx.current = transcript.length;
    await startVoice("allergy management questions", ALLERGY_QA_PROMPT_SUFFIX);
  }, [transcript.length, startVoice]);

  const handleStopAsk = useCallback(async () => {
    await stopVoice();
  }, [stopVoice]);

  const handleConfirm = useCallback(() => {
    if (parsedAllergens.length === 0) return;
    onAddAllergies(parsedAllergens);
    onOpenChange(false);
  }, [parsedAllergens, onAddAllergies, onOpenChange]);

  const handleTryAgain = useCallback(() => {
    resetSession();
  }, [resetSession]);

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="bottom"
        className="rounded-t-[24px] px-0 pb-0 max-h-[90vh] flex flex-col"
        data-testid="modal-voice-allergies"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <SheetTitle className="text-left font-display text-[18px] text-gray-900">
            Voice Allergy Assistant
          </SheetTitle>
          <SheetDescription className="sr-only">
            Speak to add allergens by voice or ask questions about allergy management.
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
                  Your browser or device doesn't support microphone access. Please use a modern
                  browser and ensure microphone permissions are granted.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-voice-allergies-close-fallback"
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
                  data-testid="tab-voice-allergies-add"
                >
                  Add by voice
                </TabsTrigger>
                <TabsTrigger
                  value="ask"
                  className="flex-1 rounded-lg text-[13px] font-body data-[state=active]:bg-white"
                  data-testid="tab-voice-allergies-ask"
                >
                  Ask about allergies
                </TabsTrigger>
              </TabsList>

              {/* Add by voice tab */}
              <TabsContent value="add" className="flex-1 flex flex-col overflow-hidden mt-0 px-5">
                <div className="flex-1 flex flex-col gap-4 overflow-hidden py-4">
                  <MicStatusBar
                    isActive={isActive}
                    isSpeaking={isSpeaking}
                    isConnecting={isConnecting}
                    label={
                      parseState === "parsing"
                        ? "Identifying your allergens..."
                        : statusLabel
                    }
                  />

                  {parseState === "idle" && !isActive && (
                    <p className="font-body text-[13px] text-gray-500 text-center">
                      Say something like:{" "}
                      <em>"I'm allergic to peanuts, tree nuts, and penicillin"</em>
                    </p>
                  )}

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
                                ? "bg-amber-500 text-white"
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

                  {parseState === "parsing" && (
                    <div className="flex items-center justify-center gap-2 py-6">
                      <Loader2 size={20} className="animate-spin text-amber-500" />
                      <span className="font-body text-[14px] text-gray-600">
                        Identifying your allergens…
                      </span>
                    </div>
                  )}

                  {parseState === "error" && (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <p className="font-body text-[14px] text-red-600 text-center">
                        Couldn't identify any allergens. Please try again.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTryAgain}
                        data-testid="button-voice-allergies-retry"
                      >
                        <RefreshCw size={14} className="mr-1.5" />
                        Try again
                      </Button>
                    </div>
                  )}

                  {parseState === "confirming" && (
                    <div className="flex flex-col gap-3 overflow-y-auto">
                      <p className="font-body text-[14px] font-semibold text-gray-800">
                        Here's what I heard:
                      </p>
                      <div
                        className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col gap-2"
                        data-testid="card-voice-allergies-parsed"
                      >
                        {parsedAllergens.length === 0 ? (
                          <p className="font-body text-[13px] text-gray-500 italic">
                            No allergens were detected. Please try speaking more clearly.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {parsedAllergens.map((a) => (
                              <span
                                key={a}
                                className="inline-flex items-center gap-1 bg-white text-amber-800 text-[12px] px-3 py-1.5 rounded-full border border-amber-200 font-medium"
                                data-testid={`tag-parsed-allergen-${a.replace(/\s+/g, "-").toLowerCase()}`}
                              >
                                <CheckCircle2 size={11} className="text-amber-600" />
                                {a}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={handleTryAgain}
                          data-testid="button-voice-allergies-tryagain"
                        >
                          <RefreshCw size={14} className="mr-1.5" />
                          Try again
                        </Button>
                        {parsedAllergens.length > 0 && (
                          <Button
                            className="flex-1 text-white font-body"
                            style={{ background: "#B45309" }}
                            onClick={handleConfirm}
                            data-testid="button-voice-allergies-confirm"
                          >
                            <CheckCircle2 size={14} className="mr-1.5" />
                            Add {parsedAllergens.length === 1 ? "it" : "them"}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {parseState !== "confirming" && parseState !== "parsing" && (
                  <div className="flex-shrink-0 pb-6 pt-2">
                    {isActive ? (
                      <Button
                        className="w-full h-12 bg-red-500 hover:bg-red-600 text-white font-body text-[15px] rounded-full"
                        onClick={handleStopAndParse}
                        data-testid="button-voice-allergies-stop"
                      >
                        <Square size={16} className="mr-2" />
                        Stop & identify
                      </Button>
                    ) : (
                      <Button
                        className="w-full h-12 font-body text-[15px] rounded-full text-white"
                        style={{ background: "#B45309" }}
                        onClick={handleStartAdd}
                        disabled={isConnecting}
                        data-testid="button-voice-allergies-start"
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

              {/* Ask about allergies tab */}
              <TabsContent value="ask" className="flex-1 flex flex-col overflow-hidden mt-0 px-5">
                <div className="flex-1 flex flex-col gap-4 overflow-hidden py-4">
                  <MicStatusBar
                    isActive={isActive}
                    isSpeaking={isSpeaking}
                    isConnecting={isConnecting}
                    label={statusLabel}
                  />

                  {!isActive && tabTranscript.length === 0 && (
                    <p className="font-body text-[13px] text-gray-500 text-center">
                      Ask about natural remedies, avoidance tips, symptom management, and more.
                    </p>
                  )}

                  {tabTranscript.length > 0 && (
                    <div className="flex-1 overflow-y-auto rounded-xl bg-gray-50 border border-gray-100 p-3 flex flex-col gap-2 min-h-0">
                      {tabTranscript.map((entry) => (
                        <div key={entry.timestamp} className="flex flex-col gap-1.5">
                          <div
                            className={`flex ${
                              entry.from === "user" ? "justify-end" : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-3 py-2 font-body text-[13px] ${
                                entry.from === "user"
                                  ? "bg-amber-500 text-white"
                                  : "bg-white border border-gray-200 text-gray-800"
                              }`}
                            >
                              {entry.text}
                            </div>
                          </div>
                          {entry.from === "vyva" && (
                            <div
                              className="flex items-start gap-1.5 pl-2"
                              data-testid={`disclaimer-allergy-${entry.timestamp}`}
                            >
                              <Info size={11} className="text-amber-500 mt-0.5 flex-shrink-0" />
                              <p className="font-body text-[11px] text-amber-700 italic">
                                {DISCLAIMER}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                      <div ref={transcriptEndRef} />
                    </div>
                  )}
                </div>

                <div
                  className="flex-shrink-0 mx-0 mb-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2"
                  data-testid="banner-allergy-disclaimer"
                >
                  <Info size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="font-body text-[12px] text-amber-700">{DISCLAIMER}</p>
                </div>

                <div className="flex-shrink-0 pb-6 pt-1">
                  {isActive ? (
                    <Button
                      className="w-full h-12 bg-red-500 hover:bg-red-600 text-white font-body text-[15px] rounded-full"
                      onClick={handleStopAsk}
                      data-testid="button-voice-allergy-ask-stop"
                    >
                      <Square size={16} className="mr-2" />
                      Stop
                    </Button>
                  ) : (
                    <Button
                      className="w-full h-12 font-body text-[15px] rounded-full text-white"
                      style={{ background: "#B45309" }}
                      onClick={handleStartAsk}
                      disabled={isConnecting}
                      data-testid="button-voice-allergy-ask-start"
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
          isActive ? (isSpeaking ? "bg-green-100" : "bg-amber-100") : "bg-gray-100"
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
                  : "text-amber-600"
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
                isSpeaking ? "bg-green-500 animate-pulse" : "bg-amber-400"
              }`}
              style={{ height: isSpeaking ? `${12 + i * 4}px` : "8px" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

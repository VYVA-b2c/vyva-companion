// src/pages/onboarding/sections/HobbiesSection.tsx
import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useAutoSave } from "@/hooks/useAutoSave";
import { AutoSaveStatusBadge } from "@/components/onboarding/AutoSaveStatusBadge";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";
import SpeakItOverlay from "@/components/onboarding/SpeakItOverlay";
import {
  Plus,
  Dumbbell,
  Palette,
  Brain,
  Leaf,
  Music2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Mic,
  CheckCircle2,
} from "lucide-react";

// ─── Personality Quiz ────────────────────────────────────────────────────────

const PERSONALITY_QUESTIONS = [
  {
    id: "time_of_day",
    question: "Are you more of a morning person or an evening person?",
    why: "VYVA will greet you at the right time and know when you're most alert for important reminders.",
    options: ["Morning person ☀️", "Evening person 🌙", "Somewhere in between"],
  },
  {
    id: "social_preference",
    question: "Do you prefer being around people, or do you enjoy your own company?",
    why: "This helps VYVA suggest activities and topics that genuinely suit you.",
    options: ["Love being around people", "Enjoy my own company", "A good mix of both"],
  },
  {
    id: "routine_vs_spontaneity",
    question: "Do you love a good routine, or do you prefer a bit of spontaneity?",
    why: "VYVA can tailor how it structures your day based on how you like to live.",
    options: ["Routine and predictability", "Love surprises!", "Depends on the day"],
  },
  {
    id: "joy_source",
    question: "What is your biggest source of joy?",
    why: "VYVA will weave the things that matter most to you into your daily conversations.",
    options: ["Family and friends", "Nature and outdoors", "Creative pursuits", "Learning something new", "Peaceful moments"],
  },
  {
    id: "free_time",
    question: "How do you most enjoy spending a free afternoon?",
    why: "Knowing this helps VYVA make thoughtful suggestions when you have time to spare.",
    options: ["Getting out and about", "Relaxing at home", "Being creative", "Catching up with people"],
  },
];

// ─── Hobby Groups ─────────────────────────────────────────────────────────────

type HobbyGroup = {
  label: string;
  Icon: React.ElementType;
  items: string[];
};

const HOBBY_GROUPS: HobbyGroup[] = [
  { label: "Sports & activity",  Icon: Dumbbell,  items: ["Walking","Swimming","Cycling","Yoga / Pilates","Golf","Football","Tennis","Bowls","Dancing"] },
  { label: "Creative",           Icon: Palette,   items: ["Painting / Drawing","Knitting / Sewing","Photography","Pottery","Writing","Singing / Choir"] },
  { label: "Mind & games",       Icon: Brain,     items: ["Reading","Chess","Crosswords","Puzzles","Card games","Board games"] },
  { label: "Nature",             Icon: Leaf,      items: ["Gardening","Bird watching","Fishing"] },
  { label: "Culture & social",   Icon: Music2,    items: ["Music","Theatre / Opera","Cinema / TV","History","Travel","Volunteering","Faith community","Book club","Cooking / Baking"] },
  { label: "Learning",           Icon: BookOpen,  items: ["Languages","Local history","Online courses","Computers / Tech"] },
];

const ALL_PRESET_ITEMS = new Set(HOBBY_GROUPS.flatMap((g) => g.items));

// ─── Voice matching ───────────────────────────────────────────────────────────

const HOBBY_SYNONYMS: Record<string, string> = {
  "painting":      "Painting / Drawing",
  "drawing":       "Painting / Drawing",
  "sketching":     "Painting / Drawing",
  "cooking":       "Cooking / Baking",
  "baking":        "Cooking / Baking",
  "bake":          "Cooking / Baking",
  "cook":          "Cooking / Baking",
  "yoga":          "Yoga / Pilates",
  "pilates":       "Yoga / Pilates",
  "knitting":      "Knitting / Sewing",
  "sewing":        "Knitting / Sewing",
  "crochet":       "Knitting / Sewing",
  "birdwatching":  "Bird watching",
  "bird watch":    "Bird watching",
  "birds":         "Bird watching",
  "theatre":       "Theatre / Opera",
  "theater":       "Theatre / Opera",
  "opera":         "Theatre / Opera",
  "cinema":        "Cinema / TV",
  "movies":        "Cinema / TV",
  "television":    "Cinema / TV",
  "films":         "Cinema / TV",
  "computers":     "Computers / Tech",
  "technology":    "Computers / Tech",
  "tech":          "Computers / Tech",
  "church":        "Faith community",
  "mosque":        "Faith community",
  "synagogue":     "Faith community",
  "temple":        "Faith community",
  "choir":         "Singing / Choir",
  "singing":       "Singing / Choir",
  "sing":          "Singing / Choir",
  "photos":        "Photography",
  "photograph":    "Photography",
  "soccer":        "Football",
  "hiking":        "Walking",
  "walks":         "Walking",
  "books":         "Reading",
  "jigsaw":        "Puzzles",
  "cards":         "Card games",
  "board game":    "Board games",
  "travelling":    "Travel",
  "traveling":     "Travel",
  "dancing":       "Dancing",
  "dance":         "Dancing",
  "crossword":     "Crosswords",
  "local history": "Local history",
  "volunteering":  "Volunteering",
  "volunteer":     "Volunteering",
};

function matchHobbiesFromTranscript(transcript: string): string[] {
  const lower = transcript.toLowerCase();
  const matched = new Set<string>();

  for (const [phrase, canonical] of Object.entries(HOBBY_SYNONYMS)) {
    if (lower.includes(phrase)) {
      const found = Array.from(ALL_PRESET_ITEMS).find(
        (h) => h.toLowerCase() === canonical.toLowerCase()
      );
      if (found) matched.add(found);
    }
  }

  for (const name of ALL_PRESET_ITEMS) {
    if (matched.has(name)) continue;
    if (lower.includes(name.toLowerCase())) matched.add(name);
  }

  return Array.from(matched);
}

// ─── Follow-up question config ────────────────────────────────────────────────

type FollowUpConfig = {
  label: string;
  hint: string;
  type: "chips" | "text";
  chips?: string[];
  multi?: boolean;
};

const FOLLOW_UP_MAP: Record<string, FollowUpConfig> = {
  "Football": {
    label: "Which football team do you support?",
    hint: "e.g. Arsenal, Celtic, Real Madrid…",
    type: "chips",
    chips: ["Arsenal","Aston Villa","Celtic","Chelsea","Everton","Liverpool","Manchester City","Manchester United","Newcastle","Rangers","Tottenham","West Ham","Other"],
  },
  "Tennis": {
    label: "Who is your favourite tennis player, and why do you love them?",
    hint: "e.g. Andy Murray, because he never gives up",
    type: "text",
  },
  "Golf": {
    label: "Do you play, watch, or both?",
    hint: "",
    type: "chips",
    chips: ["I play golf", "I watch golf", "Both"],
  },
  "Music": {
    label: "What genre or era of music do you love most?",
    hint: "",
    type: "chips",
    chips: ["60s & 70s classics","80s pop","Jazz","Classical","Country","Soul & R&B","Rock","Folk","Other"],
  },
  "Painting / Drawing": {
    label: "What style of art do you enjoy most?",
    hint: "",
    type: "chips",
    chips: ["Watercolour","Oils","Sketching","Acrylics","Digital art","Collage","Other"],
  },
  "Photography": {
    label: "What do you love to photograph?",
    hint: "",
    type: "chips",
    chips: ["Nature & wildlife","People & portraits","Landscapes","Street scenes","Travel","Family moments","Other"],
  },
  "Writing": {
    label: "What do you like to write?",
    hint: "",
    type: "chips",
    chips: ["Personal diary","Short stories","Poetry","Memoirs","Letters","Other"],
  },
  "Cooking / Baking": {
    label: "What do you most enjoy making?",
    hint: "",
    type: "chips",
    multi: true,
    chips: ["Hearty meals","Baking & cakes","World cuisines","Healthy dishes","Batch cooking","Other"],
  },
  "Gardening": {
    label: "What do you love to grow or tend to?",
    hint: "",
    type: "chips",
    chips: ["Flowers","Vegetables & herbs","Trees & shrubs","Pots & containers","Just the lawn","Other"],
  },
  "Theatre / Opera": {
    label: "Do you prefer theatre, opera, or both?",
    hint: "",
    type: "chips",
    chips: ["Theatre", "Opera", "Musical theatre", "All of the above"],
  },
  "Travel": {
    label: "Where in the world would you most love to go — or have been?",
    hint: "e.g. Italy, a Scottish loch, somewhere warm…",
    type: "text",
  },
  "Reading": {
    label: "What genres do you enjoy reading?",
    hint: "",
    type: "chips",
    chips: ["Crime & thrillers","Historical fiction","Biography","Romance","Science fiction","Nature & travel","Poetry","Other"],
  },
  "Dancing": {
    label: "What style of dancing do you enjoy?",
    hint: "",
    type: "chips",
    chips: ["Ballroom","Sequence","Line dancing","Tap","Ballet","Folk / Ceilidh","Other"],
  },
};

// ─── Main component ───────────────────────────────────────────────────────────

type HobbiesPayload = {
  hobbies?: string[];
  followUps?: Record<string, string>;
  personality?: Record<string, string>;
};

export default function HobbiesSection() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [selected, setSelected] = useState<string[]>([]);
  const [followUps, setFollowUps] = useState<Record<string, string>>({});
  const [personality, setPersonality] = useState<Record<string, string>>({});
  const [quizStep, setQuizStep] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [speakItOpen, setSpeakItOpen] = useState(false);
  const [speakItMatches, setSpeakItMatches] = useState<string[]>([]);

  const selectedRef = useRef(selected);
  const followUpsRef = useRef(followUps);
  const personalityRef = useRef(personality);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { followUpsRef.current = followUps; }, [followUps]);
  useEffect(() => { personalityRef.current = personality; }, [personality]);

  type ConsentShape = { hobbies?: HobbiesPayload } | null;
  const { data, isLoading } = useQuery<{ profile: { data_sharing_consent?: ConsentShape } | null }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    if (!data) return;
    const consent = data?.profile?.data_sharing_consent as ConsentShape;
    const saved = consent?.hobbies;
    if (saved?.hobbies && Array.isArray(saved.hobbies)) setSelected(saved.hobbies);
    if (saved?.followUps) setFollowUps(saved.followUps);
    if (saved?.personality) {
      setPersonality(saved.personality);
      const answeredCount = Object.keys(saved.personality).length;
      if (answeredCount >= PERSONALITY_QUESTIONS.length) {
        setQuizDone(true);
        setQuizStep(PERSONALITY_QUESTIONS.length - 1);
      } else if (answeredCount > 0) {
        setQuizStep(answeredCount);
      }
    }
  }, [data]);

  const { autoSaveStatus, savedFading, retryCountdown, retryNow, scheduleAutoSave, cancelAutoSave } = useAutoSave(
    async () => {
      const res = await apiFetch("/api/onboarding/section/hobbies", {
        method: "POST",
        body: JSON.stringify({
          hobbies: selectedRef.current,
          followUps: followUpsRef.current,
          personality: personalityRef.current,
        }),
      });
      if (!res.ok) {
        const msg = await friendlyError(new Error(), res);
        throw new Error(msg);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
    },
    2000,
  );

  // ── Personality quiz helpers ──────────────────────────────────────────────

  const currentQuestion = PERSONALITY_QUESTIONS[quizStep];
  const totalQuizSteps = PERSONALITY_QUESTIONS.length;

  const handlePersonalityAnswer = (answer: string) => {
    const updated = { ...personalityRef.current, [currentQuestion.id]: answer };
    setPersonality(updated);
    scheduleAutoSave();
    if (quizStep < totalQuizSteps - 1) {
      setQuizStep((s) => s + 1);
    } else {
      setQuizDone(true);
    }
  };

  const handlePersonalityBack = () => {
    if (quizStep > 0) setQuizStep((s) => s - 1);
  };

  const handlePersonalityNext = () => {
    if (quizStep < totalQuizSteps - 1) setQuizStep((s) => s + 1);
  };

  // ── Hobby helpers ─────────────────────────────────────────────────────────

  const toggleHobby = (hobby: string) => {
    const isSelected = selected.includes(hobby);
    let updated: string[];
    if (isSelected) {
      updated = selected.filter((s) => s !== hobby);
      if (FOLLOW_UP_MAP[hobby]) {
        const newFollowUps = { ...followUpsRef.current };
        delete newFollowUps[hobby];
        setFollowUps(newFollowUps);
      }
    } else {
      updated = [...selected, hobby];
    }
    setSelected(updated);
    scheduleAutoSave();
  };

  const handleFollowUpChange = (hobby: string, value: string) => {
    const updated = { ...followUps, [hobby]: value };
    setFollowUps(updated);
    scheduleAutoSave();
  };

  const handleSpeakItDone = (transcript: string) => {
    setSpeakItOpen(false);
    if (!transcript) return;
    const matches = matchHobbiesFromTranscript(transcript);
    if (matches.length === 0) {
      toast({
        title: "No hobbies recognised",
        description: "Try speaking more slowly or select your hobbies manually below.",
      });
      return;
    }
    const alreadySelected = matches.filter((h) => selected.includes(h));
    const newMatches = matches.filter((h) => !selected.includes(h));
    if (newMatches.length === 0 && alreadySelected.length > 0) {
      toast({ title: "Those hobbies are already selected" });
      return;
    }
    setSpeakItMatches(newMatches.length > 0 ? newMatches : matches);
  };

  const confirmSpeakItMatches = () => {
    const updated = Array.from(new Set([...selected, ...speakItMatches]));
    setSelected(updated);
    setSpeakItMatches([]);
    scheduleAutoSave();
    toast({ title: `${speakItMatches.length} ${speakItMatches.length === 1 ? "hobby" : "hobbies"} added` });
  };

  const addCustom = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const lower = value.toLowerCase();
    if (selected.some((s) => s.toLowerCase() === lower)) {
      setCustomInput("");
      return;
    }
    const updated = [...selected, value];
    setSelected(updated);
    setCustomInput("");
    scheduleAutoSave();
  };

  const removeItem = (item: string) => {
    setSelected((prev) => prev.filter((s) => s !== item));
    if (FOLLOW_UP_MAP[item]) {
      const newFollowUps = { ...followUps };
      delete newFollowUps[item];
      setFollowUps(newFollowUps);
    }
    scheduleAutoSave();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustom(customInput);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    cancelAutoSave();
    setSaving(true);
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/hobbies", {
        method: "POST",
        body: JSON.stringify({
          hobbies: selected,
          followUps,
          personality,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
      navigate("/onboarding/complete/hobbies");
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save hobbies", description: msg, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const customSelected = selected.filter((s) => !ALL_PRESET_ITEMS.has(s));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PhoneFrame
      subtitle="⭐ Hobbies & interests"
      showBack
      onBack={() => navigate("/onboarding/profile")}
      showAllSections
      onAllSections={() => navigate("/onboarding/profile")}
    >
      <div className="flex flex-col gap-6 px-4 py-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-vyva-text-1">⭐ Hobbies & interests</h2>
            <p className="text-[15px] text-vyva-text-2 mt-1.5 leading-relaxed">
              The more VYVA knows about what you love, the more it feels like a real companion — not just a bot. These answers shape every conversation.
            </p>
          </div>
          <AutoSaveStatusBadge
            autoSaveStatus={autoSaveStatus}
            savedFading={savedFading}
            retryCountdown={retryCountdown}
            onRetryNow={retryNow}
            testId="status-hobbies-autosave"
          />
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* ── Speak it ──────────────────────────────────────────────── */}
            <button
              type="button"
              data-testid="button-hobbies-speak-it"
              onClick={() => setSpeakItOpen(true)}
              className="flex items-center gap-3 w-full rounded-2xl px-4 py-3 text-left transition-colors"
              style={{ background: "#F5F3FF", border: "1px solid #EDE9FE" }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse-ring"
                style={{ background: "linear-gradient(135deg, #5B12A0 0%, #7C3AED 100%)" }}
              >
                <Mic size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body text-[15px] font-semibold" style={{ color: "#6B21A8" }}>
                  Speak it
                </p>
                <p className="font-body text-[13px]" style={{ color: "#7C3AED" }}>
                  Just say what you enjoy and VYVA will select for you
                </p>
              </div>
            </button>

            {/* Confirmation panel for matched hobbies */}
            {speakItMatches.length > 0 && (
              <div
                className="rounded-2xl px-4 py-3"
                style={{ background: "#ECFDF5", border: "1px solid #A7F3D0" }}
                data-testid="panel-hobbies-speak-it-confirm"
              >
                <p className="font-body text-[14px] font-semibold text-green-800 mb-2">
                  VYVA found {speakItMatches.length} {speakItMatches.length === 1 ? "hobby" : "hobbies"}:
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {speakItMatches.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 bg-white text-green-800 text-[13px] px-3 py-1 rounded-full border border-green-200 font-medium"
                    >
                      <CheckCircle2 size={12} className="text-green-600" />
                      {name}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSpeakItMatches([])}
                    className="flex-1 py-2 rounded-full font-body text-[14px] font-medium text-gray-600 bg-white border border-gray-200 min-h-[44px]"
                    data-testid="button-hobbies-speak-it-dismiss"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={confirmSpeakItMatches}
                    className="flex-1 py-2 rounded-full font-body text-[14px] font-medium text-white min-h-[44px]"
                    style={{ background: "#0A7C4E" }}
                    data-testid="button-hobbies-speak-it-confirm"
                  >
                    Add these
                  </button>
                </div>
              </div>
            )}

            {/* SpeakIt overlay */}
            {speakItOpen && (
              <SpeakItOverlay
                title="Tell VYVA your hobbies"
                hint='e.g. "I love walking, reading and cooking"'
                onDone={handleSpeakItDone}
                onCancel={() => setSpeakItOpen(false)}
              />
            )}

            {/* ── Personality quiz ───────────────────────────────────────── */}
            <PersonalityQuiz
              questions={PERSONALITY_QUESTIONS}
              personality={personality}
              quizStep={quizStep}
              quizDone={quizDone}
              currentQuestion={currentQuestion}
              totalSteps={totalQuizSteps}
              onAnswer={handlePersonalityAnswer}
              onBack={handlePersonalityBack}
              onNext={handlePersonalityNext}
              onReopen={() => setQuizDone(false)}
            />

            {/* ── Custom hobby input ─────────────────────────────────────── */}
            <div className="bg-vyva-purple-pale border border-vyva-border rounded-2xl p-4">
              <p className="text-[13px] font-bold text-vyva-text-2 uppercase tracking-wider mb-1">
                Add your own hobby
              </p>
              <p className="text-[14px] text-vyva-text-2 mb-3">
                Can't find something you love? Type it here.
              </p>
              <div className="flex gap-2">
                <Input
                  data-testid="input-hobbies-custom"
                  placeholder="Type a hobby and press Enter or Add"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-12 border-vyva-border text-[15px] flex-1"
                />
                <button
                  type="button"
                  data-testid="button-hobbies-add-custom"
                  onClick={() => addCustom(customInput)}
                  disabled={!customInput.trim()}
                  className="flex items-center gap-1.5 px-4 h-12 rounded-xl bg-vyva-purple text-white text-[14px] font-bold disabled:opacity-40 shrink-0"
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>

              {customSelected.length > 0 && (
                <div
                  data-testid="list-hobbies-custom"
                  className="flex flex-wrap gap-2 mt-3"
                >
                  {customSelected.map((h) => (
                    <span
                      key={h}
                      data-testid={`tag-hobby-${h.replace(/\s+/g, "-").toLowerCase()}`}
                      className="inline-flex items-center gap-1.5 bg-vyva-purple text-white text-[13px] font-semibold px-3 py-1.5 rounded-full"
                    >
                      {h}
                      <button
                        type="button"
                        data-testid={`button-remove-hobby-${h.replace(/\s+/g, "-").toLowerCase()}`}
                        onClick={() => removeItem(h)}
                        className="opacity-80 hover:opacity-100 leading-none text-[16px]"
                        aria-label={`Remove ${h}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Grouped hobby chips — accordion ────────────────────────── */}
            <div className="flex flex-col gap-2">
              {HOBBY_GROUPS.map((group) => (
                <HobbyGroupSection
                  key={group.label}
                  group={group}
                  selected={selected}
                  followUps={followUps}
                  isOpen={openGroup === group.label}
                  onToggleOpen={() => setOpenGroup((prev) => prev === group.label ? null : group.label)}
                  onToggle={toggleHobby}
                  onFollowUpChange={handleFollowUpChange}
                />
              ))}
            </div>
          </>
        )}

        {/* Save button */}
        <div className="flex flex-col gap-2 pt-2">
          <Button
            data-testid="button-hobbies-save"
            onClick={handleSave}
            disabled={saving || isLoading}
            className="w-full h-14 text-[16px] font-bold bg-vyva-purple hover:bg-[#5b1a8f]"
          >
            {saving ? "Saving..." : "Save hobbies & interests"}
          </Button>
          <button
            data-testid="button-hobbies-skip"
            onClick={() => navigate("/onboarding/profile")}
            className="text-[14px] text-vyva-text-3 py-2 text-center"
          >
            Skip for now
          </button>
        </div>
      </div>
    </PhoneFrame>
  );
}

// ─── Personality Quiz Card ────────────────────────────────────────────────────

type QuizQuestion = typeof PERSONALITY_QUESTIONS[number];

function PersonalityQuiz({
  questions,
  personality,
  quizStep,
  quizDone,
  currentQuestion,
  totalSteps,
  onAnswer,
  onBack,
  onNext,
  onReopen,
}: {
  questions: QuizQuestion[];
  personality: Record<string, string>;
  quizStep: number;
  quizDone: boolean;
  currentQuestion: QuizQuestion;
  totalSteps: number;
  onAnswer: (answer: string) => void;
  onBack: () => void;
  onNext: () => void;
  onReopen: () => void;
}) {
  if (quizDone) {
    return (
      <div
        data-testid="card-personality-complete"
        className="bg-vyva-green-light border border-vyva-border rounded-2xl p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-vyva-green flex items-center justify-center shrink-0">
              <Check size={16} className="text-white" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-vyva-text-1">Personality questions done</p>
              <p className="text-[13px] text-vyva-text-2">VYVA is getting to know you already!</p>
            </div>
          </div>
          <button
            type="button"
            data-testid="button-personality-reopen"
            onClick={onReopen}
            className="text-[13px] text-vyva-purple font-semibold underline underline-offset-2 shrink-0"
          >
            Review
          </button>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(personality).length;

  return (
    <div
      data-testid="card-personality-quiz"
      className="bg-gradient-to-br from-vyva-purple-pale to-white border border-vyva-purple/20 rounded-2xl p-4 shadow-sm"
    >
      {/* Header */}
      <div className="mb-3">
        <p className="text-[13px] font-bold text-vyva-purple uppercase tracking-wider mb-0.5">
          A little about you
        </p>
        <p className="text-[13px] text-vyva-text-2">
          5 quick questions to help VYVA feel like it truly knows you.
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 mb-4" aria-label="Quiz progress">
        {questions.map((q, idx) => (
          <div
            key={q.id}
            data-testid={`dot-quiz-${idx}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              idx < answeredCount
                ? "bg-vyva-purple w-5"
                : idx === quizStep
                ? "bg-vyva-purple/50 w-4"
                : "bg-vyva-border w-2"
            }`}
          />
        ))}
      </div>

      {/* Question */}
      <p className="text-[17px] font-bold text-vyva-text-1 mb-1.5 leading-snug">
        {currentQuestion.question}
      </p>
      <p className="text-[13px] text-vyva-text-2 mb-4 italic leading-relaxed">
        💬 {currentQuestion.why}
      </p>

      {/* Answer options */}
      <div className="flex flex-col gap-2" role="group" aria-label="Answer options">
        {currentQuestion.options.map((opt) => {
          const isSelected = personality[currentQuestion.id] === opt;
          return (
            <button
              key={opt}
              type="button"
              data-testid={`button-quiz-option-${opt.replace(/\s+/g, "-").replace(/[^\w-]/g, "").toLowerCase()}`}
              onClick={() => onAnswer(opt)}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 text-[15px] font-medium transition-all ${
                isSelected
                  ? "bg-vyva-purple text-white border-vyva-purple"
                  : "bg-white text-vyva-text-1 border-vyva-border hover:border-vyva-purple/50"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-4">
        <button
          type="button"
          data-testid="button-quiz-back"
          onClick={onBack}
          disabled={quizStep === 0}
          className="flex items-center gap-1 text-[14px] text-vyva-text-2 disabled:opacity-30"
        >
          <ChevronLeft size={16} />
          Back
        </button>
        <span className="text-[13px] text-vyva-text-3">
          {quizStep + 1} of {totalSteps}
        </span>
        {personality[currentQuestion.id] && quizStep < totalSteps - 1 && (
          <button
            type="button"
            data-testid="button-quiz-next"
            onClick={onNext}
            className="flex items-center gap-1 text-[14px] text-vyva-purple font-semibold"
          >
            Next
            <ChevronRight size={16} />
          </button>
        )}
        {!personality[currentQuestion.id] && (
          <span className="text-[13px] text-vyva-text-3 opacity-50">Choose an option</span>
        )}
      </div>
    </div>
  );
}

// ─── Hobby Group Section ──────────────────────────────────────────────────────

function HobbyGroupSection({
  group,
  selected,
  followUps,
  isOpen,
  onToggleOpen,
  onToggle,
  onFollowUpChange,
}: {
  group: HobbyGroup;
  selected: string[];
  followUps: Record<string, string>;
  isOpen: boolean;
  onToggleOpen: () => void;
  onToggle: (hobby: string) => void;
  onFollowUpChange: (hobby: string, value: string) => void;
}) {
  const { Icon } = group;
  const selectedCount = group.items.filter((item) => selected.includes(item)).length;
  const triggeredHobbies = group.items.filter(
    (item) => selected.includes(item) && FOLLOW_UP_MAP[item]
  );
  const hasSelections = selectedCount > 0;

  return (
    <div
      data-testid={`section-hobby-group-${group.label.replace(/\s+/g, "-").toLowerCase()}`}
      className="rounded-[14px] overflow-hidden"
      style={{
        border: hasSelections ? "1px solid #A78BFA" : "1px solid #EDE5DB",
        background: hasSelections ? "#FAF8FF" : "#FFFFFF",
      }}
    >
      {/* Accordion header */}
      <button
        type="button"
        data-testid={`accordion-hobby-${group.label.replace(/\s+/g, "-").toLowerCase()}`}
        onClick={onToggleOpen}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-vyva-purple-light flex items-center justify-center shrink-0">
          <Icon size={15} className="text-vyva-purple" />
        </div>
        <span className="flex-1 font-body text-[14px] font-semibold text-vyva-text-1">{group.label}</span>
        {hasSelections && (
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: "#EDE9FE", color: "#6B21A8" }}
            data-testid={`badge-count-hobby-${group.label.replace(/\s+/g, "-").toLowerCase()}`}
          >
            {selectedCount} selected
          </span>
        )}
        <ChevronDown
          size={16}
          className="flex-shrink-0 text-gray-400 transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* Accordion body */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: isOpen ? "2000px" : "0px" }}
      >
        <div className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {group.items.map((item) => {
              const active = selected.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  data-testid={`chip-hobby-${item.replace(/[\s/]+/g, "-").replace(/[^\w-]/g, "").toLowerCase()}`}
                  onClick={() => onToggle(item)}
                  className={`min-h-[40px] px-4 py-1.5 rounded-full text-[14px] font-medium border-2 transition-all ${
                    active
                      ? "bg-vyva-purple text-white border-vyva-purple"
                      : "bg-white text-vyva-text-1 border-vyva-border hover:border-vyva-purple/50 hover:text-vyva-purple"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>

          {triggeredHobbies.map((hobby) => (
            <FollowUpCard
              key={hobby}
              hobby={hobby}
              config={FOLLOW_UP_MAP[hobby]}
              currentValue={followUps[hobby] || ""}
              onChange={(val) => onFollowUpChange(hobby, val)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Follow-up Card ────────────────────────────────────────────────────────────

function FollowUpCard({
  hobby,
  config,
  currentValue,
  onChange,
}: {
  hobby: string;
  config: FollowUpConfig;
  currentValue: string;
  onChange: (val: string) => void;
}) {
  const isMulti = config.multi === true;
  const normalChips = config.type === "chips" ? (config.chips ?? []).filter(c => c !== "Other") : [];
  const hasOtherChip = config.type === "chips" && (config.chips ?? []).includes("Other");

  // Multi-select: value is a comma-separated list of selected chips
  const multiSelected = isMulti
    ? currentValue.split(",").map(s => s.trim()).filter(Boolean)
    : [];

  // Single-select: detect if the stored value is a custom "Other" entry
  const valueIsCustom = !isMulti && hasOtherChip && currentValue !== "" && !normalChips.includes(currentValue);
  const [otherActive, setOtherActive] = useState(valueIsCustom);
  const [otherText, setOtherText] = useState(valueIsCustom ? currentValue : "");
  const loadedRef = useRef(false);

  // Sync custom "Other" state when a single-select value arrives from the server
  useEffect(() => {
    if (isMulti || loadedRef.current || !currentValue) return;
    loadedRef.current = true;
    if (hasOtherChip && !normalChips.includes(currentValue)) {
      setOtherActive(true);
      setOtherText(currentValue);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentValue]);

  const handleMultiChipClick = (chip: string) => {
    const next = multiSelected.includes(chip)
      ? multiSelected.filter(c => c !== chip)
      : [...multiSelected, chip];
    onChange(next.join(","));
  };

  const handleSingleChipClick = (chip: string) => {
    if (chip === "Other") {
      if (otherActive) {
        setOtherActive(false);
        setOtherText("");
        onChange("");
      } else {
        setOtherActive(true);
        setOtherText("");
        onChange("");
      }
    } else {
      setOtherActive(false);
      setOtherText("");
      onChange(currentValue === chip ? "" : chip);
    }
  };

  const hobbySlug = hobby.replace(/[\s/]+/g, "-").replace(/[^\w-]/g, "").toLowerCase();

  return (
    <div
      data-testid={`card-followup-${hobbySlug}`}
      className="mt-3 bg-vyva-purple-pale border border-vyva-purple/20 rounded-xl p-3.5 animate-in fade-in slide-in-from-top-1 duration-200"
    >
      <p className="text-[13px] font-bold text-vyva-purple mb-0.5">
        Follow-up{isMulti && <span className="font-normal normal-case ml-1 opacity-70">(pick all that apply)</span>}
      </p>
      <p className="text-[15px] font-semibold text-vyva-text-1 mb-3">{config.label}</p>

      {config.type === "chips" && config.chips ? (
        <>
          <div className="flex flex-wrap gap-2">
            {config.chips.map((chip) => {
              const active = isMulti
                ? multiSelected.includes(chip)
                : chip === "Other" ? otherActive : currentValue === chip;
              return (
                <button
                  key={chip}
                  type="button"
                  data-testid={`chip-followup-${hobbySlug}-${chip.replace(/\s+/g, "-").toLowerCase()}`}
                  onClick={() => isMulti ? handleMultiChipClick(chip) : handleSingleChipClick(chip)}
                  className={`min-h-[40px] px-3 py-1.5 rounded-full text-[14px] font-medium border-2 transition-all ${
                    active
                      ? "bg-vyva-purple text-white border-vyva-purple"
                      : "bg-white text-vyva-text-1 border-vyva-border hover:border-vyva-purple/50"
                  }`}
                >
                  {chip}
                </button>
              );
            })}
          </div>
          {!isMulti && otherActive && (
            <Input
              data-testid={`input-followup-other-${hobbySlug}`}
              placeholder="Please describe…"
              value={otherText}
              onChange={(e) => {
                setOtherText(e.target.value);
                onChange(e.target.value);
              }}
              className="mt-3 h-12 border-vyva-border text-[15px]"
              autoFocus
            />
          )}
        </>
      ) : (
        <Input
          data-testid={`input-followup-${hobbySlug}`}
          placeholder={config.hint || "Type your answer…"}
          value={currentValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 border-vyva-border text-[15px]"
        />
      )}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-5" data-testid="skeleton-hobbies-content">
      <Skeleton className="h-32 w-full rounded-2xl" />
      {[5, 4, 3].map((count, gi) => (
        <div key={gi}>
          <Skeleton className="h-5 w-32 mb-3 rounded-lg" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: count }).map((_, i) => (
              <Skeleton key={i} className="h-11 rounded-full" style={{ width: 64 + (i % 3) * 20 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

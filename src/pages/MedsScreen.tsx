import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Check, Clock, AlertCircle, Calendar, Link as LinkIcon, Mic, ChevronDown, ExternalLink, Zap, Leaf, ShoppingCart, Sparkles, BarChart2, Pencil, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import VoiceHero from "@/components/VoiceHero";
import VoiceMedsModal, { type MedicationForForm } from "@/components/VoiceMedsModal";
import MedsAssistantSheet from "@/components/MedsAssistantSheet";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Unified medication shape ────────────────────────────────────────────────
// Normalises both DB rows and static mock entries into one type so the
// rest of the component never cares where the data came from.
type DisplayMed = {
  id: string;           // unique key (DB uuid or mock name key)
  displayName: string;  // localised / raw name to show in the UI
  displayNote: string;  // dosage + frequency or schedule note
  takenInitially: boolean; // taken status from the source (DB or mock)
  nameForApi: string;   // canonical English name sent to /confirm
  scheduledTimeForApi: string; // first scheduled time or "anytime"
  rawDosage: string;    // original dosage from DB, used to seed the edit form
  rawFrequency: string; // original frequency from DB, used to seed the edit form
};

type DbMed = {
  id: string;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  scheduled_times: string[];
  takenToday: boolean;
};

type TodayResponse = { medications: DbMed[] };

const MedsScreen = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ─── Load today's medications from the DB ──────────────────────────────────
  const { data: todayData, isLoading: todayLoading } = useQuery<TodayResponse>({
    queryKey: ["/api/meds/adherence-report/today"],
  });

  const displayMeds: DisplayMed[] = (() => {
    if (todayData && todayData.medications.length > 0) {
      return todayData.medications.map((m) => ({
        id: m.id,
        displayName: m.medication_name,
        displayNote: [m.dosage, m.frequency?.replace("_", " ")].filter(Boolean).join(" · "),
        takenInitially: m.takenToday,
        nameForApi: m.medication_name,
        scheduledTimeForApi: m.scheduled_times?.[0] ?? "anytime",
        rawDosage: m.dosage ?? "",
        rawFrequency: m.frequency ?? "",
      }));
    }
    // No medications from DB yet — return empty list so the UI shows an empty state.
    return [];
  })();

  const medNames = (() => {
    const names = displayMeds.map((m) => m.displayName);
    try {
      return new Intl.ListFormat(i18n.language, { style: "long", type: "conjunction" }).format(names);
    } catch {
      return names.join(", ");
    }
  })();

  const [confirmedMeds, setConfirmedMeds] = useState<Set<string>>(new Set());
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceAddedMeds, setVoiceAddedMeds] = useState<MedicationForForm[]>([]);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [headlineVisible, setHeadlineVisible] = useState(true);

  // ─── Edit / Delete state ───────────────────────────────────────────────────
  const [editMed, setEditMed] = useState<DisplayMed | null>(null);
  const [editName, setEditName] = useState("");
  const [editDosage, setEditDosage] = useState("");
  const [editFrequency, setEditFrequency] = useState("");
  const [deleteMed, setDeleteMed] = useState<DisplayMed | null>(null);

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, dosage, frequency }: { id: string; name: string; dosage: string; frequency: string }) => {
      const res = await apiFetch(`/api/meds/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ medication_name: name, dosage, frequency }),
      });
      if (!res.ok) throw new Error("Failed to update medication");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report"] });
      setEditMed(null);
      toast({ title: t("meds.editSuccess", "Medication updated") });
    },
    onError: () => {
      toast({ title: t("meds.editError", "Could not update medication"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/meds/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove medication");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report"] });
      setDeleteMed(null);
      toast({ title: t("meds.deleteSuccess", "Medication removed") });
    },
    onError: () => {
      toast({ title: t("meds.deleteError", "Could not remove medication"), variant: "destructive" });
    },
  });

  function openEditMed(med: DisplayMed) {
    setEditMed(med);
    setEditName(med.displayName);
    setEditDosage(med.rawDosage);
    setEditFrequency(med.rawFrequency);
  }

  const confirmMutation = useMutation({
    mutationFn: async (med: DisplayMed) => {
      const res = await apiFetch("/api/meds/adherence-report/confirm", {
        method: "POST",
        body: JSON.stringify({
          medication_name: med.nameForApi,
          scheduled_time: med.scheduledTimeForApi,
        }),
      });
      if (!res.ok) throw new Error("Failed to confirm dose");
      return res.json();
    },
    onSuccess: (_data, med) => {
      setConfirmedMeds((prev) => new Set([...prev, med.id]));
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report/today"] });
      toast({ title: t("meds.taken"), description: med.displayName });
    },
    onError: () => {
      toast({ title: "Could not confirm dose", variant: "destructive" });
    },
  });

  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantTitle, setAssistantTitle] = useState("");
  const [assistantPrompt, setAssistantPrompt] = useState("");

  const [expandedLinks, setExpandedLinks] = useState<Set<string>>(new Set());

  const isMedTaken = (med: DisplayMed) =>
    med.takenInitially || confirmedMeds.has(med.id);

  const takenCount = displayMeds.filter(isMedTaken).length;
  const rawHeadlines = t("meds.headlines", { returnObjects: true });
  const headlines = Array.isArray(rawHeadlines) && rawHeadlines.length > 0 ? rawHeadlines as string[] : [];
  const currentHeadline = headlines.length > 0 ? headlines[headlineIndex] : t("meds.headline");

  useEffect(() => {
    if (!headlines.length) return;
    const fadeTimer = setTimeout(() => setHeadlineVisible(false), 3600);
    const swapTimer = setTimeout(() => {
      setHeadlineIndex((prev) => (prev + 1) % headlines.length);
      setHeadlineVisible(true);
    }, 3800);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(swapTimer);
    };
  }, [headlineIndex, headlines.length]);

  const ASSISTANT_ACTIONS = [
    {
      id: "interactions",
      icon: Zap,
      label: t("meds.assistant.interactions.label"),
      sub: t("meds.assistant.interactions.sub"),
      color: "#C9890A",
      bg: "#FEF3C7",
      type: "chat" as const,
      prompt: t("meds.assistant.interactions.prompt", { medNames }),
      sheetTitle: t("meds.assistant.interactions.sheetTitle"),
    },
    {
      id: "naturalMedicine",
      icon: Leaf,
      label: t("meds.assistant.naturalMedicine.label"),
      sub: t("meds.assistant.naturalMedicine.sub"),
      color: "#166534",
      bg: "#DCFCE7",
      type: "chat" as const,
      prompt: t("meds.assistant.naturalMedicine.prompt", { medNames }),
      sheetTitle: t("meds.assistant.naturalMedicine.sheetTitle"),
    },
    {
      id: "order",
      icon: ShoppingCart,
      label: t("meds.assistant.order.label"),
      sub: t("meds.assistant.order.sub"),
      color: "#0A7C4E",
      bg: "#ECFDF5",
      type: "links" as const,
      links: [
        { label: t("meds.assistant.order.links.nhsRepeat"), url: "https://www.nhs.uk/nhs-services/prescriptions-and-pharmacies/how-to-order-repeat-prescriptions/" },
        { label: t("meds.assistant.order.links.pharmacy2u"), url: "https://www.pharmacy2u.co.uk" },
        { label: t("meds.assistant.order.links.chemistDirect"), url: "https://www.chemistdirect.co.uk" },
        { label: t("meds.assistant.order.links.lloydsPharmacy"), url: "https://www.lloydspharmacy.com" },
      ],
    },
    {
      id: "advances",
      icon: Sparkles,
      label: t("meds.assistant.advances.label"),
      sub: t("meds.assistant.advances.sub"),
      color: "#7C3AED",
      bg: "#EDE9FE",
      type: "chat" as const,
      prompt: t("meds.assistant.advances.prompt", { medNames }),
      sheetTitle: t("meds.assistant.advances.sheetTitle"),
    },
  ];

  const handleAddMedication = (med: MedicationForForm) => {
    setVoiceAddedMeds(prev => [...prev, med]);
    toast({
      title: t("meds.toastAdded"),
      description: med.name
        ? t("meds.toastAddedDesc", { name: med.name })
        : t("meds.toastAddedDefault"),
    });
  };

  function openAssistant(prompt: string, title: string) {
    setAssistantPrompt(prompt);
    setAssistantTitle(title);
    setAssistantOpen(true);
  }

  function toggleLinks(id: string) {
    setExpandedLinks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="px-[22px]">
      <VoiceHero
        sourceText={t("meds.voiceSource")}
        headline={<span style={{ opacity: headlineVisible ? 1 : 0, transition: "opacity 0.28s ease, transform 0.28s ease", display: "inline-block", transform: headlineVisible ? "translateY(0)" : "translateY(6px)" }}>{currentHeadline}</span>}
        subtitle={todayData && displayMeds.length === 0 ? t("meds.noMedsScheduled") : t("meds.takenToday", { taken: takenCount, total: displayMeds.length })}
        contextHint="medication reminder"
      >
        <div className="w-full h-[6px] rounded-full mt-3" style={{ background: "rgba(255,255,255,0.15)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${displayMeds.length > 0 ? (takenCount / displayMeds.length) * 100 : 0}%`, background: "#34D399" }} />
        </div>
      </VoiceHero>

      {/* Medication info */}
      <div className="mt-[14px] bg-white rounded-[20px] border border-vyva-border overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
        <div className="px-[18px] py-[13px] border-b border-vyva-border" style={{ background: "#F5EFE4" }}>
          <span className="font-body text-[14px] font-medium text-vyva-text-1">{t("meds.medicationInfo")}</span>
        </div>
        {[
          { icon: Calendar, label: t("meds.refillReminder"), sub: t("meds.refillReminderSub"), color: "#C9890A", bg: "#FEF3C7", onClick: undefined },
          { icon: AlertCircle, label: t("meds.interactions"), sub: displayMeds.length > 0 ? t("meds.interactionsSubWithMeds", { count: displayMeds.length }) : t("meds.interactionsSub"), color: "#0A7C4E", bg: "#ECFDF5", onClick: undefined },
          { icon: BarChart2, label: t("meds.adherenceReport"), sub: t("meds.adherenceReportSub"), color: "#6B21A8", bg: "#EDE9FE", onClick: () => navigate("/meds/adherence-report") },
        ].map((item, i) => (
          <div
            key={i}
            className={`flex items-center gap-[14px] px-[18px] py-[14px] border-b border-vyva-border last:border-b-0${item.onClick ? " cursor-pointer active:bg-gray-50" : ""}`}
            style={{ minHeight: 64 }}
            onClick={item.onClick}
            data-testid={i === 2 ? "button-adherence-report-link" : undefined}
            role={item.onClick ? "button" : undefined}
          >
            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0" style={{ background: item.bg }}>
              <item.icon size={18} style={{ color: item.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-[15px] font-medium text-vyva-text-1">{item.label}</p>
              <p className="font-body text-[13px] text-vyva-text-2">{item.sub}</p>
            </div>
            {item.onClick && <ExternalLink size={16} className="text-vyva-text-2 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* Today's schedule */}
      <div className="mt-[14px] bg-white rounded-[20px] border border-vyva-border overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
        <div className="flex items-center justify-between px-[18px] py-[13px] border-b border-vyva-border" style={{ background: "#F5EFE4" }}>
          <span className="font-body text-[14px] font-medium text-vyva-text-1">{t("meds.todaySchedule")}</span>
          <span className="font-body text-[12px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#FEF3C7", color: "#92400E" }}>{t("meds.dueTonight")}</span>
        </div>

        {todayLoading ? (
          <div className="flex flex-col gap-0">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-[14px] px-[18px] py-[14px] border-b border-vyva-border last:border-b-0 animate-pulse" style={{ minHeight: 64 }}>
                <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : displayMeds.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-[24px] py-[32px] text-center" data-testid="status-no-medications">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#F3E8FF" }}>
              <Mic size={22} style={{ color: "#6B21A8" }} />
            </div>
            <p className="font-body text-[16px] font-semibold text-vyva-text-1">{t("meds.noMedsTitle", "No medications added yet")}</p>
            <p className="font-body text-[14px] text-vyva-text-2">{t("meds.noMedsSub", "Use the button below to add your medications by voice")}</p>
          </div>
        ) : (
          displayMeds.map((med, i) => {
            const taken = isMedTaken(med);
            return (
              <div key={med.id} className="flex items-center gap-[14px] px-[18px] py-[14px] border-b border-vyva-border last:border-b-0" style={{ minHeight: 64 }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: taken ? "#ECFDF5" : "#FEF3C7" }}>
                  {taken ? <Check size={18} style={{ color: "#0A7C4E" }} /> : <Clock size={18} style={{ color: "#C9890A" }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[15px] font-medium text-vyva-text-1">{med.displayName}</p>
                  <p className="font-body text-[13px] text-vyva-text-2">{med.displayNote}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {taken ? (
                    <span
                      className="font-body text-[13px] font-medium px-2.5 py-0.5 rounded-full"
                      style={{ background: "#ECFDF5", color: "#065F46" }}
                      data-testid={`status-med-taken-${i}`}
                    >
                      {t("meds.taken")}
                    </span>
                  ) : (
                    <button
                      data-testid={`button-confirm-med-${i}`}
                      onClick={() => confirmMutation.mutate(med)}
                      disabled={confirmMutation.isPending}
                      className="font-body text-[13px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 transition-opacity disabled:opacity-50"
                      style={{ background: "#6B21A8", color: "#fff" }}
                    >
                      <Check size={12} />
                      {t("meds.confirm")}
                    </button>
                  )}
                  <button
                    data-testid={`button-edit-med-${i}`}
                    onClick={() => openEditMed(med)}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100 active:bg-gray-200"
                    title={t("meds.editMed", "Edit medication")}
                  >
                    <Pencil size={14} className="text-vyva-text-2" />
                  </button>
                  <button
                    data-testid={`button-delete-med-${i}`}
                    onClick={() => setDeleteMed(med)}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-red-50 active:bg-red-100"
                    title={t("meds.deleteMed", "Remove medication")}
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </div>
            );
          })
        )}

        {voiceAddedMeds.map((med, i) => (
          <div key={`voice-${i}`} className="flex items-center gap-[14px] px-[18px] py-[14px] border-b border-vyva-border last:border-b-0 bg-purple-50" style={{ minHeight: 64 }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#F3E8FF" }}>
              <Mic size={18} style={{ color: "#6B21A8" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-[15px] font-medium text-vyva-text-1">{med.name || t("meds.newMedication")}</p>
              <p className="font-body text-[13px] text-vyva-text-2">
                {[med.dosage, med.frequency?.replace("_", " ")].filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className="font-body text-[12px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#F3E8FF", color: "#6B21A8" }}>
              {t("meds.added")}
            </span>
          </div>
        ))}

        <div className="px-[18px] py-[14px] flex flex-col gap-3">
          {(() => {
            const pendingMeds = displayMeds.filter((m) => !isMedTaken(m));
            if (!todayLoading && displayMeds.length > 0 && pendingMeds.length === 0) {
              return (
                <div
                  className="w-full flex items-center justify-center gap-2 rounded-full py-[15px] px-[20px] font-body text-[16px] font-medium min-h-[56px]"
                  style={{ background: "#ECFDF5", color: "#065F46" }}
                  data-testid="status-all-meds-taken"
                >
                  <Check size={18} />
                  {t("meds.allTaken")}
                </div>
              );
            }
            return (
              <button
                data-testid="button-confirm-all-meds"
                onClick={() => {
                  pendingMeds.forEach((m) => confirmMutation.mutate(m));
                }}
                disabled={confirmMutation.isPending || todayLoading}
                className="w-full flex items-center justify-center gap-2 rounded-full py-[15px] px-[20px] font-body text-[16px] font-medium text-white min-h-[56px] transition-opacity disabled:opacity-60"
                style={{ background: "#6B21A8" }}
              >
                <LinkIcon size={18} />
                {t("meds.confirmTaken")}
              </button>
            );
          })()}
          <button
            data-testid="button-meds-add-by-voice"
            onClick={() => setVoiceModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-full py-[13px] px-[20px] font-body text-[15px] font-medium min-h-[48px] border transition-colors"
            style={{ borderColor: "#6B21A8", color: "#6B21A8" }}
          >
            <Mic size={16} />
            {t("meds.addByVoice")}
          </button>
        </div>
      </div>

      {/* Medication Assistant */}
      <div className="mt-[14px] mb-6 bg-white rounded-[20px] border border-vyva-border overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
        <div className="px-[18px] py-[13px] border-b border-vyva-border" style={{ background: "#F5EFE4" }}>
          <span className="font-body text-[14px] font-medium text-vyva-text-1">{t("meds.medicationAssistant")}</span>
        </div>

        {ASSISTANT_ACTIONS.map((action, i) => {
          const isLast = i === ASSISTANT_ACTIONS.length - 1;
          const isLinksExpanded = action.type === "links" && expandedLinks.has(action.id);

          return (
            <div
              key={action.id}
              className={`${!isLast ? "border-b border-vyva-border" : ""}`}
            >
              <button
                data-testid={`button-assistant-${action.id}`}
                onClick={() => action.type === "chat" ? openAssistant(action.prompt, action.sheetTitle) : toggleLinks(action.id)}
                className="w-full flex items-center gap-[14px] px-[18px] py-[16px] text-left min-h-[72px]"
              >
                <div className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0" style={{ background: action.bg }}>
                  <action.icon size={20} style={{ color: action.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[15px] font-medium text-vyva-text-1">{action.label}</p>
                  <p className="font-body text-[13px] text-vyva-text-2">{action.sub}</p>
                </div>
                {action.type === "chat" ? (
                  <ExternalLink size={16} className="text-vyva-text-2" />
                ) : (
                  <ChevronDown size={16} className={`text-vyva-text-2 transition-transform ${isLinksExpanded ? "rotate-180" : ""}`} />
                )}
              </button>

              {action.type === "links" && isLinksExpanded && (
                <div className="px-[18px] pb-[14px] pl-[73px] grid gap-2">
                  {action.links?.map((link) => (
                    <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="font-body text-[14px] text-vyva-purple underline underline-offset-2">
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <VoiceMedsModal
        open={voiceModalOpen}
        onOpenChange={setVoiceModalOpen}
        onAddMedication={handleAddMedication}
      />

      <MedsAssistantSheet
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        title={assistantTitle}
        initialPrompt={assistantPrompt}
      />

      {/* Edit Medication Dialog */}
      <Dialog open={!!editMed} onOpenChange={(open) => { if (!open) setEditMed(null); }}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>{t("meds.editMedTitle", "Edit Medication")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-med-name">{t("meds.editName", "Medication name")}</Label>
              <Input
                id="edit-med-name"
                data-testid="input-edit-med-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t("meds.editNamePlaceholder", "e.g. Metformin")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-med-dosage">{t("meds.editDosage", "Dosage")}</Label>
              <Input
                id="edit-med-dosage"
                data-testid="input-edit-med-dosage"
                value={editDosage}
                onChange={(e) => setEditDosage(e.target.value)}
                placeholder={t("meds.editDosagePlaceholder", "e.g. 500mg")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-med-frequency">{t("meds.editFrequency", "Frequency")}</Label>
              <Input
                id="edit-med-frequency"
                data-testid="input-edit-med-frequency"
                value={editFrequency}
                onChange={(e) => setEditFrequency(e.target.value)}
                placeholder={t("meds.editFrequencyPlaceholder", "e.g. twice daily")}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              data-testid="button-edit-med-cancel"
              onClick={() => setEditMed(null)}
              className="flex-1 py-2.5 rounded-full font-body text-[15px] font-medium border border-vyva-border text-vyva-text-1"
            >
              {t("common.cancel", "Cancel")}
            </button>
            <button
              data-testid="button-edit-med-save"
              onClick={() => {
                if (!editMed || !editName.trim()) return;
                updateMutation.mutate({
                  id: editMed.id,
                  name: editName.trim(),
                  dosage: editDosage.trim(),
                  frequency: editFrequency.trim(),
                });
              }}
              disabled={updateMutation.isPending || !editName.trim()}
              className="flex-1 py-2.5 rounded-full font-body text-[15px] font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: "#6B21A8" }}
            >
              {updateMutation.isPending ? t("common.saving", "Saving…") : t("common.save", "Save")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteMed} onOpenChange={(open) => { if (!open) setDeleteMed(null); }}>
        <AlertDialogContent className="max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("meds.deleteConfirmTitle", "Remove medication?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("meds.deleteConfirmDesc", "{{name}} will be removed from your medication list. You can add it again at any time.", { name: deleteMed?.displayName ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              data-testid="button-delete-med-cancel"
              onClick={() => setDeleteMed(null)}
            >
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-delete-med-confirm"
              onClick={() => { if (deleteMed) deleteMutation.mutate(deleteMed.id); }}
              disabled={deleteMutation.isPending}
              className="font-body text-[15px] font-semibold"
              style={{ background: "#DC2626" }}
            >
              {deleteMutation.isPending ? t("common.removing", "Removing…") : t("meds.deleteConfirmAction", "Remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MedsScreen;

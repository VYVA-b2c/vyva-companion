import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  History,
  Keyboard,
  PackageCheck,
  PackageOpen,
  Pill,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import {
  prepareShowVyvaEvidenceFile,
  type ShowVyvaPreparedEvidence,
} from "@/lib/showVyvaEvidence";
import ShowVyvaCaptureCoach from "@/components/ShowVyvaCaptureCoach";
import {
  CanonicalDetailFlowShell,
  CanonicalFlowIcon,
  CanonicalVoiceButton,
  type CanonicalDetailFlowShellContract,
} from "@/components/CanonicalDetailFlowShell";

type RefillStatus = "setup_needed" | "on_track" | "refill_soon" | "refill_now" | "uncertain";

type InventoryHistory = {
  id: string;
  type: "purchase" | "stock_count" | "correction";
  quantity: number;
  unit: string;
  occurredOn: string;
  source: string;
  updatedBy: string;
  actorRole: string;
};

type RefillMedicine = {
  medicineId: string;
  medicineName: string;
  strength: string | null;
  doseUnit: string | null;
  unitsPerDose: number | null;
  inventoryUnit: string | null;
  inventoryUnitsPerDose: number | null;
  dailyFrequency: number | null;
  refillAlertDays: number;
  inventoryTrackingEnabled: boolean;
  estimatedQuantity: number | null;
  daysRemaining: number | null;
  projectedRunOutDate: string | null;
  status: RefillStatus;
  confidence: "high" | "medium" | "low";
  calculationReason: string;
  updatedAt: string;
  updatedBy: { name: string; role: string } | null;
  history: InventoryHistory[];
};

type RefillResponse = {
  profileId: string;
  actorRole: string;
  permissions: { manage_inventory?: boolean; receive_refill_alerts?: boolean };
  medicines: RefillMedicine[];
};

type UpdateDraft = {
  medicineId: string;
  quantity: string;
  doseUnit: string;
  inventoryUnit: string;
  occurredOn: string;
  unitsPerDose: string;
  inventoryUnitsPerDose: string;
  dailyFrequency: string;
  refillAlertDays: string;
  mode: "purchase" | "stock_count";
  source: "manual" | "photo";
  extractionConfidence?: "high" | "medium" | "low";
  extractionNeedsReview?: boolean;
  packageCount?: number | null;
  unitsPerPackage?: number | null;
  inventoryEvidenceText?: string | null;
  contentAmountPerUnit?: number | null;
  contentUnit?: string | null;
  contentEvidenceText?: string | null;
  warnings?: string[];
};

type PhotoExtractResponse = {
  draft: {
    medicineName: string;
    strength: string;
    packageCount: number | null;
    unitsPerPackage: number | null;
    totalQuantity: number | null;
    inventoryQuantity: number | null;
    inventoryUnit: string | null;
    inventoryEvidenceText: string | null;
    contentAmountPerUnit: number | null;
    contentUnit: string | null;
    contentEvidenceText: string | null;
    doseUnit: string;
    purchasedOn: string | null;
  };
  confidence: "high" | "medium" | "low";
  needsReview: boolean;
  warnings: string[];
  imageRetained: false;
};

const shellContract: CanonicalDetailFlowShellContract = {
  shellId: "home.production",
  headerId: "detail.voice-touch",
  headerTitle: "Refills",
  containerId: "flow.rounded-card",
  bottomNavId: "home-sos-reports",
  composer: "hidden",
};

const todayKey = () => new Date().toISOString().slice(0, 10);

function formatDate(value: string | null) {
  if (!value) return "Not available yet";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function pluralUnit(quantity: number | null, unit: string | null) {
  const clean = unit?.trim() || "unit";
  const labels: Record<string, [string, string]> = {
    tablet: ["tablet", "tablets"],
    capsule: ["capsule", "capsules"],
    single_dose_container: ["single-dose container", "single-dose containers"],
    bottle: ["bottle", "bottles"],
    sachet: ["sachet", "sachets"],
    patch: ["patch", "patches"],
    dose: ["dose", "doses"],
    ml: ["ml", "ml"],
  };
  if (labels[clean]) return quantity === 1 ? labels[clean][0] : labels[clean][1];
  if (quantity === 1 || clean.endsWith("s")) return clean;
  return `${clean}s`;
}

function statusMeta(status: RefillStatus) {
  switch (status) {
    case "on_track": return { label: "On track", chip: "bg-[#E8F8F2] text-[#0F766E]", tone: "green" as const, icon: Check };
    case "refill_soon": return { label: "Refill soon", chip: "bg-[#FFF4CF] text-[#9A6700]", tone: "gold" as const, icon: Clock3 };
    case "refill_now": return { label: "Refill now", chip: "bg-[#FEECEC] text-[#B42318]", tone: "red" as const, icon: AlertTriangle };
    case "uncertain": return { label: "Check quantity", chip: "bg-[#FEF3C7] text-[#A15C00]", tone: "amber" as const, icon: RotateCcw };
    default: return { label: "Set up tracking", chip: "bg-[#F1ECFF] text-[#7024C4]", tone: "purple" as const, icon: PackageOpen };
  }
}

function priority(medicine: RefillMedicine) {
  return { refill_now: 0, refill_soon: 1, setup_needed: 2, uncertain: 3, on_track: 4 }[medicine.status];
}

function makeDraft(medicine: RefillMedicine, source: "manual" | "photo" = "manual"): UpdateDraft {
  return {
    medicineId: medicine.medicineId,
    quantity: "",
    doseUnit: medicine.doseUnit || "tablet",
    inventoryUnit: medicine.inventoryUnit || medicine.doseUnit || "tablet",
    occurredOn: todayKey(),
    unitsPerDose: String(medicine.unitsPerDose ?? 1),
    inventoryUnitsPerDose: String(medicine.inventoryUnitsPerDose ?? medicine.unitsPerDose ?? 1),
    dailyFrequency: String(medicine.dailyFrequency ?? 1),
    refillAlertDays: String(medicine.refillAlertDays || 7),
    mode: "purchase",
    source,
  };
}

function draftRunOutDate(draft: UpdateDraft) {
  if (!draft.quantity.trim()) return null;
  const quantity = Number(draft.quantity);
  const dailyUse = Number(draft.inventoryUnitsPerDose) * Number(draft.dailyFrequency);
  if (!Number.isFinite(quantity) || !Number.isFinite(dailyUse) || dailyUse <= 0 || !draft.occurredOn) return null;
  const coverageDays = Math.max(0, Math.floor(quantity / dailyUse));
  const projected = new Date(`${draft.occurredOn}T12:00:00Z`);
  projected.setUTCDate(projected.getUTCDate() + coverageDays);
  return projected.toISOString().slice(0, 10);
}

function heroCopy(medicine: RefillMedicine | undefined) {
  if (!medicine) return { eyebrow: "SMART REFILL TRACKER", title: "Add a medicine to start tracking", body: "VYVA estimates supply from the quantity you confirm and your daily routine." };
  if (medicine.status === "refill_now") return { eyebrow: "REFILL CHECK", title: `${medicine.medicineName} needs a refill now`, body: "Update the quantity if you have already bought more or counted what is left." };
  if (medicine.status === "refill_soon") return { eyebrow: "REFILL CHECK", title: `${medicine.medicineName} needs a refill this week`, body: `About ${medicine.daysRemaining ?? 0} days remain based on the confirmed routine.` };
  if (medicine.status === "setup_needed") return { eyebrow: "ONE QUICK SETUP", title: `Track ${medicine.medicineName} supply`, body: "Confirm the quantity and daily routine once. VYVA will estimate what remains." };
  if (medicine.status === "uncertain") return { eyebrow: "QUICK STOCK CHECK", title: `Let’s check ${medicine.medicineName}`, body: "A current count will reset the estimate and make the next reminder more reliable." };
  return { eyebrow: "SUPPLY ON TRACK", title: `You have about ${medicine.daysRemaining ?? 0} days left`, body: `${medicine.medicineName} is estimated to last until ${formatDate(medicine.projectedRunOutDate)}.` };
}

export default function MedicationRefillsScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const profileId = searchParams.get("profileId") || "me";
  const returnTo = searchParams.get("returnTo") || "/meds";
  const [step, setStep] = useState<"overview" | "choose" | "review" | "success">("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UpdateDraft | null>(null);
  const [evidence, setEvidence] = useState<ShowVyvaPreparedEvidence | null>(null);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSummary, setSavedSummary] = useState<RefillMedicine | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryUrl = `/api/meds/refills/${encodeURIComponent(profileId)}`;
  const refillQuery = useQuery<RefillResponse>({ queryKey: [queryUrl] });
  const canManageInventory = refillQuery.data?.permissions.manage_inventory !== false;
  const medicines = useMemo(
    () => [...(refillQuery.data?.medicines ?? [])].sort((left, right) => priority(left) - priority(right)),
    [refillQuery.data?.medicines],
  );
  const selectedMedicine = medicines.find((medicine) => medicine.medicineId === selectedId) ?? medicines[0];
  const leadMedicine = medicines[0];
  const hero = heroCopy(leadMedicine);

  const saveMutation = useMutation({
    mutationFn: async (input: UpdateDraft) => {
      const path = input.mode === "purchase" ? "purchases" : "stock-counts";
      const response = await apiFetch(`${queryUrl}/medicines/${input.medicineId}/${path}`, {
        method: "POST",
        body: JSON.stringify({
          quantity: Number(input.quantity),
          doseUnit: input.doseUnit.trim(),
          inventoryUnit: input.inventoryUnit.trim(),
          occurredOn: input.occurredOn,
          unitsPerDose: Number(input.unitsPerDose),
          inventoryUnitsPerDose: Number(input.inventoryUnitsPerDose),
          dailyFrequency: Number(input.dailyFrequency),
          refillAlertDays: Number(input.refillAlertDays),
          source: input.source,
        }),
      });
      const body = await response.json().catch(() => ({})) as { summary?: RefillMedicine; error?: string };
      if (!response.ok || !body.summary) throw new Error(body.error || "VYVA could not update the supply.");
      return body.summary;
    },
    onSuccess: async (summary) => {
      setSavedSummary(summary);
      setStep("success");
      setSaveError(null);
      await queryClient.invalidateQueries({ queryKey: [queryUrl] });
    },
    onError: (error) => setSaveError(error instanceof Error ? error.message : "VYVA could not update the supply."),
  });

  const openUpdate = (medicine = selectedMedicine) => {
    if (!medicine) return;
    setSelectedId(medicine.medicineId);
    setDraft(makeDraft(medicine));
    setSaveError(null);
    setStep("choose");
  };

  const startManual = (mode: "purchase" | "stock_count" = "purchase") => {
    if (!selectedMedicine) return;
    setDraft({ ...(draft ?? makeDraft(selectedMedicine)), mode, source: "manual" });
    setStep("review");
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setCaptureError(null);
    try {
      setEvidence(await prepareShowVyvaEvidenceFile(file));
    } catch {
      setCaptureError("That photo could not be prepared. Try another clear photo of the full medicine label.");
    }
  };

  const extractPhoto = async (prepared: ShowVyvaPreparedEvidence) => {
    setCaptureBusy(true);
    setCaptureError(null);
    try {
      const response = await apiFetch(`${queryUrl}/photo-extract`, {
        method: "POST",
        body: JSON.stringify({ image: prepared.dataUrl, language: navigator.language || "en", medicineId: selectedMedicine?.medicineId }),
      });
      const result = await response.json() as PhotoExtractResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || "VYVA could not read the label.");
      const matched = medicines.find((medicine) => result.draft.medicineName && medicine.medicineName.toLowerCase().includes(result.draft.medicineName.toLowerCase())) ?? selectedMedicine;
      if (!matched) throw new Error("Choose a saved medicine before using this photo.");
      setSelectedId(matched.medicineId);
      setDraft({
        ...makeDraft(matched, "photo"),
        quantity: result.draft.inventoryQuantity === null ? "" : String(result.draft.inventoryQuantity),
        inventoryUnit: result.draft.inventoryUnit || matched.inventoryUnit || matched.doseUnit || "",
        occurredOn: result.draft.purchasedOn || todayKey(),
        extractionConfidence: result.confidence,
        extractionNeedsReview: result.needsReview,
        packageCount: result.draft.packageCount,
        unitsPerPackage: result.draft.unitsPerPackage,
        inventoryEvidenceText: result.draft.inventoryEvidenceText,
        contentAmountPerUnit: result.draft.contentAmountPerUnit,
        contentUnit: result.draft.contentUnit,
        contentEvidenceText: result.draft.contentEvidenceText,
        warnings: result.warnings,
      });
      setEvidence(null);
      setStep("review");
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : "VYVA could not read the label. Enter the details instead.");
      setEvidence(null);
    } finally {
      setCaptureBusy(false);
    }
  };

  const validateAndSave = () => {
    if (!draft) return;
    if (!draft.quantity || Number(draft.quantity) < 0 || !draft.inventoryUnit.trim() || !draft.doseUnit.trim() || Number(draft.unitsPerDose) <= 0 || Number(draft.inventoryUnitsPerDose) <= 0 || Number(draft.dailyFrequency) <= 0) {
      setSaveError("Please confirm the quantity, stock unit, dose routine, and stock used each time.");
      return;
    }
    saveMutation.mutate(draft);
  };

  return (
    <CanonicalDetailFlowShell
      shellContract={shellContract}
      onBack={() => step === "overview" ? navigate(returnTo) : setStep("overview")}
      headerAction={<CanonicalVoiceButton contextHint="Medication refill tracking. Help me check remaining supply, update a purchase, or count what I have now. Never order or contact anyone." testId="button-refills-voice" />}
      shellTestId="medication-refills-screen"
      contentTestId="medication-refills-content"
      backTestId="button-refills-back"
    >
      {refillQuery.isLoading ? (
        <div className="mt-8 rounded-[28px] border border-[#E6DDF0] bg-white/90 p-8 text-center shadow-[0_18px_48px_rgba(74,45,92,0.08)]">
          <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-4 border-[#E8DEFA] border-t-vyva-purple" />
          <p className="mt-4 font-body text-[16px] font-bold text-vyva-text-2">Checking medicine supply…</p>
        </div>
      ) : refillQuery.isError ? (
        <div className="mt-8 rounded-[28px] border border-[#F4D0CC] bg-white p-6 text-center shadow-[0_18px_48px_rgba(74,45,92,0.08)]">
          <CanonicalFlowIcon icon={AlertTriangle} tone="red" goldAccent="status" className="mx-auto" />
          <h2 className="mt-4 font-display text-[24px] font-semibold text-vyva-text-1">We couldn’t load refill tracking</h2>
          <p className="mt-2 font-body text-[15px] font-semibold text-vyva-text-2">Your medicine list is unchanged. Try loading it again.</p>
          <button type="button" onClick={() => refillQuery.refetch()} className="vyva-tap mt-5 min-h-[54px] rounded-[16px] bg-vyva-purple px-6 font-body text-[16px] font-black text-white">Try again</button>
        </div>
      ) : step === "success" && savedSummary ? (
        <section className="mt-4 overflow-hidden rounded-[30px] border border-[#E7DCEC] bg-white shadow-[0_22px_58px_rgba(83,49,99,0.11)]" data-testid="refill-completion-state">
          <div className="bg-[linear-gradient(145deg,#F7EFFF_0%,#FFF8E7_100%)] px-6 py-8 text-center">
            <CanonicalFlowIcon icon={PackageCheck} tone="purple" goldAccent="check" className="mx-auto !h-14 !w-14 !rounded-[18px]" />
            <p className="mt-5 font-body text-[12px] font-black uppercase tracking-[0.1em] text-[#9A6700]">SUPPLY UPDATED</p>
            <h2 className="mt-2 font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.03em] text-vyva-text-1">
              {savedSummary.daysRemaining === null ? `${savedSummary.medicineName} is ready to track` : `About ${savedSummary.daysRemaining} days covered`}
            </h2>
            <p className="mx-auto mt-3 max-w-[430px] font-body text-[16px] font-semibold leading-relaxed text-vyva-text-2">
              {savedSummary.projectedRunOutDate ? `The new estimate runs to ${formatDate(savedSummary.projectedRunOutDate)}.` : "VYVA will use the confirmed routine to keep the estimate up to date."}
            </p>
          </div>
          <div className="space-y-3 p-5">
            <button type="button" onClick={() => { setStep("overview"); setSavedSummary(null); }} className="vyva-tap flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[18px] bg-vyva-purple px-5 font-body text-[17px] font-black text-white">
              <Check size={20} aria-hidden="true" /> Done
            </button>
            <p className="text-center font-body text-[12px] font-semibold text-vyva-text-2">No order was placed and nobody was contacted.</p>
          </div>
        </section>
      ) : step === "choose" && selectedMedicine ? (
        <section className="mt-4 space-y-4" data-testid="refill-update-methods">
          <div className="rounded-[28px] border border-[#E7DCEC] bg-white p-5 shadow-[0_18px_48px_rgba(74,45,92,0.08)]">
            <div className="flex items-start gap-3">
              <CanonicalFlowIcon icon={Pill} tone="purple" goldAccent="pill" />
              <div>
                <p className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#9A6700]">UPDATE SUPPLY</p>
                <h2 className="mt-1 font-display text-[26px] font-semibold leading-tight text-vyva-text-1">{selectedMedicine.medicineName}</h2>
                <p className="mt-1 font-body text-[14px] font-semibold text-vyva-text-2">Choose the easiest way to tell VYVA what you have.</p>
              </div>
            </div>
          </div>

          <button type="button" onClick={() => fileInputRef.current?.click()} className="vyva-tap flex min-h-[92px] w-full items-center gap-4 rounded-[24px] border border-[#DCCFF2] bg-white px-5 text-left shadow-[0_14px_35px_rgba(74,45,92,0.07)]" data-testid="button-refill-photo">
            <CanonicalFlowIcon icon={Camera} tone="purple" goldAccent="spark" />
            <span className="min-w-0 flex-1">
              <span className="block font-body text-[18px] font-black text-vyva-text-1">Take or upload a photo</span>
              <span className="sr-only">Show the full label and package quantity.</span>
            </span>
            <ChevronRight size={21} className="text-vyva-purple" aria-hidden="true" />
          </button>
          <input ref={fileInputRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => { void handleFile(event.target.files?.[0]); event.currentTarget.value = ""; }} data-testid="input-refill-photo" />

          <button type="button" onClick={() => startManual("purchase")} className="vyva-tap flex min-h-[92px] w-full items-center gap-4 rounded-[24px] border border-[#DCCFF2] bg-white px-5 text-left shadow-[0_14px_35px_rgba(74,45,92,0.07)]" data-testid="button-refill-manual">
            <CanonicalFlowIcon icon={Keyboard} tone="purple" goldAccent="pencil" />
            <span className="min-w-0 flex-1">
              <span className="block font-body text-[18px] font-black text-vyva-text-1">Enter it myself</span>
              <span className="sr-only">Add a purchase and confirm the daily routine.</span>
            </span>
            <ChevronRight size={21} className="text-vyva-purple" aria-hidden="true" />
          </button>

          <button type="button" onClick={() => startManual("stock_count")} className="vyva-tap flex min-h-[78px] w-full items-center gap-4 rounded-[22px] border border-[#E8D9B4] bg-[#FFFBF2] px-5 text-left" data-testid="button-refill-stock-count">
            <CanonicalFlowIcon icon={PackageOpen} tone="gold" goldAccent="target" />
            <span className="min-w-0 flex-1">
              <span className="block font-body text-[16px] font-black text-vyva-text-1">Count what I have now</span>
              <span className="sr-only">Reset the estimate from today’s actual stock.</span>
            </span>
          </button>
          {captureError ? <p role="alert" className="rounded-[16px] border border-[#F3D1CC] bg-[#FFF5F4] p-3 font-body text-[13px] font-bold text-[#9B2C21]">{captureError}</p> : null}
        </section>
      ) : step === "review" && draft && selectedMedicine ? (
        <section className="mt-4 overflow-hidden rounded-[28px] border border-[#E7DCEC] bg-white shadow-[0_20px_50px_rgba(74,45,92,0.09)]" data-testid="refill-review-step">
          <div className="border-b border-[#EEE5E1] bg-[linear-gradient(145deg,#FAF4FF_0%,#FFF9EC_100%)] p-5">
            <div className="flex items-start gap-3">
              <CanonicalFlowIcon icon={draft.source === "photo" ? Sparkles : PackageOpen} tone="purple" goldAccent={draft.source === "photo" ? "spark" : "target"} />
              <div>
                <p className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#9A6700]">REVIEW BEFORE SAVING</p>
                <h2 className="mt-1 font-display text-[25px] font-semibold text-vyva-text-1">{selectedMedicine.medicineName}</h2>
                <p className="mt-1 font-body text-[13px] font-semibold text-vyva-text-2">{[selectedMedicine.strength, draft.mode === "purchase" ? "New medicine purchase" : "Current stock count"].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5">
            {draft.source === "photo" ? (
              <div className={`rounded-[16px] border p-3 ${draft.extractionNeedsReview ? "border-[#F5D18A] bg-[#FFF9EA]" : "border-[#CDEAE5] bg-[#F2FBF9]"}`}>
                <p className="font-body text-[13px] font-black text-vyva-text-1">{draft.extractionNeedsReview ? "Package details need your review" : "VYVA found clear package details"}</p>
                <p className="mt-1 font-body text-[12px] font-semibold text-vyva-text-2">Check every field. The photo has been discarded and nothing has been saved yet.</p>
                {draft.inventoryEvidenceText ? (
                  <div className="mt-3 rounded-[13px] border border-white/80 bg-white/80 px-3 py-2.5" data-testid="refill-inventory-evidence">
                    <p className="font-body text-[11px] font-black uppercase tracking-[0.06em] text-[#8A5C08]">What the package says</p>
                    <p className="mt-1 font-body text-[15px] font-black text-vyva-text-1">“{draft.inventoryEvidenceText}”</p>
                    {draft.contentAmountPerUnit && draft.contentUnit ? <p className="mt-1 font-body text-[12px] font-semibold text-vyva-text-2">Package content: {draft.contentAmountPerUnit} {draft.contentUnit} per unit. This is not used as the refill count.</p> : null}
                  </div>
                ) : null}
                {draft.warnings?.length ? <ul className="mt-2 list-disc pl-5 font-body text-[12px] font-semibold text-[#8A5C08]">{draft.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
              </div>
            ) : null}

            <label className="block">
              <span className="font-body text-[13px] font-black text-vyva-text-1">{draft.mode === "purchase" ? "Total quantity purchased" : "Quantity I have now"}</span>
              <input value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} type="number" min="0" step="0.01" inputMode="decimal" className="mt-2 min-h-[54px] w-full rounded-[16px] border border-[#DCCFE4] bg-[#FFFCFA] px-4 font-body text-[17px] font-bold text-vyva-text-1 outline-none focus:border-vyva-purple" data-testid="input-refill-quantity" />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="font-body text-[13px] font-black text-vyva-text-1">Stock unit</span>
                <input value={draft.inventoryUnit} onChange={(event) => setDraft({ ...draft, inventoryUnit: event.target.value })} placeholder="e.g. single-dose container" className="mt-2 min-h-[54px] w-full rounded-[16px] border border-[#DCCFE4] bg-[#FFFCFA] px-4 font-body text-[16px] font-bold text-vyva-text-1 outline-none focus:border-vyva-purple" data-testid="input-refill-unit" />
              </label>
              <label className="block">
                <span className="font-body text-[13px] font-black text-vyva-text-1">{draft.mode === "purchase" ? "Purchase date" : "Count date"}</span>
                <input value={draft.occurredOn} onChange={(event) => setDraft({ ...draft, occurredOn: event.target.value })} type="date" max={todayKey()} className="mt-2 min-h-[54px] w-full rounded-[16px] border border-[#DCCFE4] bg-[#FFFCFA] px-3 font-body text-[14px] font-bold text-vyva-text-1 outline-none focus:border-vyva-purple" data-testid="input-refill-date" />
              </label>
            </div>

            <div className="rounded-[18px] border border-[#EADFCB] bg-[#FFFBF4] p-4">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-[#A16207]" aria-hidden="true" />
                <p className="font-body text-[14px] font-black text-vyva-text-1">Confirmed daily routine</p>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label>
                  <span className="font-body text-[12px] font-bold text-vyva-text-2">Dose amount</span>
                  <input value={draft.unitsPerDose} onChange={(event) => setDraft({ ...draft, unitsPerDose: event.target.value })} type="number" min="0.01" step="0.01" inputMode="decimal" className="mt-1 min-h-[50px] w-full rounded-[14px] border border-[#DED1C3] bg-white px-3 font-body text-[16px] font-bold text-vyva-text-1" data-testid="input-refill-units-per-dose" />
                </label>
                <label>
                  <span className="font-body text-[12px] font-bold text-vyva-text-2">Dose unit</span>
                  <input value={draft.doseUnit} onChange={(event) => setDraft({ ...draft, doseUnit: event.target.value })} className="mt-1 min-h-[50px] w-full rounded-[14px] border border-[#DED1C3] bg-white px-3 font-body text-[16px] font-bold text-vyva-text-1" data-testid="input-refill-dose-unit" />
                </label>
                <label>
                  <span className="font-body text-[12px] font-bold text-vyva-text-2">Times each day</span>
                  <input value={draft.dailyFrequency} onChange={(event) => setDraft({ ...draft, dailyFrequency: event.target.value })} type="number" min="0.01" max="24" step="0.01" inputMode="decimal" className="mt-1 min-h-[50px] w-full rounded-[14px] border border-[#DED1C3] bg-white px-3 font-body text-[16px] font-bold text-vyva-text-1" data-testid="input-refill-frequency" />
                </label>
              </div>
              <label className="mt-3 block rounded-[14px] border border-[#E7D5A7] bg-white p-3">
                <span className="font-body text-[12px] font-black text-vyva-text-1">How many {pluralUnit(2, draft.inventoryUnit)} do you use each time?</span>
                <span className="mt-1 block font-body text-[11px] font-semibold text-vyva-text-2">This controls refill tracking only. It does not change the prescribed dose.</span>
                <input value={draft.inventoryUnitsPerDose} onChange={(event) => setDraft({ ...draft, inventoryUnitsPerDose: event.target.value })} type="number" min="0.01" step="0.01" inputMode="decimal" className="mt-2 min-h-[50px] w-full rounded-[14px] border border-[#DED1C3] bg-white px-3 font-body text-[16px] font-bold text-vyva-text-1" data-testid="input-refill-inventory-units-per-dose" />
              </label>
              <label className="mt-3 block">
                <span className="font-body text-[12px] font-bold text-vyva-text-2">Warn me when this many days remain</span>
                <input value={draft.refillAlertDays} onChange={(event) => setDraft({ ...draft, refillAlertDays: event.target.value })} type="number" min="1" max="90" className="mt-1 min-h-[50px] w-full rounded-[14px] border border-[#DED1C3] bg-white px-3 font-body text-[16px] font-bold text-vyva-text-1" data-testid="input-refill-threshold" />
              </label>
            </div>

            <div className="flex items-start gap-3 rounded-[16px] border border-[#D8CFF7] bg-[#F8F6FF] p-3" data-testid="refill-draft-projection">
              <Clock3 size={20} className="mt-0.5 shrink-0 text-vyva-purple" aria-hidden="true" />
              <div>
                <p className="font-body text-[13px] font-black text-vyva-text-1">Projected run-out date</p>
                <p className="mt-1 font-body text-[14px] font-semibold text-vyva-text-2">{draftRunOutDate(draft) ? formatDate(draftRunOutDate(draft)) : "Confirm the quantity and routine to see an estimate."}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-[16px] border border-[#CDEAE5] bg-[#F2FBF9] p-3">
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
              <p className="font-body text-[12px] font-semibold leading-relaxed text-[#35645F]">VYVA uses this only to estimate remaining supply. It does not change your dose, order medicine, or contact anyone.</p>
            </div>
            {saveError ? <p role="alert" className="rounded-[14px] bg-[#FFF1F0] p-3 font-body text-[13px] font-bold text-[#9B2C21]">{saveError}</p> : null}
            <button type="button" onClick={validateAndSave} disabled={saveMutation.isPending} className="vyva-tap flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[18px] bg-vyva-purple px-5 font-body text-[17px] font-black text-white shadow-[0_12px_26px_rgba(112,36,196,0.22)] disabled:opacity-55" data-testid="button-refill-save">
              <Check size={20} aria-hidden="true" /> {saveMutation.isPending ? "Recalculating…" : "Save and recalculate"}
            </button>
          </div>
        </section>
      ) : (
        <div className="space-y-5 pt-4">
          <section className="overflow-hidden rounded-[30px] border border-[#E4D7EA] bg-white shadow-[0_22px_58px_rgba(83,49,99,0.11)]" data-testid="refill-hero">
            <div className="bg-[linear-gradient(145deg,#FBF4FF_0%,#FFF7E5_100%)] p-6">
              <div className="flex items-start gap-4">
                <CanonicalFlowIcon icon={leadMedicine ? statusMeta(leadMedicine.status).icon : PackageOpen} tone={leadMedicine ? statusMeta(leadMedicine.status).tone : "purple"} goldAccent="spark" className="!h-12 !w-12 !rounded-[16px]" />
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-[#9A6700]">{hero.eyebrow}</p>
                  <h2 className="mt-2 font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.035em] text-vyva-text-1">{hero.title}</h2>
                  <p className="mt-3 font-body text-[15px] font-semibold leading-relaxed text-vyva-text-2">{hero.body}</p>
                </div>
              </div>
            </div>
            {medicines.length && canManageInventory ? (
              <div className="p-5">
                <button type="button" onClick={() => openUpdate(leadMedicine)} className="vyva-tap flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[18px] bg-vyva-purple px-5 font-body text-[17px] font-black text-white shadow-[0_12px_26px_rgba(112,36,196,0.22)]" data-testid="button-update-medicine-supply">
                  <PackageOpen size={21} aria-hidden="true" /> Update medicine supply
                </button>
                <p className="mt-3 text-center font-body text-[12px] font-semibold text-vyva-text-2">Reminder only · VYVA never orders or contacts anyone</p>
              </div>
            ) : null}
          </section>

          {medicines.map((medicine) => {
            const meta = statusMeta(medicine.status);
            return (
              <article key={medicine.medicineId} className="rounded-[26px] border border-[#E7DCEC] bg-white p-5 shadow-[0_16px_40px_rgba(74,45,92,0.075)]" data-testid={`refill-medicine-${medicine.medicineId}`}>
                <div className="flex items-start gap-3">
                  <CanonicalFlowIcon icon={Pill} tone="purple" goldAccent="pill" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-display text-[22px] font-semibold leading-tight text-vyva-text-1">{medicine.medicineName}</h3>
                        {medicine.strength ? <p className="mt-1 font-body text-[13px] font-bold text-vyva-text-2">{medicine.strength}</p> : null}
                      </div>
                      <span className={`rounded-full px-3 py-1.5 font-body text-[11px] font-black ${meta.chip}`}>{meta.label}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-[16px] bg-[#F8F5FB] p-3">
                    <p className="font-body text-[11px] font-black uppercase tracking-[0.06em] text-vyva-text-2">Estimated left</p>
                    <p className="mt-1 font-display text-[20px] font-semibold text-vyva-text-1">{medicine.estimatedQuantity === null ? "—" : `${medicine.estimatedQuantity} ${pluralUnit(medicine.estimatedQuantity, medicine.inventoryUnit ?? medicine.doseUnit)}`}</p>
                  </div>
                  <div className="rounded-[16px] bg-[#FFF9E9] p-3">
                    <p className="font-body text-[11px] font-black uppercase tracking-[0.06em] text-vyva-text-2">Days remaining</p>
                    <p className="mt-1 font-display text-[20px] font-semibold text-vyva-text-1">{medicine.daysRemaining === null ? "—" : medicine.daysRemaining}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-[14px] border border-[#EEE5E1] bg-[#FFFCFA] px-3 py-2.5">
                  <CalendarDays size={17} className="shrink-0 text-[#9A6700]" aria-hidden="true" />
                  <p className="font-body text-[12px] font-bold text-vyva-text-2">Projected run-out: <span className="text-vyva-text-1">{formatDate(medicine.projectedRunOutDate)}</span></p>
                </div>
                <p className="mt-3 font-body text-[12px] font-semibold leading-relaxed text-vyva-text-2">{medicine.calculationReason}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-body text-[11px] font-bold text-vyva-text-2">{medicine.confidence[0].toUpperCase() + medicine.confidence.slice(1)} confidence{medicine.updatedBy ? ` · Updated by ${medicine.updatedBy.name}` : ""}</span>
                  {canManageInventory ? <button type="button" onClick={() => openUpdate(medicine)} className="vyva-tap min-h-[44px] rounded-full border border-[#D8C7E8] bg-[#FAF7FF] px-4 font-body text-[13px] font-black text-vyva-purple">Update</button> : <span className="rounded-full bg-[#F6F2FA] px-3 py-2 font-body text-[11px] font-black text-[#746A72]">View only</span>}
                </div>

                {medicine.history.length ? (
                  <details className="mt-4 border-t border-[#EEE5E1] pt-3">
                    <summary className="vyva-tap flex min-h-[44px] cursor-pointer list-none items-center gap-2 font-body text-[13px] font-black text-vyva-purple">
                      <History size={17} aria-hidden="true" /> Supply history
                    </summary>
                    <div className="mt-2 space-y-2">
                      {medicine.history.map((event) => (
                        <div key={event.id} className="flex items-center justify-between gap-3 rounded-[13px] bg-[#F9F6FA] px-3 py-2.5">
                          <div>
                            <p className="font-body text-[12px] font-black text-vyva-text-1">{event.type === "purchase" ? "Purchase added" : event.type === "stock_count" ? "Stock counted" : "Manual correction"}</p>
                            <p className="mt-0.5 font-body text-[11px] font-semibold text-vyva-text-2">{formatDate(event.occurredOn)} · Updated by {event.updatedBy}</p>
                          </div>
                          <span className="font-body text-[13px] font-black text-vyva-text-1">{event.quantity} {pluralUnit(event.quantity, event.unit)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {evidence ? (
        <ShowVyvaCaptureCoach
          evidence={evidence}
          useCaseId="medicine_or_otc"
          busy={captureBusy}
          onUse={(prepared) => { void extractPhoto(prepared); }}
          onRetake={() => { setEvidence(null); fileInputRef.current?.click(); }}
          onClose={() => setEvidence(null)}
        />
      ) : null}
    </CanonicalDetailFlowShell>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Camera, Check, ChevronLeft, FileText, Mic, PackageOpen, Pencil, Pill, Plus, ShoppingCart, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/queryClient";
import { CanonicalFlowIcon } from "@/components/CanonicalDetailFlowShell";
import ShowVyvaCaptureCoach from "@/components/ShowVyvaCaptureCoach";
import { prepareShowVyvaEvidenceFile, type ShowVyvaPreparedEvidence } from "@/lib/showVyvaEvidence";

type MyMedicine = {
  id: string;
  display_name: string;
  common_name?: string | null;
  dose_text?: string | null;
  purpose_text?: string | null;
  item_type: "prescription" | "otc" | "supplement";
  drug_class_tag?: string | null;
  photo_url?: string | null;
  prescriber_name?: string | null;
  refill_due_date?: string | null;
  dose_unit?: string | null;
  units_per_dose?: number | null;
  inventory_unit?: string | null;
  inventory_units_per_dose?: number | null;
  daily_frequency?: number | null;
  inventory_tracking_enabled?: boolean;
  refill_alert_days?: number;
  schedule_times?: string[] | null;
  status: "active" | "paused" | "discontinued";
};

type MyMedicinesResponse = {
  medicines: MyMedicine[];
  classTags: string[];
};

type AddForm = {
  display_name: string;
  purpose_text: string;
  drug_class_tag: string;
  dose_text: string;
  item_type: "prescription" | "otc" | "supplement";
  added_via: "voice" | "manual" | "photo";
  photo_url: string;
  dose_unit: string;
  units_per_dose: string;
  inventory_unit: string;
  inventory_units_per_dose: string;
  daily_frequency: string;
  initial_quantity: string;
  purchased_on: string;
  refill_alert_days: string;
  inventory_tracking_enabled: boolean;
};

const EMPTY_FORM: AddForm = {
  display_name: "",
  purpose_text: "",
  drug_class_tag: "other_uncategorized",
  dose_text: "",
  item_type: "prescription",
  added_via: "manual",
  photo_url: "",
  dose_unit: "tablet",
  units_per_dose: "1",
  inventory_unit: "tablet",
  inventory_units_per_dose: "1",
  daily_frequency: "1",
  initial_quantity: "",
  purchased_on: new Date().toISOString().slice(0, 10),
  refill_alert_days: "7",
  inventory_tracking_enabled: true,
};

const CLASS_LABELS: Record<string, string> = {
  blood_pressure_lowering: "Blood pressure",
  blood_thinner: "Blood thinner",
  nsaid_pain_reliever: "Pain reliever",
  opioid_pain_reliever: "Strong pain relief",
  sedative_sleep_aid: "Sleep aid",
  diabetes_blood_sugar: "Blood sugar",
  diuretic_water_pill: "Water pill",
  antidepressant: "Mood medicine",
  statin_cholesterol: "Cholesterol",
  supplement_herbal: "Herbal supplement",
  antihistamine_allergy: "Allergy",
  other_uncategorized: "Something else",
};

const FORM_STEPS = ["name", "purpose", "schedule", "supply", "confirm"] as const;

type PhotoExtractResponse = {
  draft: {
    medicineName: string;
    strength: string;
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
  warnings: string[];
  imageRetained: false;
};

function projectedSupply(form: AddForm) {
  const quantity = Number(form.initial_quantity);
  const dailyUse = Number(form.inventory_units_per_dose) * Number(form.daily_frequency);
  if (!form.initial_quantity.trim() || quantity < 0 || dailyUse <= 0 || !form.purchased_on) return null;
  const days = Math.floor(quantity / dailyUse);
  const date = new Date(`${form.purchased_on}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return { days, date: date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) };
}

function supplyUnitLabel(quantity: string, unit: string) {
  if (unit === "ml" || Number(quantity) === 1) return unit;
  return ({ tablet: "tablets", capsule: "capsules", single_dose_container: "single-dose containers", bottle: "bottles", sachet: "sachets", dose: "doses", patch: "patches" } as Record<string, string>)[unit] ?? unit;
}

function frequencyLabel(value: string) {
  if (Number(value) === 1) return "once daily";
  if (Number(value) === 2) return "twice daily";
  return `${value} times daily`;
}

function truncateAtWord(value: string, maxLength: number) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) return trimmed;
  const slice = trimmed.slice(0, maxLength + 1);
  const lastSpace = slice.lastIndexOf(" ");
  const safeSlice = lastSpace > 0 ? slice.slice(0, lastSpace) : trimmed;
  return `${safeSlice.trimEnd()}...`;
}

export default function MyMedicines({
  onStartVoice,
  onOpenReminders,
  onOpenRefills,
  startAdd = false,
}: {
  onStartVoice?: () => void;
  onOpenReminders?: () => void;
  onOpenRefills?: () => void;
  startAdd?: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showPrevious, setShowPrevious] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<MyMedicine | null>(null);
  const [addChoiceOpen, setAddChoiceOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<AddForm>(EMPTY_FORM);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<AddForm>(EMPTY_FORM);
  const [evidence, setEvidence] = useState<ShowVyvaPreparedEvidence | null>(null);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [photoConfidence, setPhotoConfidence] = useState<PhotoExtractResponse["confidence"] | null>(null);
  const [photoWarnings, setPhotoWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (startAdd) setAddChoiceOpen(true);
  }, [startAdd]);

  const { data, isLoading } = useQuery<MyMedicinesResponse>({
    queryKey: ["/api/meds/my-medicines"],
  });

  const classTags = data?.classTags?.length ? data.classTags : Object.keys(CLASS_LABELS);
  const activeMedicines = useMemo(
    () => (data?.medicines ?? []).filter((medicine) => medicine.status === "active"),
    [data?.medicines],
  );
  const previousMedicines = useMemo(
    () => (data?.medicines ?? []).filter((medicine) => medicine.status !== "active"),
    [data?.medicines],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch("/api/meds/my-medicines", {
        method: "POST",
        body: JSON.stringify({
          display_name: form.display_name,
          purpose_text: form.purpose_text,
          drug_class_tag: form.drug_class_tag,
          dose_text: form.dose_text,
          item_type: form.item_type,
          added_via: form.added_via,
          photo_url: null,
          dose_unit: form.dose_unit,
          units_per_dose: Number(form.units_per_dose),
          inventory_unit: form.inventory_unit,
          inventory_units_per_dose: Number(form.inventory_units_per_dose),
          daily_frequency: Number(form.daily_frequency),
          inventory_tracking_enabled: form.inventory_tracking_enabled,
          refill_alert_days: Number(form.refill_alert_days),
          initial_quantity: Number(form.initial_quantity),
          purchased_on: form.purchased_on,
        }),
      });
      if (!response.ok) throw new Error("Failed to save medicine");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meds/my-medicines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/interactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/refills/me"] });
      setForm(EMPTY_FORM);
      setStepIndex(0);
      setAddOpen(false);
      setPhotoConfidence(null);
      setPhotoWarnings([]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ medicineId, values }: { medicineId: string; values: AddForm }) => {
      const response = await apiFetch(`/api/meds/my-medicines/${medicineId}`, {
        method: "PATCH",
        body: JSON.stringify({
          display_name: values.display_name,
          purpose_text: values.purpose_text,
          drug_class_tag: values.drug_class_tag,
          dose_text: values.dose_text,
          item_type: values.item_type,
        }),
      });
      if (!response.ok) throw new Error("Failed to update medicine");
      return response.json() as Promise<{ medicine: MyMedicine }>;
    },
    onSuccess: ({ medicine }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/meds/my-medicines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/interactions"] });
      setSelectedMedicine(medicine);
      setEditOpen(false);
    },
  });

  const discontinueMutation = useMutation({
    mutationFn: async (medicineId: string) => {
      const response = await apiFetch(`/api/meds/my-medicines/${medicineId}/discontinue`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to discontinue medicine");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meds/my-medicines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/interactions"] });
      setSelectedMedicine(null);
    },
  });

  const currentStep = FORM_STEPS[stepIndex];
  const canContinue = currentStep === "name"
    ? form.display_name.trim().length > 0
    : currentStep === "purpose"
      ? form.purpose_text.trim().length > 0
      : currentStep === "schedule"
        ? form.dose_text.trim().length > 0
        : currentStep === "supply"
          ? Boolean(
            form.initial_quantity.trim()
            && Number(form.initial_quantity) >= 0
            && form.inventory_unit.trim()
            && Number(form.inventory_units_per_dose) > 0
            && Number(form.daily_frequency) > 0
            && form.purchased_on
            && Number(form.refill_alert_days) >= 1,
          )
          : true;
  const supplyProjection = projectedSupply(form);

  function beginAdd(addedVia: AddForm["added_via"]) {
    if (addedVia === "voice" && onStartVoice) {
      setAddChoiceOpen(false);
      onStartVoice();
      return;
    }
    setForm({ ...EMPTY_FORM, added_via: addedVia });
    setStepIndex(0);
    setAddChoiceOpen(false);
    setAddOpen(true);
  }

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    setCaptureError(null);
    if (!addOpen) beginAdd("photo");
    try {
      setEvidence(await prepareShowVyvaEvidenceFile(file));
    } catch {
      setCaptureError(t("meds.myMedicines.photoError", "That photo could not be prepared. Try a clear photo of the full medicine label."));
    }
  }

  async function extractPhoto(prepared: ShowVyvaPreparedEvidence) {
    setCaptureBusy(true);
    setCaptureError(null);
    try {
      const response = await apiFetch("/api/meds/refills/me/photo-extract", {
        method: "POST",
        body: JSON.stringify({ image: prepared.dataUrl, language: navigator.language || "en" }),
      });
      const result = await response.json() as PhotoExtractResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || t("meds.myMedicines.photoReadError", "VYVA could not read the label."));
      setForm((current) => ({
        ...current,
        display_name: result.draft.medicineName || current.display_name,
        dose_text: result.draft.strength || current.dose_text,
        initial_quantity: result.draft.inventoryQuantity === null ? current.initial_quantity : String(result.draft.inventoryQuantity),
        inventory_unit: result.draft.inventoryUnit || current.inventory_unit,
        purchased_on: result.draft.purchasedOn || current.purchased_on,
        added_via: "photo",
      }));
      setPhotoConfidence(result.confidence);
      setPhotoWarnings(result.warnings);
      setEvidence(null);
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : t("meds.myMedicines.photoReadError", "VYVA could not read the label."));
      setEvidence(null);
    } finally {
      setCaptureBusy(false);
    }
  }

  function startEdit(medicine: MyMedicine) {
    setEditForm({
      display_name: medicine.display_name,
      purpose_text: medicine.purpose_text ?? "",
      drug_class_tag: medicine.drug_class_tag ?? "other_uncategorized",
      dose_text: medicine.dose_text ?? "",
      item_type: medicine.item_type,
      added_via: "manual",
      photo_url: medicine.photo_url ?? "",
      dose_unit: medicine.dose_unit ?? "tablet",
      units_per_dose: String(medicine.units_per_dose ?? 1),
      inventory_unit: medicine.inventory_unit ?? medicine.dose_unit ?? "tablet",
      inventory_units_per_dose: String(medicine.inventory_units_per_dose ?? medicine.units_per_dose ?? 1),
      daily_frequency: String(medicine.daily_frequency ?? 1),
      initial_quantity: "",
      purchased_on: new Date().toISOString().slice(0, 10),
      refill_alert_days: String(medicine.refill_alert_days ?? 7),
      inventory_tracking_enabled: medicine.inventory_tracking_enabled ?? false,
    });
    setEditOpen(true);
  }

  function medicineDoseLine(medicine: MyMedicine) {
    return truncateAtWord(medicine.dose_text || t("meds.myMedicines.routineMissing", "Routine to add"), 82);
  }

  function medicinePurposeLine(medicine: MyMedicine) {
    return truncateAtWord(medicine.purpose_text || t("meds.myMedicines.purposeMissing", "Purpose to add"), 74);
  }

  const isAddingMedicine = addOpen || addChoiceOpen;

  if (selectedMedicine) {
    return (
      <section className="mt-3 rounded-[28px] border border-[#E6DCEB] bg-white p-[22px] shadow-[0_16px_40px_rgba(63,45,75,0.08)]" data-testid="section-my-medicines-detail" data-accent-contract="ask-dr-ai-surface">
        <button
          type="button"
          onClick={() => {
            if (editOpen) {
              setEditOpen(false);
              return;
            }
            setSelectedMedicine(null);
          }}
          className="vyva-tap inline-flex min-h-[48px] items-center gap-2 rounded-[17px] border border-[#DED3E2] bg-white px-4 font-body text-[16px] font-black text-[#7024C4]"
        >
          <ChevronLeft size={18} strokeWidth={2.35} aria-hidden="true" />
          {t("meds.myMedicines.back", "Back")}
        </button>

        {editOpen ? (
          <div className="mt-5" data-testid="panel-my-medicine-edit">
            <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-[#854F0B]">
              {t("meds.myMedicines.reviewBeforeSave", "Review before saving")}
            </p>
            <h2 className="mt-1 font-body text-[28px] font-extrabold leading-[1.08] tracking-[-0.025em] text-[#241238]">
              {t("meds.myMedicines.editTitle", "Edit medicine")}
            </h2>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5 font-body text-[15px] font-black text-vyva-text-1">
                {t("meds.myMedicines.nameLabel", "Medicine name")}
                <input
                  value={editForm.display_name}
                  onChange={(event) => setEditForm((current) => ({ ...current, display_name: event.target.value }))}
                  className="min-h-[56px] rounded-[18px] border border-[#DED3E2] bg-white px-4 text-[17px] font-bold outline-none focus:border-[#7024C4]"
                />
              </label>
              <label className="grid gap-1.5 font-body text-[15px] font-black text-vyva-text-1">
                {t("meds.myMedicines.scheduleLabel", "Dose and routine from the label")}
                <input
                  value={editForm.dose_text}
                  onChange={(event) => setEditForm((current) => ({ ...current, dose_text: event.target.value }))}
                  className="min-h-[56px] rounded-[18px] border border-[#DED3E2] bg-white px-4 text-[17px] font-bold outline-none focus:border-[#7024C4]"
                />
              </label>
              <label className="grid gap-1.5 font-body text-[15px] font-black text-vyva-text-1">
                {t("meds.myMedicines.purposeLabel", "What it is for")}
                <input
                  value={editForm.purpose_text}
                  onChange={(event) => setEditForm((current) => ({ ...current, purpose_text: event.target.value }))}
                  className="min-h-[56px] rounded-[18px] border border-[#DED3E2] bg-white px-4 text-[17px] font-bold outline-none focus:border-[#7024C4]"
                />
              </label>
              <label className="grid gap-1.5 font-body text-[15px] font-black text-vyva-text-1">
                {t("meds.myMedicines.itemType", "Medicine kind")}
                <select
                  value={editForm.item_type}
                  onChange={(event) => setEditForm((current) => ({ ...current, item_type: event.target.value as AddForm["item_type"] }))}
                  className="min-h-[56px] rounded-[18px] border border-[#DED3E2] bg-white px-4 text-[17px] font-bold outline-none focus:border-[#7024C4]"
                >
                  <option value="prescription">{t("meds.myMedicines.prescription", "Prescription")}</option>
                  <option value="otc">{t("meds.myMedicines.otc", "Over the counter")}</option>
                  <option value="supplement">{t("meds.myMedicines.supplement", "Vitamin or supplement")}</option>
                </select>
              </label>
            </div>
            <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="font-body text-[14px] font-bold leading-snug text-amber-900">
                {t("meds.myMedicines.editSafety", "Copy the label wording. This screen does not change or recommend a dose.")}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="vyva-tap min-h-[56px] rounded-[18px] border border-[#DED3E2] bg-white px-4 font-body text-[17px] font-black text-vyva-purple"
              >
                {t("common.cancel", "Cancel")}
              </button>
              <button
                type="button"
                data-testid="button-my-medicine-save-edit"
                disabled={!editForm.display_name.trim() || !editForm.dose_text.trim() || updateMutation.isPending}
                onClick={() => updateMutation.mutate({ medicineId: selectedMedicine.id, values: editForm })}
                className="vyva-tap min-h-[56px] rounded-[18px] bg-vyva-purple px-4 font-body text-[17px] font-black text-white disabled:opacity-50"
              >
                {updateMutation.isPending ? t("common.saving", "Saving...") : t("meds.myMedicines.saveChanges", "Confirm changes")}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 flex items-start gap-3">
              <CanonicalFlowIcon icon={Pill} goldAccent="pill" />
              <h2 className="min-w-0 font-body text-[28px] font-extrabold leading-[1.08] tracking-[-0.025em] text-[#241238]">{selectedMedicine.display_name}</h2>
            </div>
            <dl className="mt-5 divide-y divide-[#E9E0EC] rounded-[18px] border border-[#DED3E2] bg-[#FCFAFD] px-4">
              <div className="py-3">
                <dt className="font-body text-[11px] font-black uppercase tracking-[0.08em] text-[#746A72]">{t("meds.myMedicines.scheduleLabel", "Dose and routine")}</dt>
                <dd className="mt-1 font-body text-[16px] font-black leading-snug text-[#241238]">{selectedMedicine.dose_text || t("meds.myMedicines.noDose", "Routine not added yet")}</dd>
              </div>
              <div className="py-3">
                <dt className="font-body text-[11px] font-black uppercase tracking-[0.08em] text-[#746A72]">{t("meds.myMedicines.purposeLabel", "What it is for")}</dt>
                <dd className="mt-1 font-body text-[15px] font-bold leading-snug text-[#241238]">{selectedMedicine.purpose_text || t("meds.myMedicines.noPurpose", "Purpose not added yet")}</dd>
              </div>
              {selectedMedicine.prescriber_name ? <div className="py-3"><dt className="font-body text-[11px] font-black uppercase tracking-[0.08em] text-[#746A72]">{t("meds.myMedicines.prescriber", "Prescribed by")}</dt><dd className="mt-1 font-body text-[15px] font-bold text-[#241238]">{selectedMedicine.prescriber_name}</dd></div> : null}
              {selectedMedicine.refill_due_date ? <div className="py-3"><dt className="font-body text-[11px] font-black uppercase tracking-[0.08em] text-[#746A72]">{t("meds.myMedicines.refillDue", "Next refill")}</dt><dd className="mt-1 font-body text-[15px] font-bold text-[#241238]">{selectedMedicine.refill_due_date}</dd></div> : null}
            </dl>
            <button
              type="button"
              data-testid="button-my-medicine-edit"
              onClick={() => startEdit(selectedMedicine)}
              className="vyva-tap mt-6 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] bg-vyva-purple px-5 font-body text-[17px] font-black text-white"
            >
              <Pencil size={18} strokeWidth={2.35} aria-hidden="true" />
              {t("meds.myMedicines.editDetails", "Review and edit details")}
            </button>
            <button
              type="button"
              data-testid="button-my-medicine-discontinue"
              onClick={() => discontinueMutation.mutate(selectedMedicine.id)}
              disabled={discontinueMutation.isPending}
              className="vyva-tap mt-3 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] border border-[#FBCACA] bg-[#FEF2F2] px-5 font-body text-[17px] font-black text-[#B91C1C]"
            >
              <Check size={18} strokeWidth={2.35} aria-hidden="true" />
              {t("meds.myMedicines.discontinue", "Mark as discontinued")}
            </button>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="mt-3 rounded-[28px] border border-[#E6DCEB] bg-white p-[22px] shadow-[0_16px_40px_rgba(63,45,75,0.08)]" data-testid="section-my-medicines" data-accent-contract="ask-dr-ai-surface">
      <div>
        <span className="sr-only">{t("meds.myMedicines.title", "My Medicines")}</span>
        <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-[#854F0B]">
          {isAddingMedicine ? t("meds.myMedicines.addTitle", "Add medicine") : t("meds.myMedicines.savedKicker", "Saved medicines")}
        </p>
        <h2 className="mt-1 font-body text-[28px] font-extrabold leading-[1.08] tracking-[-0.025em] text-[#241238] sm:text-[31px]">
          {isAddingMedicine
            ? addChoiceOpen
              ? t("meds.myMedicines.addChoiceTitle", "How would you like to add it?")
              : t("meds.myMedicines.addDetailsTitle", "Copy the label details")
            : t("meds.myMedicines.currentTitle", "Your current medicines")}
        </h2>
        {!isAddingMedicine ? (
          <p className="mt-2 font-body text-[15px] font-semibold leading-[1.42] text-[#746A72]">
            {activeMedicines.length === 1
              ? t("meds.myMedicines.savedCountOne", "1 medicine saved")
              : t("meds.myMedicines.savedCountMany", { count: activeMedicines.length, defaultValue: "{{count}} medicines saved" })}
          </p>
        ) : null}
        {isAddingMedicine ? (
          <button
            type="button"
            data-testid="button-my-medicines-list"
            onClick={() => {
              setAddOpen(false);
              setAddChoiceOpen(false);
            }}
            className="vyva-tap mt-4 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[17px] border border-[#DED3E2] bg-white px-4 font-body text-[15px] font-black text-vyva-purple"
          >
            <ChevronLeft size={18} strokeWidth={2.35} aria-hidden="true" />
            {t("meds.myMedicines.list", "List")}
          </button>
        ) : null}
      </div>

      {addOpen ? (
        <div className="mt-5 border-t border-[#E9E0EC] pt-5" data-testid="panel-my-medicines-add">
          <button
            type="button"
            onClick={() => {
              setAddOpen(false);
              setAddChoiceOpen(true);
            }}
            className="vyva-tap mb-4 inline-flex min-h-[48px] items-center gap-2 rounded-[17px] border border-[#DED3E2] bg-white px-4 font-body text-[15px] font-black text-vyva-purple"
          >
            <ChevronLeft size={18} strokeWidth={2.35} aria-hidden="true" />
            {t("meds.myMedicines.method", "Method")}
          </button>
          {currentStep === "confirm" ? (
            <>
              <p className="font-body text-[22px] font-black leading-snug text-vyva-text-1">
                {t("meds.myMedicines.confirm", "I will add this medicine. Is it correct?")}
              </p>
              <p className="mt-3 rounded-[20px] bg-white p-4 font-body text-[22px] font-black leading-snug text-[#0F4C45]">
                {[form.display_name, form.dose_text, form.purpose_text].filter(Boolean).join(", ")}
              </p>
              <div className="mt-3 rounded-[20px] border border-[#E2D5F1] bg-[linear-gradient(135deg,#FBF7FF_0%,#FFF9ED_100%)] p-4" data-testid="add-medicine-supply-review">
                <div className="flex items-start gap-3">
                  <CanonicalFlowIcon icon={PackageOpen} goldAccent="package" />
                  <div>
                    <p className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#854F0B]">
                      {t("meds.myMedicines.supplyReady", "Refill tracking ready")}
                    </p>
                    <p className="mt-1 font-body text-[17px] font-black text-[#241238]">
                      {form.initial_quantity} {supplyUnitLabel(form.initial_quantity, form.inventory_unit)} · {form.inventory_units_per_dose} used each time · {frequencyLabel(form.daily_frequency)}
                    </p>
                    <p className="mt-1 font-body text-[14px] font-bold text-[#746A72]">
                      {supplyProjection
                        ? t("meds.myMedicines.coverageSummary", { days: supplyProjection.days, date: supplyProjection.date, defaultValue: "About {{days}} days of supply, until {{date}}." })
                        : t("meds.myMedicines.coveragePending", "Confirm the supply details to calculate coverage.")}
                    </p>
                  </div>
                </div>
              </div>
              {photoConfidence ? (
                <p className="mt-3 rounded-[18px] border border-[#E2D5F1] bg-[#F8F4FF] px-4 py-3 font-body text-[14px] font-bold leading-snug text-[#5F4C69]">
                  <Sparkles className="mr-2 inline text-[#7024C4]" size={17} aria-hidden="true" />
                  {photoConfidence === "high"
                    ? t("meds.myMedicines.photoReviewClear", "Clear package details found. Check every field—the image has been discarded.")
                    : t("meds.myMedicines.photoReviewNeeded", "Some package details need your review. The image has been discarded.")}
                </p>
              ) : null}
              {photoWarnings.length ? (
                <ul className="mt-3 list-disc rounded-[18px] border border-amber-200 bg-amber-50 px-8 py-3 font-body text-[14px] font-bold leading-snug text-amber-900">
                  {photoWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              ) : null}
              <p className="mt-3 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 font-body text-[14px] font-bold leading-snug text-amber-900">
                {t("meds.myMedicines.confirmSafety", "Check this against the medicine label. Saving it does not change your prescribed dose.")}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setStepIndex(0)} className="vyva-tap min-h-[56px] rounded-[18px] border border-[#DED3E2] bg-white px-5 font-body text-[17px] font-black text-vyva-purple">
                  {t("meds.myMedicines.edit", "Edit")}
                </button>
                <button
                  type="button"
                  data-testid="button-my-medicines-save"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                  className="vyva-tap min-h-[56px] rounded-[18px] bg-vyva-purple px-5 font-body text-[17px] font-black text-white"
                >
                  {t("meds.myMedicines.save", "Yes, save")}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="font-body text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-[#241238]">
                {currentStep === "name"
                  ? t("meds.myMedicines.nameQuestion", "What do you call it?")
                  : currentStep === "purpose"
                    ? t("meds.myMedicines.purposeQuestion", "What is it for?")
                    : currentStep === "schedule"
                      ? t("meds.myMedicines.scheduleQuestion", "When do you take it?")
                      : t("meds.myMedicines.supplyQuestion", "How much medicine do you have?")}
              </p>
              {currentStep === "name" ? (
                <input
                  value={form.display_name}
                  onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))}
                  placeholder={t("meds.myMedicines.namePlaceholder", "e.g. little white heart pill")}
                  className="mt-4 min-h-[56px] w-full rounded-[18px] border border-[#DED3E2] bg-white px-4 font-body text-[18px] font-bold text-vyva-text-1 outline-none focus:border-[#7024C4]"
                />
              ) : currentStep === "purpose" ? (
                <div className="mt-4 grid gap-3">
                  <input
                    value={form.purpose_text}
                    onChange={(event) => setForm((current) => ({ ...current, purpose_text: event.target.value }))}
                    placeholder={t("meds.myMedicines.purposePlaceholder", "e.g. for blood pressure")}
                    className="min-h-[56px] w-full rounded-[18px] border border-[#DED3E2] bg-white px-4 font-body text-[18px] font-bold text-vyva-text-1 outline-none focus:border-[#7024C4]"
                  />
                  <select
                    value={form.drug_class_tag}
                    onChange={(event) => setForm((current) => ({ ...current, drug_class_tag: event.target.value }))}
                    className="min-h-[56px] w-full rounded-[18px] border border-[#DED3E2] bg-white px-4 font-body text-[17px] font-bold text-vyva-text-1 outline-none focus:border-[#7024C4]"
                    aria-label={t("meds.myMedicines.classLabel", "Medicine type")}
                  >
                    {classTags.map((tag) => (
                      <option key={tag} value={tag}>{CLASS_LABELS[tag] ?? tag}</option>
                    ))}
                  </select>
                  <select
                    value={form.item_type}
                    onChange={(event) => setForm((current) => ({ ...current, item_type: event.target.value as AddForm["item_type"] }))}
                    className="min-h-[56px] w-full rounded-[18px] border border-[#DED3E2] bg-white px-4 font-body text-[17px] font-bold text-vyva-text-1 outline-none focus:border-[#7024C4]"
                    aria-label={t("meds.myMedicines.itemType", "Medicine kind")}
                  >
                    <option value="prescription">{t("meds.myMedicines.prescription", "Prescription")}</option>
                    <option value="otc">{t("meds.myMedicines.otc", "Over the counter")}</option>
                    <option value="supplement">{t("meds.myMedicines.supplement", "Vitamin or supplement")}</option>
                  </select>
                </div>
              ) : currentStep === "schedule" ? (
                <input
                  value={form.dose_text}
                  onChange={(event) => setForm((current) => ({ ...current, dose_text: event.target.value }))}
                  placeholder={t("meds.myMedicines.schedulePlaceholder", "e.g. 1 pill in the morning")}
                  aria-label={t("meds.myMedicines.scheduleLabel", "Dose and routine")}
                  className="mt-4 min-h-[56px] w-full rounded-[18px] border border-[#DED3E2] bg-white px-4 font-body text-[18px] font-bold text-vyva-text-1 outline-none focus:border-[#7024C4]"
                />
              ) : (
                <div className="mt-4 grid gap-4" data-testid="panel-add-medicine-supply">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="vyva-tap flex min-h-[76px] items-center gap-3 rounded-[20px] border border-[#D8C4EE] bg-[linear-gradient(135deg,#FBF7FF_0%,#FFF9ED_100%)] px-4 py-3 text-left"
                  >
                    <CanonicalFlowIcon icon={Camera} goldAccent="camera" />
                    <span>
                      <span className="block font-body text-[16px] font-black text-[#241238]">{t("meds.myMedicines.usePackagePhoto", "Use a package photo")}</span>
                      <span className="sr-only">{t("meds.myMedicines.photoOptional", "Optional · you review everything before saving")}</span>
                    </span>
                  </button>
                  {captureError ? <p role="alert" className="rounded-[16px] bg-red-50 px-4 py-3 font-body text-[14px] font-bold text-red-800">{captureError}</p> : null}
                  <div className="grid grid-cols-[1fr_1.1fr] gap-3">
                    <label className="grid gap-1.5 font-body text-[14px] font-black text-[#241238]">
                      {t("meds.myMedicines.quantityLabel", "Package quantity")}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.initial_quantity}
                        onChange={(event) => setForm((current) => ({ ...current, initial_quantity: event.target.value }))}
                        className="min-h-[56px] rounded-[18px] border border-[#DED3E2] bg-white px-4 text-[17px] font-bold outline-none focus:border-[#7024C4]"
                      />
                    </label>
                    <label className="grid gap-1.5 font-body text-[14px] font-black text-[#241238]">
                      {t("meds.myMedicines.unitLabel", "Unit")}
                      <select
                        value={form.inventory_unit}
                        onChange={(event) => setForm((current) => ({ ...current, inventory_unit: event.target.value }))}
                        className="min-h-[56px] rounded-[18px] border border-[#DED3E2] bg-white px-3 text-[16px] font-bold outline-none focus:border-[#7024C4]"
                      >
                        <option value="tablet">{t("meds.myMedicines.unitTablet", "Tablets")}</option>
                        <option value="capsule">{t("meds.myMedicines.unitCapsule", "Capsules")}</option>
                        <option value="ml">{t("meds.myMedicines.unitMl", "ml")}</option>
                        <option value="single_dose_container">{t("meds.myMedicines.unitSingleDoseContainer", "Single-dose containers")}</option>
                        <option value="bottle">{t("meds.myMedicines.unitBottle", "Bottles")}</option>
                        <option value="sachet">{t("meds.myMedicines.unitSachet", "Sachets")}</option>
                        <option value="dose">{t("meds.myMedicines.unitDose", "Doses")}</option>
                        <option value="patch">{t("meds.myMedicines.unitPatch", "Patches")}</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1.5 font-body text-[14px] font-black text-[#241238]">
                      {t("meds.myMedicines.inventoryUnitsPerDose", "Stock units used each time")}
                      <input type="number" min="0.01" step="0.01" value={form.inventory_units_per_dose} onChange={(event) => setForm((current) => ({ ...current, inventory_units_per_dose: event.target.value }))} className="min-h-[56px] rounded-[18px] border border-[#DED3E2] bg-white px-4 text-[17px] font-bold outline-none focus:border-[#7024C4]" />
                    </label>
                    <label className="grid gap-1.5 font-body text-[14px] font-black text-[#241238]">
                      {t("meds.myMedicines.dailyFrequency", "Times each day")}
                      <input type="number" min="0.01" step="0.01" value={form.daily_frequency} onChange={(event) => setForm((current) => ({ ...current, daily_frequency: event.target.value }))} className="min-h-[56px] rounded-[18px] border border-[#DED3E2] bg-white px-4 text-[17px] font-bold outline-none focus:border-[#7024C4]" />
                    </label>
                  </div>
                  <label className="grid gap-1.5 font-body text-[14px] font-black text-[#241238]">
                    {t("meds.myMedicines.purchaseDate", "Purchase or supply date")}
                    <span className="relative">
                      <CalendarDays className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#854F0B]" size={19} aria-hidden="true" />
                      <input type="date" max={new Date().toISOString().slice(0, 10)} value={form.purchased_on} onChange={(event) => setForm((current) => ({ ...current, purchased_on: event.target.value }))} className="min-h-[56px] w-full rounded-[18px] border border-[#DED3E2] bg-white pl-12 pr-4 text-[17px] font-bold outline-none focus:border-[#7024C4]" />
                    </span>
                  </label>
                  <label className="grid gap-1.5 font-body text-[14px] font-black text-[#241238]">
                    {t("meds.myMedicines.alertThreshold", "Warn me when this many days remain")}
                    <input type="number" min="1" max="90" step="1" value={form.refill_alert_days} onChange={(event) => setForm((current) => ({ ...current, refill_alert_days: event.target.value }))} className="min-h-[56px] rounded-[18px] border border-[#DED3E2] bg-white px-4 text-[17px] font-bold outline-none focus:border-[#7024C4]" />
                  </label>
                  <div className="rounded-[18px] border border-[#E2D5F1] bg-[#FBF9FF] px-4 py-3">
                    <p className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#854F0B]">{t("meds.myMedicines.estimatedCoverage", "Estimated coverage")}</p>
                    <p className="mt-1 font-body text-[16px] font-black text-[#241238]">
                      {supplyProjection ? t("meds.myMedicines.coverageSummary", { days: supplyProjection.days, date: supplyProjection.date, defaultValue: "About {{days}} days of supply, until {{date}}." }) : t("meds.myMedicines.enterQuantity", "Enter the package quantity to see an estimate.")}
                    </p>
                  </div>
                </div>
              )}
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => setStepIndex((current) => current + 1)}
                className="vyva-tap mt-4 min-h-[56px] w-full rounded-[18px] bg-vyva-purple px-5 font-body text-[17px] font-black text-white disabled:opacity-50"
              >
                {t("common.next", "Next")}
              </button>
            </>
          )}
        </div>
      ) : addChoiceOpen ? (
        <div
          className="mt-5 border-t border-[#E9E0EC] pt-5"
          data-testid="panel-my-medicines-add-choice"
          aria-label={t("meds.myMedicines.addChoiceTitle", "Choose method")}
        >
          <p className="mb-4 font-body text-[15px] font-semibold leading-[1.42] text-[#746A72]">
            {t("meds.myMedicines.addChoiceHelp", "Use voice or type the wording from the medicine label. You will review everything before it is saved.")}
          </p>
          <div className="grid gap-2">
            <button type="button" onClick={() => beginAdd("voice")} className="vyva-tap flex min-h-[60px] items-center gap-3 rounded-[18px] border border-[#DED3E2] bg-white px-4 py-3 text-left shadow-[0_6px_16px_rgba(63,45,35,0.04)]">
              <CanonicalFlowIcon icon={Mic} goldAccent="mic" />
              <span className="font-body text-[16px] font-black text-[#241238]">{t("meds.myMedicines.voice", "Use voice")}</span>
            </button>
            <button type="button" onClick={() => beginAdd("manual")} className="vyva-tap flex min-h-[60px] items-center gap-3 rounded-[18px] border border-[#DED3E2] bg-white px-4 py-3 text-left shadow-[0_6px_16px_rgba(63,45,35,0.04)]">
              <CanonicalFlowIcon icon={Pencil} goldAccent="pencil" />
              <span className="font-body text-[16px] font-black text-[#241238]">{t("meds.myMedicines.manual", "Type it in")}</span>
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="vyva-tap flex min-h-[60px] items-center gap-3 rounded-[18px] border border-[#D8C4EE] bg-[linear-gradient(135deg,#FBF7FF_0%,#FFF9ED_100%)] px-4 py-3 text-left shadow-[0_6px_16px_rgba(63,45,35,0.04)]">
              <CanonicalFlowIcon icon={Camera} goldAccent="camera" />
              <span>
                <span className="block font-body text-[16px] font-black text-[#241238]">{t("meds.myMedicines.photo", "Take or upload a photo")}</span>
                <span className="sr-only">{t("meds.myMedicines.photoSub", "VYVA drafts the label and supply details")}</span>
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {!addOpen && !addChoiceOpen ? (
        <>
          <div className="mt-5 grid gap-3" data-testid="list-my-medicines-active">
            {isLoading ? (
              <p className="font-body text-[20px] font-black text-vyva-text-2">{t("common.loading", "Loading...")}</p>
            ) : activeMedicines.length ? (
              activeMedicines.map((medicine, index) => (
                <div key={medicine.id}>
                  {index === 1 ? (
                    <p className="mb-2 mt-2 px-1 font-body text-[12px] font-black uppercase tracking-[0.1em] text-[#746A72]">
                      {t("meds.myMedicines.otherMedicines", "Other medicines")}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    data-testid={index === 0 ? "button-current-medicine-hero" : undefined}
                    onClick={() => setSelectedMedicine(medicine)}
                    className={`vyva-tap flex w-full items-center gap-3 border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7024C4] focus-visible:ring-offset-2 ${
                      index === 0
                        ? "min-h-[132px] rounded-[24px] border-[#D8C4EE] bg-[linear-gradient(135deg,#FBF7FF_0%,#FFF9ED_100%)] px-5 py-5 shadow-[0_14px_32px_rgba(83,51,104,0.10)]"
                        : "min-h-[84px] rounded-[18px] border-[#DED3E2] bg-white px-4 py-3 shadow-[0_6px_16px_rgba(63,45,35,0.04)]"
                    }`}
                  >
                    <CanonicalFlowIcon
                      icon={Pill}
                      goldAccent="pill"
                      className={index === 0 ? "!h-14 !w-14 !rounded-[18px]" : ""}
                    />
                    <div className="min-w-0 flex-1">
                      {index === 0 ? (
                        <p className="mb-1 font-body text-[11px] font-black uppercase tracking-[0.1em] text-[#854F0B]">
                          {t("meds.myMedicines.currentMedicine", "Current medicine")}
                        </p>
                      ) : null}
                      <h3 className={`break-words font-body font-black leading-tight text-vyva-text-1 ${index === 0 ? "text-[24px]" : "text-[17px]"}`}>{medicine.display_name}</h3>
                      <p className={`mt-1 break-words font-body font-black leading-snug text-[#0F4C45] ${index === 0 ? "text-[16px]" : "text-[14px]"}`}>{medicineDoseLine(medicine)}</p>
                      <p className={`mt-1 break-words font-body font-bold leading-snug text-vyva-text-2 ${index === 0 ? "text-[14px]" : "text-[13px]"}`}>{medicinePurposeLine(medicine)}</p>
                    </div>
                    <ChevronLeft className="flex-shrink-0 rotate-180 text-[#8D6AA2]" size={19} strokeWidth={2.35} aria-hidden="true" />
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-[18px] border border-dashed border-[#D8C4EE] bg-[#FBF8FF] p-5 text-center">
                <p className="font-body text-[20px] font-black text-vyva-text-1">{t("meds.myMedicines.emptyTitle", "No medicines saved yet")}</p>
                <p className="mx-auto mt-2 max-w-[310px] font-body text-[15px] font-semibold leading-[1.42] text-vyva-text-2">{t("meds.myMedicines.emptySub", "Add prescriptions, vitamins, and over-the-counter items here.")}</p>
              </div>
            )}
          </div>

          <button
            type="button"
            data-testid="button-my-medicines-add"
            onClick={() => {
              setAddOpen(false);
              setAddChoiceOpen(true);
            }}
            className="vyva-tap mt-4 flex min-h-[60px] w-full items-center gap-3 rounded-[18px] border border-[#DED3E2] bg-[#FCFAFD] px-4 py-3 text-left transition hover:border-[#B99BCE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7024C4] focus-visible:ring-offset-2"
          >
            <CanonicalFlowIcon icon={Plus} goldAccent="plus" />
            <span className="font-body text-[16px] font-black text-[#241238]">{t("meds.myMedicines.add", "Add medicine")}</span>
          </button>

          {previousMedicines.length ? (
            <div className="mt-5">
              <button type="button" onClick={() => setShowPrevious((value) => !value)} className="vyva-tap min-h-[52px] rounded-[17px] border border-[#DED3E2] bg-white px-4 font-body text-[15px] font-black text-vyva-text-2">
                {showPrevious ? t("meds.myMedicines.hidePrevious", "Hide previous medicines") : t("meds.myMedicines.showPrevious", "Show previous medicines")}
              </button>
              {showPrevious ? (
                <div className="mt-3 grid gap-2">
                  {previousMedicines.map((medicine) => (
                    <p key={medicine.id} className="rounded-[18px] bg-[#F6F2EA] px-4 py-3 font-body text-[18px] font-bold text-vyva-text-2">
                      {medicine.display_name}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <details className="group mt-5 rounded-[18px] border border-[#E7DCF8] bg-[#FBF9FF] p-2" data-testid="my-medicines-more-help">
            <summary className="vyva-tap flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 rounded-[16px] px-3 font-body text-[16px] font-black text-vyva-purple">
              <span>{t("meds.myMedicines.moreHelp", "Reminders and refill help")}</span>
              <ChevronLeft className="rotate-180 transition-transform group-open:rotate-[270deg]" size={18} strokeWidth={2.35} aria-hidden="true" />
            </summary>
            <div className="mt-2 grid gap-2">
              <button type="button" onClick={onOpenReminders} className="vyva-tap flex min-h-[60px] items-center gap-3 rounded-[18px] border border-[#DED3E2] bg-white px-4 py-3 text-left">
                <CanonicalFlowIcon icon={FileText} goldAccent="document" />
                <span className="font-body text-[16px] font-black text-[#241238]">{t("meds.myMedicines.reminders", "History & progress")}</span>
              </button>
              <button type="button" onClick={onOpenRefills} className="vyva-tap flex min-h-[60px] items-center gap-3 rounded-[18px] border border-[#DED3E2] bg-white px-4 py-3 text-left">
                <CanonicalFlowIcon icon={ShoppingCart} goldAccent="cart" />
                <span className="font-body text-[16px] font-black text-[#241238]">{t("meds.myMedicines.refills", "Check refill need")}</span>
              </button>
            </div>
          </details>
        </>
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        data-testid="input-add-medicine-photo"
        onChange={(event) => {
          void handlePhoto(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
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
    </section>
  );
}

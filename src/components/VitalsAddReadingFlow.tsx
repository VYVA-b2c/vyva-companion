import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bluetooth,
  Camera,
  Check,
  ChevronRight,
  Droplet,
  FileImage,
  HeartPulse,
  Keyboard,
  Loader2,
  Mic,
  Moon,
  Pill,
  RefreshCw,
  Scale,
  ShieldCheck,
  Smile,
  Thermometer,
  Wind,
  Zap,
} from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import VitalLensFaceScan from "@/components/VitalLensFaceScan";
import VitalsScan from "@/components/VitalsScan";
import { VyvaIcon, type VyvaIconAccent } from "@/components/brand/VyvaIcon";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { VITALS_DEVICE_CATALOG, vitalsDeviceModelById } from "@/lib/vitalsDeviceCatalog";
import { bluetoothReadErrorCode, isWebBluetoothSupported, readStandardBluetoothDevice } from "@/lib/vitalsBluetooth";
import {
  VITALS_SIGNAL_CATALOG,
  VITALS_SIGNAL_KEYS,
  type VitalsCaptureMethod,
  type VitalsDisplayGroup,
  type VitalsSignalKey,
} from "../../shared/vitalsSignalCatalog";
import { compatibleCaptureMethods, type VitalsMeasurementEnvelope } from "../../shared/vitalsAcquisition";
import { formatVitalsReadingDisplay, type ProposedVitalsReading, type VitalsParsingResult } from "../../shared/vitalsParsing";
import type { VitalsVoiceFlowState, VitalsVoiceScanStatus, VitalsVoiceStage } from "@/lib/vitalsVoiceContext";

const GROUP_ORDER: VitalsDisplayGroup[] = ["heart", "breathing", "blood", "body", "wellbeing", "activity", "labs"];
const GROUP_LABELS: Record<VitalsDisplayGroup, string> = {
  heart: "Heart",
  breathing: "Breathing",
  blood: "Blood",
  body: "Body",
  wellbeing: "Wellbeing",
  activity: "Activity",
  labs: "Labs",
};

const METHOD_DETAILS: Record<VitalsCaptureMethod, { label: string; hint: string; Icon: typeof Activity }> = {
  web_bluetooth: { label: "Bluetooth device", hint: "Read directly from a nearby compatible device", Icon: Bluetooth },
  phone_camera: { label: "Phone camera", hint: "Estimate pulse or breathing using the camera", Icon: Camera },
  device_photo: { label: "Device photo", hint: "Read the number shown on a monitor or meter", Icon: FileImage },
  voice: { label: "Say the reading", hint: "Speak naturally, then confirm what VYVA heard", Icon: Mic },
  manual: { label: "Type the reading", hint: "Enter the number or a short phrase", Icon: Keyboard },
  oauth_import: { label: "Wearable or app", hint: "Use a connected health service", Icon: RefreshCw },
  clinical_import: { label: "Clinical record", hint: "Use a reading shared by your care team", Icon: ShieldCheck },
};

type VitalsFlowLanguage = "es" | "de" | "en" | "fr" | "it" | "pt";

const FRENCH_GROUP_LABELS: Record<VitalsDisplayGroup, string> = {
  heart: "Cœur",
  breathing: "Respiration",
  blood: "Sang",
  body: "Corps",
  wellbeing: "Bien-être",
  activity: "Activité",
  labs: "Analyses",
};

const FRENCH_SIGNAL_LABELS: Partial<Record<VitalsSignalKey, string>> = {
  resting_hr_bpm: "Pouls",
  respiratory_rate: "Fréquence respiratoire",
  bp_systolic: "Tension systolique",
  bp_diastolic: "Tension diastolique",
  oxygen_saturation: "Saturation en oxygène",
  temperature_c: "Température",
  glucose_mgdl: "Glycémie",
  weight_kg: "Poids",
  pain_score: "Douleur",
  mood_score: "Humeur",
  energy_level: "Énergie",
  sleep_quality_score: "Sommeil",
  medication_confirmed: "Médicament pris",
};

const SIGNAL_PICKER_ICONS: Partial<Record<VitalsSignalKey, typeof Activity>> = {
  resting_hr_bpm: HeartPulse,
  respiratory_rate: Wind,
  bp_systolic: ArrowUp,
  bp_diastolic: ArrowDown,
  oxygen_saturation: Droplet,
  temperature_c: Thermometer,
  glucose_mgdl: Droplet,
  weight_kg: Scale,
  pain_score: Activity,
  mood_score: Smile,
  energy_level: Zap,
  sleep_quality_score: Moon,
  medication_confirmed: Pill,
};

const SIGNAL_PICKER_ACCENTS: Partial<Record<VitalsSignalKey, VyvaIconAccent>> = {
  resting_hr_bpm: "pulse",
  respiratory_rate: "signal",
  bp_systolic: "trend",
  bp_diastolic: "trend",
  oxygen_saturation: "dot",
  temperature_c: "dot",
  glucose_mgdl: "dot",
  weight_kg: "dot",
  pain_score: "pulse",
  mood_score: "smile",
  energy_level: "spark",
  sleep_quality_score: "spark",
  medication_confirmed: "check",
};

const BLOOD_PRESSURE_PICKER_LABELS: Record<VitalsFlowLanguage, string> = {
  en: "Blood pressure",
  fr: "Tension artérielle",
  es: "Tensión arterial",
  de: "Blutdruck",
  it: "Pressione arteriosa",
  pt: "Pressão arterial",
};

const CAMERA_RESULT_TITLES: Record<VitalsFlowLanguage, string> = {
  en: "Heart rate & breathing",
  fr: "Pouls et respiration",
  es: "Frecuencia cardíaca y respiración",
  de: "Herzfrequenz und Atmung",
  it: "Frequenza cardiaca e respirazione",
  pt: "Frequência cardíaca e respiração",
};

const BLOOD_PRESSURE_ACCESSIBLE_LABELS: Record<
  VitalsFlowLanguage,
  { systolic: string; diastolic: string }
> = {
  en: { systolic: "Systolic blood pressure", diastolic: "Diastolic blood pressure" },
  fr: { systolic: "Tension artérielle systolique", diastolic: "Tension artérielle diastolique" },
  es: { systolic: "Presión arterial sistólica", diastolic: "Presión arterial diastólica" },
  de: { systolic: "Systolischer Blutdruck", diastolic: "Diastolischer Blutdruck" },
  it: { systolic: "Pressione arteriosa sistolica", diastolic: "Pressione arteriosa diastolica" },
  pt: { systolic: "Pressão arterial sistólica", diastolic: "Pressão arterial diastólica" },
};

function pickerSignalLabel(signal: VitalsSignalKey, language: VitalsFlowLanguage) {
  if (signal === "bp_systolic" || signal === "bp_diastolic") {
    return BLOOD_PRESSURE_PICKER_LABELS[language];
  }
  if (language === "fr") {
    return FRENCH_SIGNAL_LABELS[signal] ?? VITALS_SIGNAL_CATALOG[signal].label;
  }
  return VITALS_SIGNAL_CATALOG[signal].label;
}

function pickerSignalAccessibleLabel(signal: VitalsSignalKey, language: VitalsFlowLanguage) {
  if (signal === "bp_systolic") return BLOOD_PRESSURE_ACCESSIBLE_LABELS[language].systolic;
  if (signal === "bp_diastolic") return BLOOD_PRESSURE_ACCESSIBLE_LABELS[language].diastolic;
  return pickerSignalLabel(signal, language);
}

const FRENCH_METHOD_DETAILS: Record<VitalsCaptureMethod, { label: string; hint: string }> = {
  web_bluetooth: { label: "Appareil Bluetooth", hint: "Lire directement un appareil compatible à proximité" },
  phone_camera: { label: "Caméra du téléphone", hint: "Estimer le pouls ou la respiration avec la caméra" },
  device_photo: { label: "Photo de l’appareil", hint: "Lire le nombre affiché sur un moniteur ou un lecteur" },
  voice: { label: "Dire la mesure", hint: "Parlez naturellement, puis confirmez ce que VYVA a compris" },
  manual: { label: "Saisir la mesure", hint: "Entrez le nombre ou une courte phrase" },
  oauth_import: { label: "Objet connecté ou application", hint: "Utiliser un service de santé connecté" },
  clinical_import: { label: "Dossier clinique", hint: "Utiliser une mesure transmise par votre équipe soignante" },
};

const FLOW_COPY = {
  en: {
    addReading: "Add a reading",
    pickerTitle: "What would you like to add?",
    yesNo: "Yes or no",
    alreadyTitle: "Already being tracked",
    alreadyBody: "The latest reading is available, so you do not need to add it again.",
    useLatest: "Use latest reading",
    logAnyway: "Log anyway",
    chooseMethod: "Choose the easiest way to add it. You will confirm before anything is saved.",
    phoneWarning: "Phone-camera estimates are for trends and do not affect triage.",
    takePhoto: "Take or upload a device photo",
    photoHint: "Keep the full number and unit clearly visible.",
    lookingDevice: "Looking for your device…",
    bluetoothDevice: "Bluetooth device",
    configuredDevice: "Configured device",
    tryAgain: "Try again",
    listening: "Listening…",
    startSpeaking: "Start speaking",
    typeReading: "Type the reading",
    reviewReading: "Review reading",
    confirm: "Confirm before saving",
    save: "Save confirmed reading",
    trackedVia: (label: string, device: string) => `${label} is already being tracked via ${device}.`,
    clinicalRecord: "your clinical record",
    connectedDevice: "a connected device",
    phoneEstimate: "Phone camera estimate.",
    errors: {
      load: "Could not load capture options",
      readValue: "Could not read that value",
      noVital: "I could not find that vital in the phrase.",
      simplerPhrase: "Please try a simpler phrase.",
      voiceUnavailable: "Voice entry is not available in this browser. You can type the reading instead.",
      voiceUnclear: "I could not hear that clearly. Try again or type the reading.",
      photoRead: "I could not read that photo.",
      photoMissing: "That vital was not visible in the photo.",
      photoRetry: "Try a clearer photo or type the reading.",
      bluetoothMissing: "No standard Bluetooth device is registered for this vital.",
      bluetoothUnavailable: "Bluetooth is not available in this browser. Choose photo, voice, or manual entry instead.",
      bluetoothValue: "The device did not return this vital.",
      bluetoothRead: "Could not read the Bluetooth device.",
      bluetoothCancelled: "No device was selected. Try again when you are ready.",
      bluetoothConnection: "Could not connect. Keep the device awake and nearby, then try again.",
      bluetoothService: "This device does not expose the expected standard measurement service.",
      bluetoothTimeout: "No measurement arrived. Take a fresh reading while the device stays nearby.",
      bluetoothEmpty: "The device connected but did not send a measurement.",
      bluetoothParse: "VYVA does not yet support the measurement format sent by this device.",
      save: "Could not save the reading.",
      retry: "Please try again.",
    },
  },
  fr: {
    addReading: "Ajouter une mesure",
    pickerTitle: "Que souhaitez-vous ajouter ?",
    yesNo: "Oui ou non",
    alreadyTitle: "Déjà suivi",
    alreadyBody: "La dernière mesure est disponible ; vous n’avez pas besoin de l’ajouter à nouveau.",
    useLatest: "Utiliser la dernière mesure",
    logAnyway: "Ajouter quand même",
    chooseMethod: "Choisissez la méthode la plus simple. Vous confirmerez la mesure avant son enregistrement.",
    phoneWarning: "Les estimations par caméra servent à suivre les tendances et n’influencent pas le triage.",
    takePhoto: "Prendre ou importer une photo de l’appareil",
    photoHint: "Veillez à ce que le nombre complet et l’unité soient clairement visibles.",
    lookingDevice: "Recherche de votre appareil…",
    bluetoothDevice: "Appareil Bluetooth",
    configuredDevice: "Appareil configuré",
    tryAgain: "Réessayer",
    listening: "Écoute en cours…",
    startSpeaking: "Commencer à parler",
    typeReading: "Saisissez la mesure",
    reviewReading: "Vérifier la mesure",
    confirm: "Confirmer avant l’enregistrement",
    save: "Enregistrer la mesure confirmée",
    trackedVia: (label: string, device: string) => `${label} est déjà suivi via ${device}.`,
    clinicalRecord: "votre dossier clinique",
    connectedDevice: "un appareil connecté",
    phoneEstimate: "Estimation par caméra du téléphone.",
    errors: {
      load: "Impossible de charger les options de mesure",
      readValue: "Impossible de lire cette valeur",
      noVital: "Aucune constante n’a été trouvée dans cette phrase.",
      simplerPhrase: "Essayez une phrase plus simple.",
      voiceUnavailable: "La saisie vocale n’est pas disponible dans ce navigateur. Vous pouvez saisir la mesure.",
      voiceUnclear: "Je n’ai pas bien entendu. Réessayez ou saisissez la mesure.",
      photoRead: "Impossible de lire cette photo.",
      photoMissing: "Cette constante n’est pas visible sur la photo.",
      photoRetry: "Essayez une photo plus nette ou saisissez la mesure.",
      bluetoothMissing: "Aucun appareil Bluetooth standard n’est enregistré pour cette constante.",
      bluetoothUnavailable: "Bluetooth n’est pas disponible dans ce navigateur. Choisissez la photo, la voix ou la saisie manuelle.",
      bluetoothValue: "L’appareil n’a pas transmis cette constante.",
      bluetoothRead: "Impossible de lire l’appareil Bluetooth.",
      bluetoothCancelled: "Aucun appareil n’a été sélectionné. Réessayez lorsque vous êtes prêt.",
      bluetoothConnection: "Connexion impossible. Gardez l’appareil allumé et à proximité, puis réessayez.",
      bluetoothService: "Cet appareil n’expose pas le service de mesure Bluetooth standard attendu.",
      bluetoothTimeout: "Aucune mesure reçue. Effectuez une nouvelle mesure en gardant l’appareil à proximité.",
      bluetoothEmpty: "L’appareil est connecté mais n’a transmis aucune mesure.",
      bluetoothParse: "VYVA ne prend pas encore en charge le format de mesure transmis par cet appareil.",
      save: "Impossible d’enregistrer la mesure.",
      retry: "Veuillez réessayer.",
    },
  },
} as const;

const METHOD_ACCENTS: Record<VitalsCaptureMethod, VyvaIconAccent> = {
  web_bluetooth: "link",
  phone_camera: "pulse",
  device_photo: "spark",
  voice: "signal",
  manual: "dot",
  oauth_import: "link",
  clinical_import: "check",
};

type AcquisitionSignal = {
  signal_type: VitalsSignalKey;
  current_reading: VitalsMeasurementEnvelope | null;
  compatible_methods: VitalsCaptureMethod[];
};

export type VitalsAcquisitionContext = {
  readings: VitalsMeasurementEnvelope[];
  signals: AcquisitionSignal[];
  devices: Array<{
    id?: string | null;
    deviceName?: string | null;
    capabilities?: VitalsSignalKey[];
    metadata?: Record<string, unknown>;
  }>;
};

type SpeechRecognitionEventLike = {
  results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function sourceDeviceName(
  reading: VitalsMeasurementEnvelope,
  context: VitalsAcquisitionContext | null,
  copy: typeof FLOW_COPY.en | typeof FLOW_COPY.fr,
) {
  const sourceRef = reading.sourceRef ?? {};
  const explicitName = typeof sourceRef.device_name === "string"
    ? sourceRef.device_name
    : typeof sourceRef.deviceName === "string"
      ? sourceRef.deviceName
      : null;
  if (explicitName) return explicitName;
  const registered = context?.devices.find((device) => device.capabilities?.includes(reading.signalType));
  return registered?.deviceName || (reading.source === "clinical" ? copy.clinicalRecord : copy.connectedDevice);
}

function configuredDeviceForSignal(context: VitalsAcquisitionContext | null, signal: VitalsSignalKey | null) {
  if (!signal) return undefined;
  return context?.devices.find((device) => device.capabilities?.includes(signal));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function proposedPayload(reading: ProposedVitalsReading) {
  return {
    signal_type: reading.signal_type,
    value: reading.value,
    source: reading.source,
    capture_method: reading.capture_method,
    context_tag: reading.context_tag,
    unit: reading.unit,
    recorded_at: reading.recorded_at,
    source_ref: reading.source_ref,
  };
}

export default function VitalsAddReadingFlow({
  onBack,
  onSaved,
  previewMode = false,
  previewContext,
  initialSignal,
  onBackActionChange,
  onVoiceStateChange,
  language = "en",
}: {
  onBack: () => void;
  onSaved: () => void | Promise<void>;
  previewMode?: boolean;
  previewContext?: VitalsAcquisitionContext | null;
  initialSignal?: VitalsSignalKey | null;
  onBackActionChange?: (handler: (() => void) | null) => void;
  onVoiceStateChange?: (state: VitalsVoiceFlowState) => void;
  language?: VitalsFlowLanguage;
}) {
  const { isDark } = useHomeMasterTheme();
  const isFrench = language === "fr";
  const flowCopy = isFrench ? FLOW_COPY.fr : FLOW_COPY.en;
  const [stage, setStage] = useState<VitalsVoiceStage>("vital");
  const [context, setContext] = useState<VitalsAcquisitionContext | null>(previewContext ?? null);
  const [selectedSignal, setSelectedSignal] = useState<VitalsSignalKey | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<VitalsCaptureMethod | null>(null);
  const [inputText, setInputText] = useState("");
  const [proposed, setProposed] = useState<ProposedVitalsReading[]>([]);
  const [loadingContext, setLoadingContext] = useState(!previewMode);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [useLocalCameraEstimate, setUseLocalCameraEstimate] = useState(false);
  const [vitalLensStatus, setVitalLensStatus] = useState<VitalsVoiceScanStatus>("idle");

  const activeSignals = useMemo(
    () => VITALS_SIGNAL_KEYS.filter((key) => !VITALS_SIGNAL_CATALOG[key].futureReady),
    [],
  );
  const groupedSignals = useMemo(() => GROUP_ORDER.flatMap((group) => {
    const signals = activeSignals.filter((key) => VITALS_SIGNAL_CATALOG[key].displayGroup === group);
    return signals.length ? [{ group, signals }] : [];
  }), [activeSignals]);

  useEffect(() => {
    if (previewMode) {
      setContext(previewContext ?? { readings: [], signals: [], devices: [] });
      setLoadingContext(false);
      return;
    }
    let cancelled = false;
    const signalList = activeSignals.join(",");
    void apiFetch(`/api/vitals-engine/acquisition-context?signals=${signalList}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(flowCopy.errors.load);
        const payload = await response.json() as VitalsAcquisitionContext;
        if (!cancelled) setContext(payload);
      })
      .catch(() => {
        if (!cancelled) setContext({ readings: [], signals: [], devices: [] });
      })
      .finally(() => {
        if (!cancelled) setLoadingContext(false);
      });
    return () => { cancelled = true; };
  }, [activeSignals, flowCopy.errors.load, previewContext, previewMode]);

  const currentSignalContext = selectedSignal
    ? context?.signals.find((signal) => signal.signal_type === selectedSignal) ?? null
    : null;
  const currentReading = currentSignalContext?.current_reading ?? null;
  const alreadyTracked = currentReading && (currentReading.source === "connected_device" || currentReading.source === "clinical")
    ? currentReading
    : null;
  const methods = selectedSignal ? compatibleCaptureMethods(selectedSignal) : [];

  const chooseSignal = useCallback((signal: VitalsSignalKey) => {
    setSelectedSignal(signal);
    setSelectedMethod(null);
    setInputText("");
    setProposed([]);
    setError("");
    setUseLocalCameraEstimate(false);
    setVitalLensStatus("idle");
    const tracked = context?.signals.find((item) => item.signal_type === signal)?.current_reading;
    setStage(tracked && (tracked.source === "connected_device" || tracked.source === "clinical") ? "tracked" : "method");
  }, [context]);

  useEffect(() => {
    if (loadingContext || !initialSignal || selectedSignal || stage !== "vital") return;
    chooseSignal(initialSignal);
  }, [chooseSignal, initialSignal, loadingContext, selectedSignal, stage]);

  const chooseMethod = (method: VitalsCaptureMethod) => {
    setSelectedMethod(method);
    setProposed([]);
    setError("");
    setUseLocalCameraEstimate(false);
    setVitalLensStatus("idle");
    setStage("capture");
    if (method === "web_bluetooth") void startBluetooth();
  };

  const parseText = async () => {
    if (!inputText.trim() || !selectedMethod) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch("/api/vitals-engine/parse-text", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          text: inputText.trim(),
          source: "manual_entry",
          capture_method: selectedMethod,
        }),
      });
      if (!response.ok) throw new Error(flowCopy.errors.readValue);
      const result = await response.json() as VitalsParsingResult;
      const matches = result.proposed_readings.filter((reading) => reading.signal_type === selectedSignal);
      if (!matches.length) throw new Error(result.clarification_prompt || flowCopy.errors.noVital);
      setProposed(matches);
      setStage("confirm");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : flowCopy.errors.simplerPhrase);
    } finally {
      setBusy(false);
    }
  };

  const startVoice = () => {
    const recognitionConstructor = (window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    }).SpeechRecognition ?? (window as typeof window & { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
    if (!recognitionConstructor) {
      setError(flowCopy.errors.voiceUnavailable);
      return;
    }
    const recognition = new recognitionConstructor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-GB";
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      setInputText(transcript);
    };
    recognition.onerror = () => setError(flowCopy.errors.voiceUnclear);
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  const scanDevicePhoto = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch("/api/vitals-engine/scan-device-photo", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ image: await fileToDataUrl(file) }),
      });
      if (!response.ok) throw new Error(flowCopy.errors.photoRead);
      const result = await response.json() as VitalsParsingResult;
      const matches = result.proposed_readings.filter((reading) => reading.signal_type === selectedSignal);
      if (!matches.length) throw new Error(result.clarification_prompt || flowCopy.errors.photoMissing);
      setProposed(matches);
      setStage("confirm");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : flowCopy.errors.photoRetry);
    } finally {
      setBusy(false);
    }
  };

  async function startBluetooth() {
    if (!selectedSignal) return;
    const device = VITALS_DEVICE_CATALOG.find((item) => item.signals.includes(selectedSignal));
    if (!device) {
      setError(flowCopy.errors.bluetoothMissing);
      return;
    }
    if (!isWebBluetoothSupported()) {
      setError(flowCopy.errors.bluetoothUnavailable);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const configuredDevice = context?.devices.find((item) => item.id === device.id) ?? configuredDeviceForSignal(context, selectedSignal);
      const modelId = typeof configuredDevice?.metadata?.model_id === "string" ? configuredDevice.metadata.model_id : null;
      const configuredModel = vitalsDeviceModelById(modelId);
      const result = await readStandardBluetoothDevice(device, () => undefined, configuredModel ?? undefined);
      const matches = result.readings.filter((reading) => reading.signal_type === selectedSignal);
      if (!matches.length) throw new Error(flowCopy.errors.bluetoothValue);
      setProposed(matches);
      setStage("confirm");
    } catch (cause) {
      const code = bluetoothReadErrorCode(cause);
      const messages = {
        unsupported: flowCopy.errors.bluetoothUnavailable,
        user_cancelled: flowCopy.errors.bluetoothCancelled,
        connection_failed: flowCopy.errors.bluetoothConnection,
        service_unavailable: flowCopy.errors.bluetoothService,
        measurement_timeout: flowCopy.errors.bluetoothTimeout,
        empty_measurement: flowCopy.errors.bluetoothEmpty,
        parse_failed: flowCopy.errors.bluetoothParse,
      } as const;
      setError(code ? messages[code] : flowCopy.errors.bluetoothRead);
    } finally {
      setBusy(false);
    }
  }

  const saveConfirmed = async () => {
    if (!proposed.length) return;
    setBusy(true);
    setError("");
    try {
      if (!previewMode) {
        const response = await apiFetch("/api/vitals-engine/readings", {
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ readings: proposed.map(proposedPayload) }),
        });
        if (!response.ok) throw new Error(flowCopy.errors.save);
        window.dispatchEvent(new Event("vyva:vitals-updated"));
      }
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : flowCopy.errors.retry);
    } finally {
      setBusy(false);
    }
  };

  const resetToVital = useCallback(() => {
    setStage("vital");
    setSelectedSignal(null);
    setSelectedMethod(null);
    setInputText("");
    setProposed([]);
    setError("");
    setUseLocalCameraEstimate(false);
    setVitalLensStatus("idle");
  }, []);

  const back = useCallback(() => {
    if (stage === "vital") {
      onBack();
      return;
    }
    if (stage === "tracked" || stage === "method") {
      resetToVital();
      return;
    }
    setStage("method");
  }, [onBack, resetToVital, stage]);

  useEffect(() => {
    onBackActionChange?.(back);
    return () => onBackActionChange?.(null);
  }, [back, onBackActionChange]);

  const selectedMeta = selectedSignal ? VITALS_SIGNAL_CATALOG[selectedSignal] : null;
  const selectedLabel = selectedSignal && isFrench
    ? FRENCH_SIGNAL_LABELS[selectedSignal] ?? selectedMeta?.label
    : selectedMeta?.label;
  const headingLabel = selectedMethod === "phone_camera" && proposed.length > 1
    ? CAMERA_RESULT_TITLES[language]
    : selectedLabel;
  const configuredBluetoothDevice = configuredDeviceForSignal(context, selectedSignal);
  const voicePendingReadings = useMemo(() => proposed.map((reading) => ({
    signal: reading.signal_type,
    value: reading.value,
    unit: reading.unit ?? null,
    source: reading.source ?? null,
    confidence: reading.confidence ?? null,
  })), [proposed]);
  const voiceScanStatus: VitalsVoiceScanStatus | null = selectedMethod === "phone_camera"
    ? useLocalCameraEstimate ? "local_estimate" : vitalLensStatus
    : null;

  useEffect(() => {
    onVoiceStateChange?.({
      stage,
      selectedSignal,
      selectedSignalLabel: selectedLabel ?? null,
      captureMethod: selectedMethod,
      scanStatus: voiceScanStatus,
      pendingReadings: voicePendingReadings,
      busy,
      listening,
    });
  }, [busy, listening, onVoiceStateChange, selectedLabel, selectedMethod, selectedSignal, stage, voicePendingReadings, voiceScanStatus]);

  return (
    <section className={`-mx-2 w-[calc(100%+1rem)] sm:mx-0 sm:w-auto sm:rounded-[30px] sm:border sm:p-5 ${isDark ? "text-[#FFF8FF] sm:border-white/[0.14] sm:bg-[#2B2035] sm:shadow-[0_22px_48px_rgba(0,0,0,0.22)]" : "text-[#241238] sm:border-[#E6DCEB] sm:bg-[#FFFCF8] sm:shadow-[0_16px_40px_rgba(63,45,75,0.08)]"}`} data-testid="vitals-add-flow">
      <header className="mb-4 px-1 sm:mb-6 sm:px-0">
        <p className={`font-body text-[11px] font-black uppercase tracking-[0.12em] ${isDark ? "text-[#C4A7FF]" : "text-[#7024C4]"}`}>{flowCopy.addReading}</p>
        <h2 className={`mt-1 max-w-[310px] font-body text-[27px] font-extrabold leading-[1.08] tracking-[-0.025em] sm:max-w-none sm:text-[31px] ${isDark ? "text-[#FFF8FF]" : "text-[#241238]"}`}>
          {stage === "vital" ? flowCopy.pickerTitle : headingLabel}
        </h2>
      </header>

      {stage === "vital" ? (
        loadingContext ? (
          <div className="flex min-h-[220px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#7C3AED]" /></div>
        ) : (
          <div className="space-y-4 sm:space-y-5">
            {groupedSignals.map(({ group, signals }) => (
              <div key={group}>
                <p className={`mb-2 px-1 font-body text-[11px] font-black uppercase tracking-[0.13em] sm:px-0 sm:text-[12px] ${isDark ? "text-[#C9BDD6]" : "text-[#7A6A80]"}`}>{isFrench ? FRENCH_GROUP_LABELS[group] : GROUP_LABELS[group]}</p>
                <div className={`grid grid-cols-1 divide-y overflow-hidden rounded-[20px] border sm:grid-cols-2 sm:gap-2 sm:divide-y-0 sm:overflow-visible sm:rounded-none sm:border-0 ${isDark ? "divide-white/[0.1] border-white/[0.12] bg-[#2B2035]" : "divide-[#EEE5F2] border-[#E5D9EA] bg-white"}`}>
                  {signals.map((signal, index) => {
                    const meta = VITALS_SIGNAL_CATALOG[signal];
                    const SignalIcon = SIGNAL_PICKER_ICONS[signal] ?? Activity;
                    const balancesOddGroup = signals.length % 2 === 1 && index === 0;
                    return (
                      <button
                        key={signal}
                        type="button"
                        aria-label={`${pickerSignalAccessibleLabel(signal, language)} ${meta.unit || flowCopy.yesNo}`}
                        onClick={() => chooseSignal(signal)}
                        className={`flex min-h-[58px] items-center gap-3 px-3 text-left transition-colors sm:min-h-[66px] sm:rounded-[20px] sm:border sm:px-4 ${balancesOddGroup ? "sm:col-span-2" : ""} ${isDark ? "hover:bg-white/[0.04] sm:border-white/[0.13] sm:bg-[#352842] sm:shadow-[0_7px_20px_rgba(0,0,0,0.14)]" : "hover:bg-[#FCF9FD] sm:border-[#E7DDF0] sm:bg-white sm:shadow-[0_5px_16px_rgba(53,28,87,0.04)]"}`}
                        data-testid={`button-vital-${signal}`}
                      >
                        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[13px] sm:h-10 sm:w-10 sm:rounded-[14px] ${isDark ? "bg-[#49355E]" : "bg-[#F3E8FF]"}`}>
                          <VyvaIcon icon={SignalIcon} accent={SIGNAL_PICKER_ACCENTS[signal] ?? "dot"} size={20} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block font-body text-[15px] font-black leading-tight sm:text-[16px] ${isDark ? "text-[#FFF8FF]" : "text-[#27152F]"}`}>{pickerSignalLabel(signal, language)}</span>
                          <span className={`block font-body text-[12px] font-bold ${isDark ? "text-[#C9BDD6]" : "text-[#7A6A80]"}`}>{meta.unit || flowCopy.yesNo}</span>
                        </span>
                        <ChevronRight className={`h-5 w-5 ${isDark ? "text-[#C4A7FF]" : "text-[#A78BBA]"}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}

      {stage === "tracked" && alreadyTracked ? (
        <div className="rounded-[24px] border border-[#B7E4D3] bg-[#ECFDF5] p-5" data-testid="vitals-already-tracked">
          <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white"><VyvaIcon icon={Check} accent="check" tone="success" size={24} /></div>
          <h3 className="mt-4 font-display text-[24px] font-bold text-[#173F35]">{flowCopy.alreadyTitle}</h3>
          <p className="mt-2 font-body text-[16px] font-bold leading-relaxed text-[#2B5C4D]">
            {flowCopy.trackedVia(selectedLabel ?? "", sourceDeviceName(alreadyTracked, context, flowCopy))}
          </p>
          <p className="mt-2 font-body text-[14px] text-[#477B6B]">{flowCopy.alreadyBody}</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={onBack} className="min-h-[54px] rounded-[18px] bg-[#047857] px-5 font-body text-[16px] font-black text-white">{flowCopy.useLatest}</button>
            <button type="button" onClick={() => setStage("method")} className="min-h-[54px] rounded-[18px] border border-[#8FD2BC] bg-white px-5 font-body text-[16px] font-black text-[#047857]">{flowCopy.logAnyway}</button>
          </div>
        </div>
      ) : null}

      {stage === "method" ? (
        <div>
          <p className={`mb-4 font-body text-[16px] font-bold ${isDark ? "text-[#D8CDE4]" : "text-[#6B5B72]"}`}>{flowCopy.chooseMethod}</p>
          <div className={`grid divide-y overflow-hidden rounded-[22px] border sm:grid-cols-2 sm:gap-3 sm:divide-y-0 sm:overflow-visible sm:rounded-none sm:border-0 ${isDark ? "divide-white/[0.1] border-white/[0.12] bg-[#2B2035]" : "divide-[#EEE5F2] border-[#E5D9EA] bg-white"}`} data-testid="vitals-method-picker">
            {methods.map((method) => {
              const detail = METHOD_DETAILS[method];
              const methodCopy = isFrench ? FRENCH_METHOD_DETAILS[method] : detail;
              const Icon = detail.Icon;
              return (
                <button key={method} type="button" onClick={() => chooseMethod(method)} className={`flex min-h-[74px] items-center gap-3 px-3 py-3 text-left transition-colors sm:min-h-[88px] sm:gap-4 sm:rounded-[22px] sm:border sm:p-4 ${isDark ? "hover:bg-white/[0.04] sm:border-white/[0.13] sm:bg-[#352842] sm:shadow-[0_7px_20px_rgba(0,0,0,0.14)]" : "hover:bg-[#FCF9FD] sm:border-[#E0D1EC] sm:bg-white sm:shadow-[0_7px_20px_rgba(53,28,87,0.05)]"}`} data-testid={`button-method-${method}`}>
                  <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] sm:h-12 sm:w-12 sm:rounded-[16px] ${isDark ? "bg-[#49355E]" : "bg-[#F3E8FF]"}`}><VyvaIcon icon={Icon} accent={METHOD_ACCENTS[method]} size={23} /></span>
                  <span className="min-w-0">
                    <span className={`block font-body text-[16px] font-black ${isDark ? "text-[#FFF8FF]" : "text-[#27152F]"}`}>{methodCopy.label}</span>
                    <span className="sr-only">{methodCopy.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {stage === "capture" && selectedMethod === "phone_camera" && selectedSignal ? (
        <div className="space-y-3">
          <p className="mb-3 rounded-[16px] bg-[#FFF7ED] px-4 py-3 font-body text-[13px] font-bold text-[#92400E]">{flowCopy.phoneWarning}</p>
          {useLocalCameraEstimate ? (
            <div className={`overflow-hidden rounded-[24px] border p-3 ${isDark ? "border-white/[0.13] bg-[#352842]" : "border-[#E0D1EC] bg-white"}`} data-testid="local-camera-estimate">
              <VitalsScan
                saveReading={false}
                onComplete={(bpm, respiratoryRate) => {
                  const now = new Date().toISOString();
                  const rows: ProposedVitalsReading[] = [];
                  if (selectedSignal === "resting_hr_bpm" && bpm != null) rows.push({ signal_type: selectedSignal, value: bpm, unit: "bpm", context_tag: "resting", recorded_at: now, source: "phone_estimate", capture_method: "phone_camera", confidence: "low", explanation: flowCopy.phoneEstimate });
                  if (selectedSignal === "respiratory_rate" && respiratoryRate != null) rows.push({ signal_type: selectedSignal, value: respiratoryRate, unit: "/min", context_tag: "resting", recorded_at: now, source: "phone_estimate", capture_method: "phone_camera", confidence: "low", explanation: flowCopy.phoneEstimate });
                  if (rows.length) { setProposed(rows); setStage("confirm"); }
                }}
              />
            </div>
          ) : (
            <VitalLensFaceScan
              onReadings={(readings) => {
                setProposed(readings);
                setVitalLensStatus("complete");
                setStage("confirm");
              }}
              onLocalFallback={() => setUseLocalCameraEstimate(true)}
              onStatusChange={setVitalLensStatus}
            />
          )}
        </div>
      ) : null}

      {stage === "capture" && selectedMethod === "device_photo" ? (
        <label className={`flex min-h-[190px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed p-6 text-center ${isDark ? "border-[#8D71A5] bg-[#352842]" : "border-[#B997D4] bg-[#F8F1FC]"}`}>
          {busy ? <Loader2 className="h-8 w-8 animate-spin text-[#7C3AED]" /> : <FileImage className="h-9 w-9 text-[#7C3AED]" />}
          <span className={`font-body text-[22px] font-extrabold ${isDark ? "text-[#FFF8FF]" : "text-[#27152F]"}`}>{flowCopy.takePhoto}</span>
          <span className={`font-body text-[13px] font-bold ${isDark ? "text-[#C9BDD6]" : "text-[#7A6A80]"}`}>{flowCopy.photoHint}</span>
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void scanDevicePhoto(file); }} />
        </label>
      ) : null}

      {stage === "capture" && selectedMethod === "web_bluetooth" ? (
        <div className="rounded-[24px] border border-[#D6E4F5] bg-[#EFF6FF] p-5 text-center">
          {busy ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1D4ED8]" /> : <Bluetooth className="mx-auto h-8 w-8 text-[#1D4ED8]" />}
          <p className="mt-3 font-display text-[22px] font-bold text-[#17345C]">{busy ? flowCopy.lookingDevice : flowCopy.bluetoothDevice}</p>
          {!busy && configuredBluetoothDevice?.deviceName
            ? <p className="mt-2 font-body text-[13px] font-bold text-[#365B86]">{flowCopy.configuredDevice}: {configuredBluetoothDevice.deviceName}</p>
            : null}
          {!busy ? <button type="button" onClick={() => void startBluetooth()} className="mt-4 min-h-[52px] rounded-[17px] bg-[#1D4ED8] px-6 font-body text-[15px] font-black text-white">{flowCopy.tryAgain}</button> : null}
        </div>
      ) : null}

      {stage === "capture" && (selectedMethod === "manual" || selectedMethod === "voice") ? (
        <div className={`rounded-[24px] border p-4 ${isDark ? "border-white/[0.13] bg-[#352842]" : "border-[#E0D1EC] bg-white"}`}>
          {selectedMethod === "voice" ? (
            <button type="button" onClick={startVoice} disabled={listening} className="mb-3 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#7C3AED] px-5 font-body text-[16px] font-black text-white disabled:opacity-60">
              <Mic className="h-5 w-5" />{listening ? flowCopy.listening : flowCopy.startSpeaking}
            </button>
          ) : null}
          <textarea value={inputText} onChange={(event) => setInputText(event.target.value)} placeholder={selectedMeta ? `${selectedLabel} ${selectedMeta.unit}` : flowCopy.typeReading} className={`min-h-[120px] w-full rounded-[18px] border px-4 py-3 font-body text-[18px] font-bold outline-none focus:border-[#7C3AED] ${isDark ? "border-white/[0.13] bg-[#2B2035] text-[#FFF8FF] placeholder:text-[#AA9DB7]" : "border-[#E0D1EC] bg-[#FFFCF8] text-[#27152F]"}`} />
          <button type="button" onClick={() => void parseText()} disabled={!inputText.trim() || busy} className="mt-3 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#7C3AED] px-5 font-body text-[16px] font-black text-white disabled:opacity-50">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ChevronRight className="h-5 w-5" />}{flowCopy.reviewReading}
          </button>
        </div>
      ) : null}

      {stage === "confirm" ? (
        <div className="rounded-[24px] border border-[#B7E4D3] bg-[#F0FDF8] p-5" data-testid="vitals-confirm-readings">
          <p className="font-body text-[12px] font-black uppercase tracking-[0.13em] text-[#047857]">{flowCopy.confirm}</p>
          <div className="mt-3 grid gap-2">
            {proposed.map((reading) => (
              <div key={`${reading.signal_type}-${reading.value}`} className="flex items-start gap-3 rounded-[18px] bg-white px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ECFDF5] text-[#047857]"><Check className="h-5 w-5" /></span>
                <div><p className="font-body text-[17px] font-black text-[#173F35]">{formatVitalsReadingDisplay(reading)}</p><p className="mt-1 font-body text-[12px] font-bold text-[#477B6B]">{reading.explanation}</p></div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => void saveConfirmed()} disabled={busy} className="mt-4 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#047857] px-5 font-body text-[17px] font-black text-white disabled:opacity-60">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}{flowCopy.save}
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-4 rounded-[18px] bg-[#FEF2F2] px-4 py-3 font-body text-[14px] font-bold text-[#B91C1C]" role="alert">{error}</p> : null}
    </section>
  );
}

import type { TriageScanResult } from "../../../shared/triageScans.js";
import { evaluateTriageRules } from "./evaluateTriage.js";
import { mergeTriageRecommendations } from "./recommendationDedupe.js";
import { buildTriageInsights } from "./reportInsights.js";
import type {
  TriageEscalationSource,
  ProfileRiskFlags,
  TriageChatMessage,
  TriageHealthMemory,
  TriageRuleLevel,
  TriageSummary,
  TriageUrgency,
  TriageWizardContext,
  WizardStage,
} from "../types.js";

export type TriageOutcomeTelemetry = {
  symptomPath: string;
  urgency: TriageUrgency;
  ruleIdsFired: string[];
  profileModifiersApplied: string[];
  vitalsOverlaysApplied: string[];
  caregiverEscalationTriggered: boolean;
  escalationSources: TriageEscalationSource[];
};

export const CRITICAL_RED_FLAG_IDS = new Set([
  "chest_pressure",
  "chest_rest_long",
  "chest_breathing",
  "chest_sweaty_faint",
  "chest_spreading",
  "chest_cough_blood",
  "one_calf_swollen",
  "chest_pain",
  "sudden_severe",
  "back_bladder_weakness",
  "headache_fever_stiff",
  "limb_cold_blue",
  "cannot_speak_breathing",
  "breath_rest",
  "blue_confused",
  "breathing_chest_pain",
  "coughing_blood",
  "confused_fever",
  "sepsis_signs",
  "stiff_neck",
  "cancer_fever",
  "fainted_not_normal",
  "fainted_with_chest",
  "fainted",
  "stroke_sign",
  "dizzy_chest",
  "cannot_stand",
  "hard_to_wake",
  "new_severe",
  "low_sugar",
  "high_sugar_sick",
  "low_oxygen",
  "unusual_bleeding",
  "very_high_bp",
  "immuno_fever",
  "new_confusion",
  "low_urine_swelling",
  "one_sided_weakness",
  "irregular_heartbeat",
  "hip_back_after_fall",
  "cannot_swallow",
  "fever_after_surgery",
  "calf_swelling_surgery",
  "urine_confusion",
  "liver_confusion_bleeding",
  "over_sedated",
  "opioid_breathing",
  "dehydration_diuretic",
  "severe_abdominal",
  "blood_vomit_stool",
  "rigid_belly",
  "cannot_stool_gas",
  "collapsed_stomach",
  "cannot_pee",
  "urine_heavy_blood",
  "urine_confusion_weak",
  "fall_head_hit",
  "head_injury_red_flags",
  "fall_cannot_stand",
  "heavy_bleeding",
  "allergic_swelling",
  "skin_sepsis_signs",
  "non_fading_rash",
  "sudden_confusion",
  "self_harm",
  "severe_bleeding",
]);

const SAFETY_ACTION_IDS = new Set([
  "call_emergency",
  "contact_doctor",
  "make_report",
  "continue_questions",
]);

function isSpanishLocale(locale: string) {
  return locale.split("-")[0].toLowerCase() === "es";
}

function isFrenchLocale(locale: string) {
  return locale.split("-")[0].toLowerCase() === "fr";
}

const FRENCH_OUTCOME_TEXT: Record<string, string> = {
  "pain or headache": "la douleur ou le mal de tête",
  "chest discomfort": "la gêne thoracique",
  "breathing": "la respiration",
  "fever": "la fièvre",
  "dizziness": "les vertiges",
  "tiredness or weakness": "la fatigue ou la faiblesse",
  "stomach or bowel trouble": "le problème digestif",
  "urine problem": "le problème urinaire",
  "fall or injury": "la chute ou la blessure",
  "skin or wound problem": "le problème de peau ou de plaie",
  "confusion or memory change": "la confusion ou le trouble de mémoire",
  "symptoms": "les symptômes",
  "Chest pressure, tightness, or pain is happening now or getting worse.": "Une pression, une oppression ou une douleur thoracique est présente maintenant ou s’aggrave.",
  "Breathing trouble, sweating, faintness, nausea, or spreading pain appears.": "Une difficulté à respirer, des sueurs, un malaise, des nausées ou une douleur qui s’étend apparaissent.",
  "Pulse feels very fast, irregular, or very slow.": "Le pouls paraît très rapide, irrégulier ou très lent.",
  "Breathing becomes difficult at rest.": "La respiration devient difficile au repos.",
  "Blue lips, confusion, fainting, or chest pressure appears.": "Des lèvres bleutées, une confusion, un évanouissement ou une pression thoracique apparaissent.",
  "Oxygen is lower than usual, if you measure it.": "Le taux d’oxygène est plus bas que d’habitude, si vous le mesurez.",
  "Confusion, extreme sleepiness, stiff neck, or new rash appears.": "Une confusion, une somnolence extrême, une raideur de la nuque ou une nouvelle éruption apparaissent.",
  "Fever stays high or you feel suddenly much worse.": "La fièvre reste élevée ou vous vous sentez soudainement beaucoup plus mal.",
  "You cannot drink, pass very little urine, or feel very weak.": "Vous ne pouvez pas boire, urinez très peu ou vous sentez très faible.",
  "You faint or nearly faint.": "Vous vous évanouissez ou manquez de vous évanouir.",
  "Weakness on one side, speech trouble, chest pain, or breathing trouble appears.": "Une faiblesse d’un côté, un trouble de la parole, une douleur thoracique ou une difficulté à respirer apparaissent.",
  "Dizziness gets worse when standing or you cannot walk safely.": "Les vertiges s’aggravent en vous levant ou vous ne pouvez pas marcher sans danger.",
  "Pain becomes sudden, severe, or very unusual for you.": "La douleur devient soudaine, intense ou très inhabituelle pour vous.",
  "Weakness, speech trouble, vision change, confusion, or fainting appears.": "Une faiblesse, un trouble de la parole ou de la vue, une confusion ou un évanouissement apparaissent.",
  "Pain follows a fall, head hit, or chest pressure.": "La douleur survient après une chute, un choc à la tête ou une pression thoracique.",
  "You cannot stand, walk safely, or care for yourself.": "Vous ne pouvez pas vous tenir debout, marcher sans danger ou prendre soin de vous.",
  "New confusion, fever, chest pain, breathing trouble, or fainting appears.": "Une nouvelle confusion, de la fièvre, une douleur thoracique, une difficulté à respirer ou un évanouissement apparaissent.",
  "You are not drinking, pass very little urine, or feel much weaker.": "Vous ne buvez pas, urinez très peu ou vous sentez beaucoup plus faible.",
  "Belly pain becomes severe, constant, hard, or swollen.": "La douleur abdominale devient intense ou constante, ou le ventre devient dur ou gonflé.",
  "Vomiting blood, black stool, bloody stool, or fainting appears.": "Des vomissements de sang, des selles noires ou sanglantes, ou un évanouissement apparaissent.",
  "You cannot keep fluids down or pass very little urine.": "Vous ne pouvez pas garder les liquides ou vous urinez très peu.",
  "Fever, shaking chills, back/flank pain, or new confusion appears.": "De la fièvre, des frissons intenses, une douleur au dos ou sur le côté, ou une nouvelle confusion apparaissent.",
  "You cannot pass urine or have strong lower belly pain.": "Vous ne pouvez pas uriner ou avez une forte douleur dans le bas-ventre.",
  "Blood in urine, weakness, or feeling suddenly worse appears.": "Du sang dans les urines, une faiblesse ou une aggravation soudaine apparaissent.",
  "Head hit, confusion, fainting, severe headache, or vomiting appears.": "Un choc à la tête, une confusion, un évanouissement, un fort mal de tête ou des vomissements apparaissent.",
  "You cannot stand, walk, or use the injured part.": "Vous ne pouvez pas vous tenir debout, marcher ou utiliser la partie blessée.",
  "Hip, back, chest pain, or swelling gets worse.": "La douleur à la hanche, au dos ou à la poitrine, ou le gonflement s’aggrave.",
  "Redness, warmth, swelling, or pus spreads.": "La rougeur, la chaleur, le gonflement ou le pus s’étend.",
  "Fever, severe pain, red streaks, or feeling very unwell appears.": "De la fièvre, une douleur intense, des traînées rouges ou un fort malaise apparaissent.",
  "Face, lip, tongue, or throat swelling appears.": "Un gonflement du visage, des lèvres, de la langue ou de la gorge apparaît.",
  "Confusion is sudden, worse, or you are unsafe alone.": "La confusion est soudaine, s’aggrave ou vous n’êtes pas en sécurité seul(e).",
  "Weakness, speech trouble, face droop, fever, or fainting appears.": "Une faiblesse, un trouble de la parole, un affaissement du visage, de la fièvre ou un évanouissement apparaissent.",
  "Urine change, dehydration, low sugar signs, or slow breathing appears.": "Un changement urinaire, une déshydratation, des signes d’hypoglycémie ou une respiration lente apparaissent.",
  "Symptoms get worse or new symptoms appear.": "Les symptômes s’aggravent ou de nouveaux symptômes apparaissent.",
  "You feel unsafe, confused, faint, or very weak.": "Vous ne vous sentez pas en sécurité, êtes confus(e), avez un malaise ou êtes très faible.",
  "Breathing trouble, chest pain, or severe pain appears.": "Une difficulté à respirer, une douleur thoracique ou une douleur intense apparaît.",
  "Blood thinner in profile: falls, head hits, unusual bleeding, or severe headache need extra caution.": "Anticoagulant dans le profil : les chutes, chocs à la tête, saignements inhabituels ou forts maux de tête demandent une vigilance accrue.",
  "Diabetes or glucose medicine in profile: sugar changes can make weakness, dizziness, or infection feel different.": "Diabète ou traitement de la glycémie dans le profil : les variations de sucre peuvent modifier la faiblesse, les vertiges ou les signes d’infection.",
  "Breathing or heart condition in profile: shortness of breath should be watched more closely.": "Maladie respiratoire ou cardiaque dans le profil : l’essoufflement doit être surveillé plus attentivement.",
  "Blood pressure or stroke history in profile: weakness, speech trouble, or vision change matters more.": "Tension élevée ou antécédent d’AVC dans le profil : une faiblesse ou un trouble de la parole ou de la vue est particulièrement important.",
  "Low immunity risk in profile: fever should be handled more cautiously.": "Risque d’immunité faible dans le profil : la fièvre demande davantage de prudence.",
  "Low immunity risk in profile: skin or wound changes should be watched more closely.": "Risque d’immunité faible dans le profil : les changements de la peau ou d’une plaie doivent être surveillés plus attentivement.",
  "Memory or confusion risk in profile: new confusion should be treated as important.": "Risque lié à la mémoire ou à la confusion dans le profil : toute nouvelle confusion doit être prise au sérieux.",
  "concerning": "préoccupant",
  "worth watching": "à surveiller",
  "not concerning": "non préoccupant",
  "The photo was analyzed and discarded.": "La photo a été analysée puis supprimée.",
  "A photo cannot diagnose a urine infection.": "Une photo ne permet pas de diagnostiquer une infection urinaire.",
  "A photo cannot diagnose bleeding or bowel disease.": "Une photo ne permet pas de diagnostiquer un saignement ou une maladie intestinale.",
  "This assessment is for information only and is not medical advice. Always consult your doctor or call emergency services if you feel it is serious.": "Cette évaluation est fournie à titre informatif et ne constitue pas un avis médical. Consultez toujours votre médecin ou appelez les urgences si la situation vous paraît grave.",
  "Call emergency services now": "Appelez les services d’urgence maintenant",
  "Talk to a doctor today": "Parlez à un médecin aujourd’hui",
  "Talk to a doctor within 24-48 hours": "Parlez à un médecin dans les 24 à 48 heures",
  "Monitor at home, with doctor access ready": "Surveillez votre état à domicile en gardant un accès à un médecin",
  "An optional scan found a concerning visible change that should be shared with a clinician today.": "Un scan facultatif a détecté un changement visible préoccupant à montrer à un professionnel de santé aujourd’hui.",
  "Talk to a doctor today and share the scan note. Seek urgent help sooner if severe symptoms appear.": "Parlez à un médecin aujourd’hui et partagez la note du scan. Demandez une aide urgente plus tôt si des symptômes graves apparaissent.",
};

function frenchOutcomeText(english: string) {
  const direct = FRENCH_OUTCOME_TEXT[english];
  if (direct) return direct;

  const emergency = english.match(/^Your answers include an emergency warning sign for (.+)\.$/);
  if (emergency) return `Vos réponses comportent un signe d’alerte urgent concernant ${emergency[1]}.`;
  const today = english.match(/^Your answers show (.+) should be checked today\.$/);
  if (today) return `Vos réponses indiquent que ${today[1]} doit être évalué aujourd’hui.`;
  const soon = english.match(/^Your answers show (.+) should be checked within 24-48 hours\.$/);
  if (soon) return `Vos réponses indiquent que ${soon[1]} doit être évalué dans les 24 à 48 heures.`;
  const monitor = english.match(/^Your answers fit a lower-risk (.+) pattern right now\.$/);
  if (monitor) return `Vos réponses correspondent actuellement à une situation à faible risque concernant ${monitor[1]}.`;

  const pulseForDoctor = english.match(/^Pulse from scan was (.+) bpm, so the report includes it for the doctor\.$/);
  if (pulseForDoctor) return `Le pouls mesuré était de ${pulseForDoctor[1]} bpm ; il est inclus dans le rapport pour le médecin.`;
  const pulse = english.match(/^Pulse from scan was (.+) bpm\.$/);
  if (pulse) return `Le pouls mesuré était de ${pulse[1]} bpm.`;
  const breathingForDoctor = english.match(/^Breathing rate from scan was (.+)\/min, which should be shared with a clinician\.$/);
  if (breathingForDoctor) return `La fréquence respiratoire mesurée était de ${breathingForDoctor[1]}/min ; communiquez-la à un professionnel de santé.`;
  const breathing = english.match(/^Breathing rate from scan was (.+)\/min\.$/);
  if (breathing) return `La fréquence respiratoire mesurée était de ${breathing[1]}/min.`;
  const oxygen = english.match(/^Oxygen saturation was (.+)%\.$/);
  if (oxygen) return `La saturation en oxygène était de ${oxygen[1]} %.`;
  const temperature = english.match(/^Temperature was (.+) C\.$/);
  if (temperature) return `La température était de ${temperature[1]} °C.`;
  const bloodPressure = english.match(/^Blood pressure was (.+)\/(.+)\.$/);
  if (bloodPressure) return `La tension artérielle était de ${bloodPressure[1]}/${bloodPressure[2]}.`;
  const glucose = english.match(/^Glucose was (.+) mg\/dL\.$/);
  if (glucose) return `La glycémie était de ${glucose[1]} mg/dL.`;
  const painScore = english.match(/^Pain score was (.+)\/10\.$/);
  if (painScore) return `Le niveau de douleur était de ${painScore[1]}/10.`;
  const symptomSeverity = english.match(/^Symptom severity was (.+)\/10\.$/);
  if (symptomSeverity) return `L’intensité du symptôme était de ${symptomSeverity[1]}/10.`;
  const energy = english.match(/^Energy level was (.+)\/10\.$/);
  if (energy) return `Le niveau d’énergie était de ${energy[1]}/10.`;

  return english;
}

function looksLikeEnglish(value: string) {
  return /\b(the|you|your|call|talk|monitor|symptom|pain|breathing|doctor|today|within|warning|should|appears|worse|rest|drink|write|keep|seek|contact)\b/i.test(value);
}

function frenchFallbackReason(level: TriageRuleLevel) {
  if (level === "emergency") return "Vos réponses comprennent un signe d’alerte qui nécessite une aide urgente.";
  if (level === "doctor_today") return "Vos réponses indiquent qu’un avis médical est nécessaire aujourd’hui.";
  if (level === "doctor_24_48") return "Vos réponses indiquent qu’un avis médical est recommandé dans les 24 à 48 heures.";
  return "Aucun signe d’alerte urgent n’a été sélectionné pour le moment.";
}

function frenchFallbackRecommendations(level: TriageRuleLevel) {
  if (level === "emergency") {
    return [
      "Appelez les services d’urgence maintenant si le signe d’alerte est présent.",
      "Demandez à une personne proche de rester avec vous.",
      "Ne conduisez pas vous-même.",
      "Gardez ce rapport prêt à être partagé.",
    ];
  }
  if (level === "doctor_today") {
    return [
      "Contactez votre médecin, votre clinique ou un service de soins urgents aujourd’hui.",
      "Expliquez quand le symptôme a commencé et comment il a évolué.",
      "Demandez une aide urgente plus tôt si un signe d’alerte apparaît.",
      "Gardez ce rapport prêt à être partagé.",
    ];
  }
  if (level === "doctor_24_48") {
    return [
      "Contactez votre médecin ou votre clinique dans les 24 à 48 heures si cela continue.",
      "Utilisez ce rapport pour décrire clairement le symptôme.",
      "Notez ce qui change, ce qui aide et ce qui aggrave la situation.",
      "Surveillez les signes d’alerte indiqués ci-dessous.",
    ];
  }
  return [
    "Reposez-vous et gardez vos habitudes normales dans la mesure où cela reste sûr.",
    "Notez quand le symptôme a commencé et ce qui l’améliore ou l’aggrave.",
    "Appelez un médecin si cela continue, s’aggrave ou vous paraît inhabituel.",
    "Surveillez les signes d’alerte indiqués ci-dessous.",
  ];
}

function text(locale: string, english: string, spanish: string) {
  if (isFrenchLocale(locale)) return frenchOutcomeText(english);
  return isSpanishLocale(locale) ? spanish : english;
}

export function profileRiskFlags(memory?: TriageHealthMemory): ProfileRiskFlags {
  const haystack = [
    memory?.healthContext,
    memory?.careContext,
    memory?.checkinContext,
    memory?.conditions,
    memory?.allergies,
    memory?.medications,
    memory?.devices,
    memory?.latestVitals,
    memory?.vitalsTrend,
    memory?.latestSymptomReport,
    memory?.recentSymptomReports,
    memory?.medicationAdherence,
    memory?.medicationInteraction,
    memory?.recentHealthEvents,
    memory?.latestMedicalVisit,
    memory?.upcomingMedicalAppointment,
  ].filter(Boolean).join(" ").toLowerCase();

  return {
    diabetes: /\b(diabetes|diabetic|insulin|metformin|glucose|blood sugar|cgm)\b/.test(haystack),
    copd: /\b(copd|emphysema|chronic bronchitis|oxygen therapy|home oxygen|asthma)\b/.test(haystack),
    heartFailure: /\b(chf|heart failure|congestive|fluid retention|furosemide|diuretic)\b/.test(haystack),
    heartDisease: /\b(coronary|angina|heart attack|myocardial infarction|stent|bypass|ischemic heart|ischaemic heart|heart disease)\b/.test(haystack),
    afib: /\b(afib|a-fib|atrial fibrillation|irregular heartbeat|arrhythmia|palpitations)\b/.test(haystack),
    hypertension: /\b(hypertension|high blood pressure|blood pressure|amlodipine|lisinopril|losartan|atenolol|metoprolol)\b/.test(haystack),
    bloodThinner: /\b(warfarin|apixaban|eliquis|rivaroxaban|xarelto|dabigatran|pradaxa|edoxaban|anticoagulant|blood thinner|clopidogrel|plavix)\b/.test(haystack),
    immunosuppressed: /\b(immunosuppressed|immunocompromised|chemotherapy|transplant|prednisone|steroid|methotrexate|biologic|low immunity|neutropenia)\b/.test(haystack),
    cognitiveConcern: /\b(dementia|alzheimer|memory loss|cognitive impairment|confusion)\b/.test(haystack),
    kidneyDisease: /\b(kidney disease|ckd|renal|dialysis|eGFR|nephropathy|kidney failure)\b/i.test(haystack),
    strokeHistory: /\b(stroke|tia|mini stroke|cva|transient ischemic|transient ischaemic)\b/.test(haystack),
    fallsFrailty: /\b(fall risk|falls|frail|frailty|walker|walking aid|mobility aid|unsteady|balance problem)\b/.test(haystack),
    parkinsonMobility: /\b(parkinson|parkinson's|levodopa|carbidopa|freezing|tremor|swallowing trouble|dysphagia)\b/.test(haystack),
    osteoporosis: /\b(osteoporosis|osteopenia|fragility fracture|hip fracture|compression fracture)\b/.test(haystack),
    cancerActive: /\b(cancer|chemotherapy|radiotherapy|radiation therapy|oncology|tumou?r|malignan)\b/.test(haystack),
    recentSurgery: /\b(recent surgery|post[- ]?op|operation|hospital stay|discharged|wound|incision|surgical)\b/.test(haystack),
    utiHistory: /\b(uti|urinary tract infection|recurrent infection|bladder infection|cystitis)\b/.test(haystack),
    liverDisease: /\b(liver disease|cirrhosis|hepatitis|hepatic|jaundice|ascites)\b/.test(haystack),
    depressionAnxiety: /\b(depression|depressed|anxiety|panic|lonely|suicidal|self harm|self-harm)\b/.test(haystack),
    sedatingMedication: /\b(zolpidem|ambien|benzodiazepine|diazepam|lorazepam|alprazolam|clonazepam|sleeping pill|sedative|quetiapine|gabapentin|pregabalin)\b/.test(haystack),
    opioidMedication: /\b(opioid|morphine|oxycodone|hydrocodone|tramadol|fentanyl|codeine|buprenorphine)\b/.test(haystack),
    diureticMedication: /\b(furosemide|lasix|bumetanide|torsemide|spironolactone|hydrochlorothiazide|bendroflumethiazide|diuretic|water pill)\b/.test(haystack),
    steroidMedication: /\b(prednisone|prednisolone|dexamethasone|hydrocortisone|steroid)\b/.test(haystack),
  };
}

export function selectedAnswers(wizard?: TriageWizardContext) {
  return wizard?.quickAnswers ?? [];
}

export function hasAnswer(wizard: TriageWizardContext | undefined, ids: string[]) {
  return selectedAnswers(wizard).some((answer) => ids.includes(answer.id));
}

export function firstAnswerKind(wizard: TriageWizardContext | undefined, kind: string) {
  return selectedAnswers(wizard).find((answer) => answer.kind === kind);
}

export function selectedSymptomId(wizard: TriageWizardContext | undefined) {
  return firstAnswerKind(wizard, "symptom")?.id;
}

export function selectedSafetyAnswer(wizard: TriageWizardContext | undefined) {
  if (hasAnswer(wizard, Array.from(SAFETY_ACTION_IDS))) return null;
  return selectedAnswers(wizard).find((answer) => CRITICAL_RED_FLAG_IDS.has(answer.id));
}

function hasKind(wizard: TriageWizardContext | undefined, kind: string) {
  return selectedAnswers(wizard).some((answer) => answer.kind === kind);
}

function selectedSeverityScore(wizard: TriageWizardContext | undefined) {
  const answer = selectedAnswers(wizard).find((item) => item.kind === "severity");
  if (!answer) return null;
  const labelScore = Number(answer.label);
  if (Number.isFinite(labelScore) && labelScore >= 0 && labelScore <= 10) return labelScore;
  const idScore = Number(answer.id.match(/^severity_(\d{1,2})$/)?.[1]);
  return Number.isFinite(idScore) && idScore >= 0 && idScore <= 10 ? idScore : null;
}

function hasStrongSeverity(wizard: TriageWizardContext | undefined) {
  return selectedAnswers(wizard).some((answer) => answer.id === "strong")
    || (selectedSeverityScore(wizard) ?? -1) >= 7;
}

export function shouldCompleteFromRules(wizard: TriageWizardContext | undefined, healthMemory?: TriageHealthMemory) {
  const answers = selectedAnswers(wizard);
  if (!answers.some((answer) => answer.kind === "red_flag")) return false;
  const ids = new Set(answers.map((answer) => answer.id));
  const symptomId = selectedSymptomId(wizard);
  const risks = profileRiskFlags(healthMemory);
  const hasCriticalRedFlag = answers.some((answer) => CRITICAL_RED_FLAG_IDS.has(answer.id));
  const strongSeverity = hasStrongSeverity(wizard);

  if (hasCriticalRedFlag) return true;

  if (symptomId === "breathing") {
    if (strongSeverity) return true;
    if (ids.has("walking_only") && hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
    if (ids.has("no_red_flag") && hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  if (symptomId === "pain") {
    if (ids.has("after_fall") && hasKind(wizard, "severity")) return true;
    if (strongSeverity && ids.has("worse")) return true;
    if (hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  if (symptomId === "chest") {
    if (hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  if (symptomId === "dizzy") {
    if ((strongSeverity || ids.has("worse") || ids.has("new_symptoms")) && hasKind(wizard, "severity")) return true;
    if (hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  if (symptomId === "fever") {
    if ((risks.immunosuppressed || risks.cancerActive || risks.steroidMedication) && hasKind(wizard, "duration")) return true;
    if ((strongSeverity || ids.has("week_plus") || ids.has("worse") || ids.has("new_symptoms")) && hasKind(wizard, "severity")) return true;
    if (hasKind(wizard, "duration") && hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  if (symptomId === "tired") {
    if ((ids.has("not_drinking") || strongSeverity || ids.has("worse")) && hasKind(wizard, "severity")) return true;
    if (hasKind(wizard, "duration") && hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  if (symptomId === "stomach") {
    if ((ids.has("not_drinking") || ids.has("fever_or_severe_pain") || ids.has("diabetes_vomiting")) && hasKind(wizard, "severity")) return true;
    if (ids.has("vomit_diarrhea_24h") || ids.has("constipation_passing_gas")) return true;
    if ((strongSeverity || ids.has("worse") || ids.has("new_symptoms")) && hasKind(wizard, "severity")) return true;
    if (hasKind(wizard, "duration") && hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  if (symptomId === "fall") {
    if (ids.has("lost_consciousness") || ids.has("fell_from_height") || ids.has("alone_after_fall")) return true;
    if (hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  if (symptomId === "urinary") {
    if (hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
    if ((ids.has("urine_fever_chills") || ids.has("urine_side_pain") || ids.has("urine_confusion_weak")) && hasKind(wizard, "severity")) return true;
  }

  if (symptomId === "skin") {
    if (ids.has("shingles_eye") || ids.has("shingles_immune") || ids.has("shingles_early")) return true;
    if (hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  if (symptomId === "confusion") {
    if (hasKind(wizard, "severity")) return true;
  }

  if (symptomId === "other") {
    if (hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  return hasKind(wizard, "duration") && hasKind(wizard, "severity") && hasKind(wizard, "trend");
}

export function nextAdaptiveStage(wizard: TriageWizardContext | undefined, _healthMemory?: TriageHealthMemory): WizardStage {
  const answers = selectedAnswers(wizard);
  if (wizard?.refineRequested) return "complete";
  if (!answers.some((answer) => answer.kind === "symptom")) return "symptom";
  const symptomId = selectedSymptomId(wizard);
  if (symptomId === "pain" && !answers.some((answer) => answer.kind === "location")) return "location";
  if (!answers.some((answer) => answer.kind === "red_flag")) return "red_flag";
  // The canonical presentation flow is intentionally consistent for every
  // non-emergency symptom. Outcome rules still determine urgency, but they
  // must not skip information-gathering or the user's final review.
  if (!hasKind(wizard, "severity")) return "severity";
  if (!hasKind(wizard, "duration")) return "duration";
  if (!hasKind(wizard, "trend")) return "trend";
  if (!hasKind(wizard, "support")) return "support";
  return "complete";
}

function urgencyRank(urgency: TriageUrgency) {
  if (urgency === "urgent") return 3;
  if (urgency === "routine") return 2;
  return 1;
}

function maxUrgency(current: TriageUrgency, floor: TriageUrgency): TriageUrgency {
  return urgencyRank(current) >= urgencyRank(floor) ? current : floor;
}

export function symptomLabel(locale: string, symptomId: string | undefined) {
  const labels: Record<string, { en: string; es: string }> = {
    pain: { en: "pain or headache", es: "dolor o dolor de cabeza" },
    chest: { en: "chest discomfort", es: "molestia de pecho" },
    breathing: { en: "breathing", es: "respiracion" },
    fever: { en: "fever", es: "fiebre" },
    dizzy: { en: "dizziness", es: "mareo" },
    tired: { en: "tiredness or weakness", es: "cansancio o debilidad" },
    stomach: { en: "stomach or bowel trouble", es: "problema de estomago o intestino" },
    urinary: { en: "urine problem", es: "problema de orina" },
    fall: { en: "fall or injury", es: "caida o golpe" },
    skin: { en: "skin or wound problem", es: "problema de piel o herida" },
    confusion: { en: "confusion or memory change", es: "confusion o cambio de memoria" },
    other: { en: "symptoms", es: "sintomas" },
  };
  const label = labels[symptomId ?? "other"] ?? labels.other;
  return text(locale, label.en, label.es);
}

export function watchSignsFor(locale: string, symptomId: string | undefined): string[] {
  if (symptomId === "chest") {
    return [
      text(locale, "Chest pressure, tightness, or pain is happening now or getting worse.", "Presion, opresion o dolor de pecho ocurre ahora o empeora."),
      text(locale, "Breathing trouble, sweating, faintness, nausea, or spreading pain appears.", "Aparece falta de aire, sudor, desmayo, nausea o dolor que se extiende."),
      text(locale, "Pulse feels very fast, irregular, or very slow.", "El pulso se siente muy rapido, irregular o muy lento."),
    ];
  }
  if (symptomId === "breathing") {
    return [
      text(locale, "Breathing becomes difficult at rest.", "La respiracion cuesta incluso en reposo."),
      text(locale, "Blue lips, confusion, fainting, or chest pressure appears.", "Aparecen labios azules, confusion, desmayo o presion en el pecho."),
      text(locale, "Oxygen is lower than usual, if you measure it.", "El oxigeno esta mas bajo de lo habitual, si lo mides."),
    ];
  }
  if (symptomId === "fever") {
    return [
      text(locale, "Confusion, extreme sleepiness, stiff neck, or new rash appears.", "Aparece confusion, mucho sueno, cuello rigido o erupcion nueva."),
      text(locale, "Fever stays high or you feel suddenly much worse.", "La fiebre sigue alta o te sientes mucho peor de repente."),
      text(locale, "You cannot drink, pass very little urine, or feel very weak.", "No puedes beber, orinas muy poco o te sientes muy debil."),
    ];
  }
  if (symptomId === "dizzy") {
    return [
      text(locale, "You faint or nearly faint.", "Te desmayas o casi te desmayas."),
      text(locale, "Weakness on one side, speech trouble, chest pain, or breathing trouble appears.", "Aparece debilidad en un lado, dificultad al hablar, dolor de pecho o falta de aire."),
      text(locale, "Dizziness gets worse when standing or you cannot walk safely.", "El mareo empeora al levantarte o no puedes caminar con seguridad."),
    ];
  }
  if (symptomId === "pain") {
    return [
      text(locale, "Pain becomes sudden, severe, or very unusual for you.", "El dolor se vuelve repentino, fuerte o muy raro para ti."),
      text(locale, "Weakness, speech trouble, vision change, confusion, or fainting appears.", "Aparece debilidad, dificultad al hablar, cambio de vision, confusion o desmayo."),
      text(locale, "Pain follows a fall, head hit, or chest pressure.", "El dolor aparece tras una caida, golpe en la cabeza o presion en el pecho."),
    ];
  }
  if (symptomId === "tired") {
    return [
      text(locale, "You cannot stand, walk safely, or care for yourself.", "No puedes estar de pie, caminar con seguridad o cuidarte."),
      text(locale, "New confusion, fever, chest pain, breathing trouble, or fainting appears.", "Aparece confusion nueva, fiebre, dolor de pecho, falta de aire o desmayo."),
      text(locale, "You are not drinking, pass very little urine, or feel much weaker.", "No estas bebiendo, orinas muy poco o te sientes mucho mas debil."),
    ];
  }
  if (symptomId === "stomach") {
    return [
      text(locale, "Belly pain becomes severe, constant, hard, or swollen.", "El dolor de barriga se vuelve fuerte, constante, dura o hinchada."),
      text(locale, "Vomiting blood, black stool, bloody stool, or fainting appears.", "Aparece vomito con sangre, heces negras, sangre en heces o desmayo."),
      text(locale, "You cannot keep fluids down or pass very little urine.", "No puedes retener liquidos u orinas muy poco."),
    ];
  }
  if (symptomId === "urinary") {
    return [
      text(locale, "Fever, shaking chills, back/flank pain, or new confusion appears.", "Aparece fiebre, escalofrios fuertes, dolor de espalda/lado o confusion nueva."),
      text(locale, "You cannot pass urine or have strong lower belly pain.", "No puedes orinar o tienes dolor fuerte bajo vientre."),
      text(locale, "Blood in urine, weakness, or feeling suddenly worse appears.", "Aparece sangre en orina, debilidad o empeoras de repente."),
    ];
  }
  if (symptomId === "fall") {
    return [
      text(locale, "Head hit, confusion, fainting, severe headache, or vomiting appears.", "Aparece golpe en cabeza, confusion, desmayo, dolor de cabeza fuerte o vomitos."),
      text(locale, "You cannot stand, walk, or use the injured part.", "No puedes estar de pie, caminar o usar la parte lesionada."),
      text(locale, "Hip, back, chest pain, or swelling gets worse.", "Empeora dolor de cadera, espalda, pecho o hinchazon."),
    ];
  }
  if (symptomId === "skin") {
    return [
      text(locale, "Redness, warmth, swelling, or pus spreads.", "Rojez, calor, hinchazon o pus se extiende."),
      text(locale, "Fever, severe pain, red streaks, or feeling very unwell appears.", "Aparece fiebre, dolor fuerte, lineas rojas o te sientes muy mal."),
      text(locale, "Face, lip, tongue, or throat swelling appears.", "Aparece hinchazon de cara, labios, lengua o garganta."),
    ];
  }
  if (symptomId === "confusion") {
    return [
      text(locale, "Confusion is sudden, worse, or you are unsafe alone.", "La confusion es repentina, empeora o no estas seguro solo."),
      text(locale, "Weakness, speech trouble, face droop, fever, or fainting appears.", "Aparece debilidad, habla rara, cara caida, fiebre o desmayo."),
      text(locale, "Urine change, dehydration, low sugar signs, or slow breathing appears.", "Aparece cambio de orina, deshidratacion, senales de azucar baja o respiracion lenta."),
    ];
  }
  return [
    text(locale, "Symptoms get worse or new symptoms appear.", "Los sintomas empeoran o aparecen sintomas nuevos."),
    text(locale, "You feel unsafe, confused, faint, or very weak.", "Te sientes inseguro, con confusion, desmayo o mucha debilidad."),
    text(locale, "Breathing trouble, chest pain, or severe pain appears.", "Aparece falta de aire, dolor de pecho o dolor fuerte."),
  ];
}

export function profileConsiderationsFor(locale: string, risks: ProfileRiskFlags, symptomId: string | undefined): string[] {
  const notes = [
    risks.bloodThinner && ["chest", "pain", "dizzy", "other"].includes(symptomId ?? "")
      ? text(locale, "Blood thinner in profile: falls, head hits, unusual bleeding, or severe headache need extra caution.", "Anticoagulante en el perfil: caidas, golpes en la cabeza, sangrado raro o dolor de cabeza fuerte requieren mas cuidado.")
      : "",
    risks.diabetes && ["dizzy", "tired", "fever", "urinary", "confusion", "other"].includes(symptomId ?? "")
      ? text(locale, "Diabetes or glucose medicine in profile: sugar changes can make weakness, dizziness, or infection feel different.", "Diabetes o medicacion de azucar en el perfil: cambios de azucar pueden cambiar debilidad, mareo o infeccion.")
      : "",
    (risks.copd || risks.heartFailure) && ["chest", "breathing", "tired", "fall", "other"].includes(symptomId ?? "")
      ? text(locale, "Breathing or heart condition in profile: shortness of breath should be watched more closely.", "Condicion respiratoria o cardiaca en el perfil: la falta de aire debe vigilarse mas de cerca.")
      : "",
    (risks.strokeHistory || risks.hypertension) && ["chest", "pain", "dizzy", "confusion", "other"].includes(symptomId ?? "")
      ? text(locale, "Blood pressure or stroke history in profile: weakness, speech trouble, or vision change matters more.", "Presion alta o antecedente de ictus en el perfil: debilidad, habla rara o cambio de vision importa mas.")
      : "",
    (risks.immunosuppressed || risks.cancerActive || risks.steroidMedication) && symptomId === "fever"
      ? text(locale, "Low immunity risk in profile: fever should be handled more cautiously.", "Riesgo de defensas bajas en el perfil: la fiebre debe manejarse con mas cautela.")
      : "",
    (risks.immunosuppressed || risks.cancerActive || risks.steroidMedication) && symptomId === "skin"
      ? text(locale, "Low immunity risk in profile: skin or wound changes should be watched more closely.", "Riesgo de defensas bajas en el perfil: cambios en piel o herida deben vigilarse mas de cerca.")
      : "",
    risks.cognitiveConcern
      ? text(locale, "Memory or confusion risk in profile: new confusion should be treated as important.", "Riesgo de memoria o confusion en el perfil: la confusion nueva debe tratarse como importante.")
      : "",
  ].filter(Boolean);
  return notes.slice(0, 2);
}

export function vitalsNotesFor(locale: string, wizard: TriageWizardContext | undefined): string[] {
  const bpm = wizard?.vitals?.bpm;
  const rr = wizard?.vitals?.respiratoryRate;
  const spo2 = wizard?.vitals?.oxygenSaturation;
  const temperatureC = wizard?.vitals?.temperatureC;
  const systolicBp = wizard?.vitals?.systolicBp;
  const diastolicBp = wizard?.vitals?.diastolicBp;
  const glucoseMgdl = wizard?.vitals?.glucoseMgdl;
  const painScore = wizard?.vitals?.painScore;
  const symptomSeverity = selectedSeverityScore(wizard);
  const energyLevel = wizard?.vitals?.energyLevel;
  const notes: string[] = [];
  if (typeof bpm === "number" && (bpm >= 110 || bpm <= 50)) {
    notes.push(text(locale, `Pulse from scan was ${bpm} bpm, so the report includes it for the doctor.`, `El pulso del escaneo fue ${bpm} lpm, asi que el informe lo incluye para el medico.`));
  } else if (typeof bpm === "number") {
    notes.push(text(locale, `Pulse from scan was ${bpm} bpm.`, `El pulso del escaneo fue ${bpm} lpm.`));
  }
  if (typeof rr === "number" && (rr >= 24 || rr <= 10)) {
    notes.push(text(locale, `Breathing rate from scan was ${rr}/min, which should be shared with a clinician.`, `La respiracion del escaneo fue ${rr}/min, y conviene compartirla con un clinico.`));
  } else if (typeof rr === "number") {
    notes.push(text(locale, `Breathing rate from scan was ${rr}/min.`, `La respiracion del escaneo fue ${rr}/min.`));
  }
  if (typeof spo2 === "number") {
    notes.push(text(locale, `Oxygen saturation was ${spo2}%.`, `La saturacion de oxigeno fue ${spo2}%.`));
  }
  if (typeof temperatureC === "number") {
    notes.push(text(locale, `Temperature was ${temperatureC} C.`, `La temperatura fue ${temperatureC} C.`));
  }
  if (typeof systolicBp === "number" && typeof diastolicBp === "number") {
    notes.push(text(locale, `Blood pressure was ${systolicBp}/${diastolicBp}.`, `La presion arterial fue ${systolicBp}/${diastolicBp}.`));
  }
  if (typeof glucoseMgdl === "number") {
    notes.push(text(locale, `Glucose was ${glucoseMgdl} mg/dL.`, `La glucosa fue ${glucoseMgdl} mg/dL.`));
  }
  if (typeof painScore === "number") {
    notes.push(text(locale, `Pain score was ${painScore}/10.`, `El dolor fue ${painScore}/10.`));
  } else if (typeof symptomSeverity === "number") {
    notes.push(text(locale, `Symptom severity was ${symptomSeverity}/10.`, `La intensidad del sintoma fue ${symptomSeverity}/10.`));
  }
  if (typeof energyLevel === "number") {
    notes.push(text(locale, `Energy level was ${energyLevel}/10.`, `La energia fue ${energyLevel}/10.`));
  }
  return notes.slice(0, 4);
}

function vitalsSnapshotFor(wizard: TriageWizardContext | undefined): TriageSummary["vitalsSnapshot"] {
  const units: Record<keyof NonNullable<TriageWizardContext["vitals"]>, string> = {
    bpm: "bpm",
    respiratoryRate: "breaths/min",
    oxygenSaturation: "%",
    temperatureC: "°C",
    systolicBp: "mmHg",
    diastolicBp: "mmHg",
    glucoseMgdl: "mg/dL",
    painScore: "/10",
    energyLevel: "/10",
  };
  const readings = Object.entries(wizard?.vitals ?? {}).flatMap(([rawKey, rawValue]) => {
    if (typeof rawValue !== "number") return [];
    const key = rawKey as keyof typeof units;
    const evidence = wizard?.vitalsEvidence?.[key];
    return [{
      key,
      value: rawValue,
      unit: units[key],
      source: evidence?.source ?? "manual_entry" as const,
      affectsTriage: evidence?.affectsTriage ?? true,
    }];
  });
  return readings.length ? { capturedAt: new Date().toISOString(), readings } : undefined;
}

function concernLabel(locale: string, level: TriageScanResult["concernLevel"]) {
  if (level === "urgent") return text(locale, "concerning", "preocupante");
  if (level === "watch") return text(locale, "worth watching", "para vigilar");
  return text(locale, "not concerning", "sin senales preocupantes");
}

export function scanNotesFor(locale: string, wizard: TriageWizardContext | undefined): string[] {
  const scans = wizard?.scanResults ?? [];
  return scans.map((scan) => {
    const findings = scan.findings.length ? ` ${scan.findings.slice(0, 3).join("; ")}` : "";
    const storageNote = scan.type === "vitals"
      ? ""
      : ` ${text(locale, "The photo was analyzed and discarded.", "La foto se analizo y se descarto.")}`;
    const limitation = scan.type === "urine_photo"
      ? ` ${text(locale, "A photo cannot diagnose a urine infection.", "Una foto no puede diagnosticar una infeccion de orina.")}`
      : scan.type === "stool_photo"
        ? ` ${text(locale, "A photo cannot diagnose bleeding or bowel disease.", "Una foto no puede diagnosticar sangrado o enfermedad intestinal.")}`
        : "";
    return text(
      locale,
      `Optional scan (${scan.label}) looked ${concernLabel(locale, scan.concernLevel)}: ${scan.summary}.${findings}${storageNote}${limitation}`,
      `Escaneo opcional (${scan.label}) se ve ${concernLabel(locale, scan.concernLevel)}: ${scan.summary}.${findings}${storageNote}${limitation}`,
    );
  }).slice(0, 4);
}

export function uniqueStrings(items: string[]) {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index);
}

export function fallbackReportContent(locale: string, summary: TriageSummary, symptom: string) {
  if (summary.nextStepLevel === "emergency") {
    return text(
      locale,
      `Your answers include an emergency warning sign for ${symptom}.`,
      `Tus respuestas incluyen una senal de emergencia para ${symptom}.`,
    );
  }
  if (summary.nextStepLevel === "doctor_today") {
    return text(
      locale,
      `Your answers show ${symptom} should be checked today.`,
      `Tus respuestas indican que ${symptom} debe revisarse hoy.`,
    );
  }
  if (summary.nextStepLevel === "doctor_24_48") {
    return text(
      locale,
      `Your answers show ${symptom} should be checked within 24-48 hours.`,
      `Tus respuestas indican que ${symptom} debe revisarse en 24-48 horas.`,
    );
  }
  return text(
    locale,
    `Your answers fit a lower-risk ${symptom} pattern right now.`,
    `Tus respuestas encajan ahora con un patron de menor riesgo para ${symptom}.`,
  );
}

function firstUserClue(messages: TriageChatMessage[]) {
  return messages.find((message) => message.role === "user")?.content ?? "";
}

export function buildFallbackTriageReport(
  locale: string,
  wizard: TriageWizardContext | undefined,
  messages: TriageChatMessage[],
  healthMemory?: TriageHealthMemory,
): { content: string; summary: TriageSummary } {
  const report = buildFallbackTriageReportWithTelemetry(locale, wizard, messages, healthMemory);
  return {
    content: report.content,
    summary: report.summary,
  };
}

export function buildFallbackTriageReportWithTelemetry(
  locale: string,
  wizard: TriageWizardContext | undefined,
  messages: TriageChatMessage[],
  healthMemory?: TriageHealthMemory,
): { content: string; summary: TriageSummary; telemetry: TriageOutcomeTelemetry } {
  const symptomId = selectedSymptomId(wizard);
  const symptom = symptomLabel(locale, symptomId);
  const chiefComplaint = firstUserClue(messages).replace(/\s+/g, " ").trim() || symptom;
  const detailLabels = selectedAnswers(wizard)
    .filter((answer) => ["severity", "duration", "trend"].includes(answer.kind ?? ""))
    .map((answer) => answer.label);
  const baseSummary: TriageSummary = {
    chiefComplaint,
    symptoms: uniqueStrings([symptom, ...detailLabels]).slice(0, 4),
    urgency: "monitor",
    recommendations: [],
    disclaimer: text(
      locale,
      "This assessment is for information only and is not medical advice. Always consult your doctor or call emergency services if you feel it is serious.",
      "Esta evaluacion es solo informativa y no sustituye el consejo medico. Consulta siempre con tu medico o llama a emergencias si sientes que es grave.",
    ),
    triageReasons: [],
    watchSigns: watchSignsFor(locale, symptomId),
    profileConsiderations: [],
    vitalsNotes: [],
  };
  const { summary, telemetry } = evaluateTriageSafetyFloor(baseSummary, wizard, locale, healthMemory);
  return {
    content: fallbackReportContent(locale, summary, symptom),
    summary,
    telemetry,
  };
}

export function nextStepFor(
  locale: string,
  summary: TriageSummary,
  wizard: TriageWizardContext | undefined,
): Pick<TriageSummary, "nextStepLabel" | "nextStepLevel"> {
  const answers = selectedAnswers(wizard);
  const ids = new Set(answers.map((answer) => answer.id));
  const hasCriticalRedFlag = answers.some((answer) => CRITICAL_RED_FLAG_IDS.has(answer.id));
  const strongSeverity = hasStrongSeverity(wizard);

  if (hasCriticalRedFlag) {
    return {
      nextStepLevel: "emergency",
      nextStepLabel: text(locale, "Call emergency services now", "Llama a emergencias ahora"),
    };
  }
  if (summary.urgency === "urgent" || (strongSeverity && ids.has("worse")) || ids.has("new_symptoms")) {
    return {
      nextStepLevel: "doctor_today",
      nextStepLabel: text(locale, "Talk to a doctor today", "Habla con un médico hoy"),
    };
  }
  if (summary.urgency === "routine" || strongSeverity || ids.has("worse")) {
    return {
      nextStepLevel: "doctor_24_48",
      nextStepLabel: text(locale, "Talk to a doctor within 24-48 hours", "Habla con un médico en 24-48 horas"),
    };
  }
  return {
    nextStepLevel: "monitor",
    nextStepLabel: text(locale, "Monitor at home, with doctor access ready", "Vigila en casa, con medico disponible"),
  };
}

function nextStepRank(level: TriageRuleLevel | undefined) {
  if (level === "emergency") return 4;
  if (level === "doctor_today") return 3;
  if (level === "doctor_24_48") return 2;
  return 1;
}

function outcomeTelemetryFor(input: {
  symptom?: string;
  summary: TriageSummary;
  ruleTelemetry: {
    ruleIdsFired: string[];
    profileModifiersApplied: string[];
    vitalsOverlaysApplied: string[];
    escalationSources: TriageEscalationSource[];
  };
  urgentScanApplied: boolean;
}): TriageOutcomeTelemetry {
  const ruleIds = input.urgentScanApplied
    ? [...input.ruleTelemetry.ruleIdsFired, "triage.scan.urgent_visible_change"]
    : input.ruleTelemetry.ruleIdsFired;
  const escalationSources = input.urgentScanApplied
    ? [...input.ruleTelemetry.escalationSources, "symptom" as const]
    : input.ruleTelemetry.escalationSources;

  return {
    symptomPath: input.symptom ?? "unknown",
    urgency: input.summary.urgency,
    ruleIdsFired: uniqueStrings(ruleIds),
    profileModifiersApplied: uniqueStrings(input.ruleTelemetry.profileModifiersApplied),
    vitalsOverlaysApplied: uniqueStrings(input.ruleTelemetry.vitalsOverlaysApplied),
    caregiverEscalationTriggered: false,
    escalationSources: [...new Set(escalationSources)],
  };
}

export function primaryEscalationSource(telemetry: TriageOutcomeTelemetry): TriageEscalationSource | undefined {
  if (telemetry.escalationSources.includes("caregiver")) return "caregiver";
  if (telemetry.escalationSources.includes("vitals")) return "vitals";
  if (telemetry.escalationSources.includes("profile")) return "profile";
  if (telemetry.escalationSources.includes("symptom")) return "symptom";
  return undefined;
}

export function evaluateTriageSafetyFloor(
  summary: TriageSummary,
  wizard: TriageWizardContext | undefined,
  locale: string,
  healthMemory?: TriageHealthMemory,
): { summary: TriageSummary; telemetry: TriageOutcomeTelemetry } {
  const answers = selectedAnswers(wizard);
  const ids = new Set(answers.map((answer) => answer.id));
  const symptom = selectedSymptomId(wizard);
  const hasCriticalRedFlag = answers.some((answer) => CRITICAL_RED_FLAG_IDS.has(answer.id));
  const risks = profileRiskFlags(healthMemory);
  const eligibleVital = (key: keyof NonNullable<TriageWizardContext["vitals"]>) => wizard?.vitalsEvidence?.[key]?.affectsTriage !== false;
  const bpm = eligibleVital("bpm") ? wizard?.vitals?.bpm ?? undefined : undefined;
  const respiratoryRate = eligibleVital("respiratoryRate") ? wizard?.vitals?.respiratoryRate ?? undefined : undefined;
  const abnormalPulse = typeof bpm === "number" && (bpm >= 110 || bpm <= 50);
  const abnormalBreathingRate = typeof respiratoryRate === "number" && (respiratoryRate >= 24 || respiratoryRate <= 10);
  const scanResults = wizard?.scanResults ?? [];
  const scanNotes = scanNotesFor(locale, wizard);
  const urgentScans = scanResults.filter((scan) => scan.concernLevel === "urgent" && scan.type !== "vitals");
  const urgentScanReason = urgentScans.length
    ? text(locale, "An optional scan found a concerning visible change that should be shared with a clinician today.", "Un escaneo opcional encontro un cambio visible preocupante que conviene compartir hoy con un clinico.")
    : "";
  const urgentScanRecommendation = urgentScans.length
    ? text(locale, "Talk to a doctor today and share the scan note. Seek urgent help sooner if severe symptoms appear.", "Habla con un medico hoy y comparte la nota del escaneo. Busca ayuda urgente antes si aparecen sintomas fuertes.")
    : "";
  const ruleDecision = evaluateTriageRules({
    locale,
    symptomId: symptom,
    answerIds: ids,
    risks,
    hasCriticalRedFlag,
    abnormalPulse,
    abnormalBreathingRate,
    pulseBpm: bpm,
    respiratoryRate,
    oxygenSaturation: eligibleVital("oxygenSaturation") ? wizard?.vitals?.oxygenSaturation ?? undefined : undefined,
    temperatureC: eligibleVital("temperatureC") ? wizard?.vitals?.temperatureC ?? undefined : undefined,
    systolicBp: eligibleVital("systolicBp") ? wizard?.vitals?.systolicBp ?? undefined : undefined,
    diastolicBp: eligibleVital("diastolicBp") ? wizard?.vitals?.diastolicBp ?? undefined : undefined,
    glucoseMgdl: eligibleVital("glucoseMgdl") ? wizard?.vitals?.glucoseMgdl ?? undefined : undefined,
    painScore: wizard?.vitals?.painScore ?? selectedSeverityScore(wizard) ?? undefined,
    energyLevel: wizard?.vitals?.energyLevel ?? undefined,
  });
  const baseSummary = {
    ...summary,
    symptoms: summary.symptoms?.length ? summary.symptoms : [symptomLabel(locale, symptom)],
    urgency: urgentScans.length ? maxUrgency(ruleDecision.urgency, "urgent") : ruleDecision.urgency,
    triageReasons: [
      urgentScanReason,
      ...ruleDecision.reasons,
      ...(summary.triageReasons ?? []),
    ].filter(Boolean).filter((item, index, items) => items.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index).slice(0, 3),
    watchSigns: ruleDecision.watchSigns.length ? ruleDecision.watchSigns : summary.watchSigns?.length ? summary.watchSigns : watchSignsFor(locale, symptom),
    profileConsiderations: [
      ...(summary.profileConsiderations ?? []),
      ...profileConsiderationsFor(locale, risks, symptom),
      ...ruleDecision.profileConsiderations,
    ].slice(0, 3),
    vitalsNotes: [
      ...(summary.vitalsNotes ?? []),
      ...vitalsNotesFor(locale, wizard),
    ].slice(0, 3),
    vitalsSnapshot: vitalsSnapshotFor(wizard) ?? null,
    scanResults,
    scanNotes: uniqueStrings([
      ...(summary.scanNotes ?? []),
      ...scanNotes,
    ]).slice(0, 4),
    recommendations: mergeTriageRecommendations(
      [urgentScanRecommendation, ...ruleDecision.recommendations],
      summary.recommendations ?? [],
    ),
  };
  const scanNextStep = urgentScans.length && nextStepRank(ruleDecision.level) < nextStepRank("doctor_today")
    ? {
        nextStepLevel: "doctor_today" as const,
        nextStepLabel: text(locale, "Talk to a doctor today", "Habla con un medico hoy"),
      }
    : null;
  const nextStep: Pick<TriageSummary, "nextStepLabel" | "nextStepLevel"> = scanNextStep ?? {
    nextStepLevel: ruleDecision.level,
    nextStepLabel: ruleDecision.nextStepLabel,
  };

  const finalSummary = {
    ...baseSummary,
    ...nextStep,
  };

  if (isFrenchLocale(locale)) {
    finalSummary.nextStepLabel = frenchOutcomeText(finalSummary.nextStepLabel ?? "");
    const localizedReasons = (finalSummary.triageReasons ?? []).map(frenchOutcomeText);
    const localizedRecommendations = (finalSummary.recommendations ?? []).map(frenchOutcomeText);
    const localizedWatchSigns = (finalSummary.watchSigns ?? []).map(frenchOutcomeText);
    const localizedProfileConsiderations = (finalSummary.profileConsiderations ?? []).map(frenchOutcomeText);
    const localizedVitalsNotes = (finalSummary.vitalsNotes ?? []).map(frenchOutcomeText);
    const localizedScanNotes = (finalSummary.scanNotes ?? []).map(frenchOutcomeText);

    finalSummary.triageReasons = localizedReasons.some(looksLikeEnglish)
      ? [frenchFallbackReason(finalSummary.nextStepLevel ?? "monitor")]
      : localizedReasons;
    finalSummary.recommendations = localizedRecommendations.some(looksLikeEnglish)
      ? frenchFallbackRecommendations(finalSummary.nextStepLevel ?? "monitor")
      : localizedRecommendations;
    finalSummary.watchSigns = localizedWatchSigns.some(looksLikeEnglish)
      ? watchSignsFor(locale, symptom)
      : localizedWatchSigns;
    finalSummary.profileConsiderations = localizedProfileConsiderations.some(looksLikeEnglish)
      ? profileConsiderationsFor(locale, risks, symptom)
      : localizedProfileConsiderations;
    finalSummary.vitalsNotes = localizedVitalsNotes.filter((note) => !looksLikeEnglish(note));
    finalSummary.scanNotes = localizedScanNotes.filter((note) => !looksLikeEnglish(note));
  }

  Object.assign(finalSummary, buildTriageInsights({
    locale,
    symptomId: symptom,
    wizard,
    risks,
    summary: finalSummary,
    level: finalSummary.nextStepLevel ?? "monitor",
    watchSigns: finalSummary.watchSigns ?? [],
  }));

  return {
    summary: finalSummary,
    telemetry: outcomeTelemetryFor({
      symptom,
      summary: finalSummary,
      ruleTelemetry: ruleDecision.telemetry,
      urgentScanApplied: urgentScans.length > 0,
    }),
  };
}

export function applyTriageSafetyFloor(
  summary: TriageSummary,
  wizard: TriageWizardContext | undefined,
  locale: string,
  healthMemory?: TriageHealthMemory,
): TriageSummary {
  return evaluateTriageSafetyFloor(summary, wizard, locale, healthMemory).summary;
}

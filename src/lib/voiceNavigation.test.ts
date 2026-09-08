import { describe, expect, it } from "vitest";
import {
  actionForSpecialistTransfer,
  actionForVoiceToolCall,
  actionForVoiceUtterance,
  homeIntentForVoiceToolCall,
  homeIntentForVoiceUtterance,
  homeSubflowForVoiceToolCall,
  homeSubflowForVoiceUtterance,
  isActionableVoiceText,
  isVoiceHomeIntent,
  isVoiceHomeSubflow,
  routeForVoiceUtterance,
  specialistTransferFromToolCall,
  transitionForVoiceHomeIntent,
  toolResultForVoiceHomeIntent,
  VOICE_COVERAGE_LANGUAGES,
  VOICE_HOME_SUBFLOW_PILLARS,
  VOICE_HOME_SUBFLOW_SAMPLE_PHRASES,
  voiceActionRegistryEntries,
  type VoiceHomeSubflowId,
} from "./voiceNavigation";

const localizedSubflowCases = Object.entries(VOICE_HOME_SUBFLOW_SAMPLE_PHRASES).flatMap(
  ([actionId, phrases]) => VOICE_COVERAGE_LANGUAGES.map((language) => ({
    actionId: actionId as VoiceHomeSubflowId,
    language,
    phrase: phrases[language],
    pillar: VOICE_HOME_SUBFLOW_PILLARS[actionId as VoiceHomeSubflowId],
  })),
);

const toolCallCases: Array<{
  actionId: VoiceHomeSubflowId;
  parameters: Record<string, string>;
}> = [
  { actionId: "health-symptoms", parameters: { action_type: "health.symptoms" } },
  { actionId: "health-vitals", parameters: { action_type: "health.vitals" } },
  { actionId: "health-meds", parameters: { action_type: "medication" } },
  { actionId: "health-doctor", parameters: { action_type: "health.doctor_support" } },
  { actionId: "health-prevention", parameters: { action_type: "health.prevention" } },
  { actionId: "health-visual-scan", parameters: { action_type: "health.visual_scan" } },
  { actionId: "mind-memory", parameters: { action_type: "brain.memory" } },
  { actionId: "mind-reflexes", parameters: { action_type: "brain.reflex" } },
  { actionId: "mind-focus", parameters: { action_type: "brain.focus" } },
  { actionId: "mind-senses", parameters: { action_type: "brain.senses" } },
  { actionId: "community-friends", parameters: { action_type: "social.friend" } },
  { actionId: "community-experts", parameters: { action_type: "social.expert" } },
  { actionId: "community-share", parameters: { action_type: "social.share" } },
  { actionId: "community-activities", parameters: { action_type: "social.event" } },
  { actionId: "concierge-home", parameters: { action_type: "concierge.home_service" } },
  { actionId: "concierge-care", parameters: { action_type: "concierge.provider_contact" } },
  { actionId: "concierge-order", parameters: { action_type: "concierge.shopping" } },
  { actionId: "concierge-book", parameters: { action_type: "concierge.ride" } },
];

describe("voice navigation actions", () => {
  it("defines exactly 18 actions and six canonical language samples per action", () => {
    expect(Object.keys(VOICE_HOME_SUBFLOW_SAMPLE_PHRASES)).toHaveLength(18);
    expect(VOICE_COVERAGE_LANGUAGES).toHaveLength(6);
    expect(localizedSubflowCases).toHaveLength(108);
  });

  it.each(localizedSubflowCases)(
    "maps $language phrase for $actionId to its exact visual action",
    ({ actionId, phrase, pillar }) => {
      expect(homeSubflowForVoiceUtterance(phrase)).toEqual({ actionId, pillar });
    },
  );

  it.each(toolCallCases)(
    "maps agent tool parameters to $actionId",
    ({ actionId, parameters }) => {
      expect(homeSubflowForVoiceToolCall(parameters)).toEqual({
        actionId,
        pillar: VOICE_HOME_SUBFLOW_PILLARS[actionId],
      });
    },
  );

  it.each([
    ["Book a doctor appointment", "health-doctor"],
    ["I have chest pain and need a taxi", "health-symptoms"],
    ["I feel dizzy and want to order groceries", "health-symptoms"],
    ["Help me book a taxi", "concierge-book"],
  ] as const)(
    "uses safety-first precedence for ambiguous request %s",
    (phrase, actionId) => {
      expect(homeSubflowForVoiceUtterance(phrase)?.actionId).toBe(actionId);
    },
  );

  it.each([
    ["Check my blood pressure", "health-vitals", "health"],
    ["Recuérdame mis pastillas", "health-meds", "health"],
    ["Je veux parler au médecin", "health-doctor", "health"],
    ["Ich habe Schmerzen", "health-symptoms", "health"],
    ["I'm not feeling well", "health-symptoms", "health"],
    ["No me encuentro bien", "health-symptoms", "health"],
    ["Je ne me sens pas bien", "health-symptoms", "health"],
    ["Mir geht es nicht gut", "health-symptoms", "health"],
    ["Non mi sento bene", "health-symptoms", "health"],
    ["Nao me sinto bem", "health-symptoms", "health"],
    ["Vorrei allenare la memoria", "mind-memory", "mind"],
    ["Quero melhorar a atenção", "mind-focus", "mind"],
    ["Find an activity nearby", "community-activities", "community"],
    ["Quiero conocer gente", "community-friends", "community"],
    ["J'ai besoin d'un plombier", "concierge-home", "concierge"],
    ["Buche ein Taxi", "concierge-book", "concierge"],
  ] as const)("maps specific multilingual request %s to %s", (utterance, actionId, pillar) => {
    expect(homeSubflowForVoiceUtterance(utterance)).toEqual({ actionId, pillar });
  });

  it.each([
    [{ route: "/health/symptom-check" }, "health-symptoms", "health"],
    [{ action_type: "brain.memory" }, "mind-memory", "mind"],
    [{ action_type: "social.event" }, "community-activities", "community"],
    [{ action_type: "concierge.ride" }, "concierge-book", "concierge"],
  ] as const)("maps a specific tool call to its Home action", (parameters, actionId, pillar) => {
    expect(homeSubflowForVoiceToolCall(parameters)).toEqual({ actionId, pillar });
  });

  it("rejects malformed Home subflow events", () => {
    expect(isVoiceHomeSubflow({ actionId: "health-vitals", pillar: "health" })).toBe(true);
    expect(isVoiceHomeSubflow({ actionId: "health-vitals", pillar: "mind" })).toBe(false);
    expect(isVoiceHomeSubflow({ actionId: "unknown", pillar: "health" })).toBe(false);
  });

  it.each([
    "Health",
    "My health",
    "I need help with my health",
    "Could you show my health options?",
    "Salud",
    "Mi salud",
    "Quiero ayuda con mi salud",
    "Muéstrame las opciones de mi salud",
    "Meine Gesundheit",
    "Ich brauche Hilfe bei meiner Gesundheit",
    "Ma santé",
    "Je voudrais de l'aide pour ma santé",
    "La mia salute",
    "Ho bisogno di aiuto con la mia salute",
    "Minha saúde",
    "Preciso de ajuda com a minha saúde",
  ])("opens the Health choice layer for broad pillar request %s", (utterance) => {
    expect(homeIntentForVoiceUtterance(utterance)).toBe("health");
  });

  it("keeps specific health requests on their exact action", () => {
    expect(homeIntentForVoiceUtterance("Check my blood pressure")).toBeNull();
    expect(homeIntentForVoiceUtterance("Necesito ayuda con dolor de pecho")).toBeNull();
    expect(homeIntentForVoiceUtterance("Je veux prendre rendez-vous avec mon médecin")).toBeNull();
    expect(actionForVoiceUtterance("Check my blood pressure")?.id).toBeTruthy();
  });

  it("turns a broad Health client-tool call into the Home Health choice layer", () => {
    expect(homeIntentForVoiceToolCall({ domain: "health" })).toBe("health");
    expect(homeIntentForVoiceToolCall({ domain: "health", route: "/" })).toBe("health");
    expect(homeIntentForVoiceToolCall({
      domain: "health",
      action_type: "health.vitals_review",
    })).toBeNull();
    expect(homeIntentForVoiceToolCall({
      domain: "health",
      route: "/health/symptom-check",
    })).toBeNull();
  });

  it.each([
    ["My mind", "mind"],
    ["Mi mente", "mind"],
    ["Mon cerveau", "mind"],
    ["Mein Gedächtnis", "mind"],
    ["La mia memoria", "mind"],
    ["Minha memória", "mind"],
    ["My community", "community"],
    ["Mi comunidad", "community"],
    ["Ma communauté", "community"],
    ["Meine Gemeinschaft", "community"],
    ["La mia comunità", "community"],
    ["Minha comunidade", "community"],
    ["My concierge", "concierge"],
    ["Mi concierge", "concierge"],
    ["Mon concierge", "concierge"],
    ["Mein Concierge", "concierge"],
    ["Il mio concierge", "concierge"],
    ["Meu concierge", "concierge"],
  ])("recognises broad cross-pillar request %s", (utterance, intent) => {
    expect(homeIntentForVoiceUtterance(utterance)).toBe(intent);
  });

  it("maps broad cross-pillar client tools without intercepting specific actions", () => {
    expect(homeIntentForVoiceToolCall({ domain: "brain_coach" })).toBe("mind");
    expect(homeIntentForVoiceToolCall({ domain: "social" })).toBe("community");
    expect(homeIntentForVoiceToolCall({ domain: "concierge" })).toBe("concierge");
    expect(homeIntentForVoiceToolCall({
      domain: "concierge",
      action_type: "concierge.ride_booking",
    })).toBeNull();
  });

  it("owns one canonical visual transition for every broad pillar intent", () => {
    expect(transitionForVoiceHomeIntent("health")).toEqual({
      kind: "home_layer",
      layer: "health",
    });
    expect(transitionForVoiceHomeIntent("mind")).toEqual({
      kind: "home_layer",
      layer: "mind",
    });
    expect(transitionForVoiceHomeIntent("community")).toEqual({
      kind: "home_layer",
      layer: "community",
    });
    expect(transitionForVoiceHomeIntent("concierge")).toEqual({
      kind: "home_layer",
      layer: "concierge",
    });
  });

  it("returns stable agent tool acknowledgements for every pillar", () => {
    expect(toolResultForVoiceHomeIntent("health")).toBe("Showing the Health choices.");
    expect(toolResultForVoiceHomeIntent("mind")).toBe("Showing the Mind choices.");
    expect(toolResultForVoiceHomeIntent("community")).toBe("Showing the Community choices.");
    expect(toolResultForVoiceHomeIntent("concierge")).toBe("Showing the Concierge choices.");
  });

  it("rejects malformed pillar event details", () => {
    expect(isVoiceHomeIntent("health")).toBe(true);
    expect(isVoiceHomeIntent("mind")).toBe(true);
    expect(isVoiceHomeIntent("unknown")).toBe(false);
    expect(isVoiceHomeIntent({ intent: "health" })).toBe(false);
    expect(isVoiceHomeIntent(null)).toBe(false);
  });

  it("accepts the pillar alias used by alternate agent configurations", () => {
    expect(homeIntentForVoiceToolCall({ pillar: "health" })).toBe("health");
    expect(homeIntentForVoiceToolCall({ pillar: "brain-coach" })).toBe("mind");
    expect(homeIntentForVoiceToolCall({ pillar: "community" })).toBe("community");
    expect(homeIntentForVoiceToolCall({ pillar: "concierge" })).toBe("concierge");
  });

  it("ignores punctuation-only and filler transcript noise", () => {
    expect(isActionableVoiceText("'")).toBe(false);
    expect(isActionableVoiceText("...")).toBe(false);
    expect(isActionableVoiceText(" ? ")).toBe(false);
    expect(isActionableVoiceText("um")).toBe(false);
    expect(actionForVoiceUtterance("'")).toBeNull();
    expect(routeForVoiceUtterance("...")).toBeNull();
  });

  it("opens medication report for medication stock questions", () => {
    const action = actionForVoiceUtterance("Do we need to buy Paracetamol?");

    expect(action?.id).toBe("voice_meds_inventory_report");
    expect(action?.route).toBe("/meds/adherence-report");
    expect(action?.domain).toBe("meds");
    expect(action?.actionType).toBe("meds.inventory_report");
    expect(action?.safetyLevel).toBe("medical");
    expect(action?.extractedSubject).toBe("paracetamol");
  });

  it("routes booking a GP appointment to concierge", () => {
    const action = actionForVoiceUtterance("Can you book GP appointment for me?");

    expect(action?.id).toBe("voice_book_health_appointment");
    expect(action?.route).toBe("/concierge");
    expect(action?.domain).toBe("concierge");
    expect(action?.requiresConfirmation).toBe(true);
  });

  it("routes shopping and grocery choices to the Concierge shopping helper", () => {
    const action = actionForVoiceUtterance("Can you help me choose groceries for the week?");

    expect(action?.id).toBe("voice_concierge_shopping");
    expect(action?.route).toBe("/concierge/shopping");
    expect(action?.domain).toBe("concierge");
    expect(action?.requiresConfirmation).toBe(false);
  });

  it("routes trusted provider requests to the home-service intake", () => {
    const action = actionForVoiceUtterance("I need a plumber today");

    expect(action?.id).toBe("voice_concierge_home_service");
    expect(action?.route).toBe("/concierge");
    expect(action?.domain).toBe("concierge");
    expect(action?.actionType).toBe("concierge.home_service");
    expect(action?.payload).toMatchObject({
      intake_origin: "voice",
      service_type: "plumber",
      task_type: "home_service",
    });
  });

  it("prioritises vitals over generic health routing", () => {
    const action = actionForVoiceUtterance("Can we check my blood pressure?");

    expect(action?.id).toBe("voice_vitals_review");
    expect(action?.route).toBe("/health/vitals");
  });

  it("routes vitals capture requests separately from vitals review", () => {
    const action = actionForVoiceUtterance("Measure my blood pressure");

    expect(action?.id).toBe("voice_vitals_capture");
    expect(action?.actionType).toBe("health.vitals_capture");
    expect(action?.route).toBe("/health/vitals");
    expect(action?.payload?.vital_type).toBe("blood_pressure");
    expect(action?.requiresConfirmation).toBe(true);
  });

  it("routes ride booking requests to Concierge with confirmation context", () => {
    const action = actionForVoiceUtterance("Book me a ride to the doctor tomorrow morning");

    expect(action?.id).toBe("voice_concierge_ride_booking");
    expect(action?.actionType).toBe("concierge.ride_booking");
    expect(action?.route).toBe("/concierge");
    expect(action?.domain).toBe("concierge");
    expect(action?.payload).toMatchObject({ task_type: "ride", destination: "doctor", time: "tomorrow morning" });
    expect(action?.requiresConfirmation).toBe(true);
  });

  it("routes order requests to the shopping order journey", () => {
    const action = actionForVoiceUtterance("Order groceries for tomorrow");

    expect(action?.id).toBe("voice_concierge_order_request");
    expect(action?.actionType).toBe("concierge.order_request");
    expect(action?.route).toBe("/concierge/shopping");
    expect(action?.payload).toMatchObject({ items: "groceries", category: "groceries" });
    expect(action?.requiresConfirmation).toBe(true);
  });

  it("routes medication refill requests separately from stock reports", () => {
    const action = actionForVoiceUtterance("I need more metformin");

    expect(action?.id).toBe("voice_meds_refill_request");
    expect(action?.actionType).toBe("meds.refill_request");
    expect(action?.route).toBe("/meds/adherence-report");
    expect(action?.payload?.medication_name).toBe("metformin");
    expect(action?.requiresConfirmation).toBe(true);
  });

  it("routes reminder requests to scheduled support", () => {
    const action = actionForVoiceUtterance("Remind me tomorrow morning to call my daughter");

    expect(action?.id).toBe("voice_concierge_reminder");
    expect(action?.route).toBe("/settings/scheduled-support");
    expect(action?.payload?.reminder_time).toBe("tomorrow morning");
  });

  it("opens memory games for memory game requests", () => {
    expect(routeForVoiceUtterance("Let's play a memory game")).toBe("/brain-coach/remember");
  });

  it("routes common brain and companion journeys to their direct screens", () => {
    expect(actionForVoiceUtterance("Help me relax")?.actionType).toBe("brain.relax_breathe");
    expect(routeForVoiceUtterance("Help me focus")).toBe("/brain-coach/focus");
    expect(routeForVoiceUtterance("I want to learn something")).toBe("/learn");
    expect(routeForVoiceUtterance("Train my senses")).toBe("/brain-coach/calm");
    expect(actionForVoiceUtterance("I want cognitive exercises")?.actionType).toBe("brain.activity");
    expect(routeForVoiceUtterance("I want cognitive exercises")).toBe("/mind-memory");
    expect(routeForVoiceUtterance("I want someone to talk to")).toBe("/companions");
  });

  it("creates app actions from ElevenLabs tool parameters", () => {
    const action = actionForVoiceToolCall({
      route: "/meds/adherence-report",
      title: "Paracetamol stock",
      reason: "The user asked whether they need to buy paracetamol.",
      subject: "paracetamol",
    });

    expect(action?.id).toBe("voice_meds_inventory_report");
    expect(action?.route).toBe("/meds/adherence-report");
    expect(action?.title).toBe("Paracetamol stock");
    expect(action?.extractedSubject).toBe("paracetamol");
    expect(action?.payload?.simulated).toBeUndefined();
    expect(action?.optionalPayloadKeys).toContain("medication_name");
  });

  it("creates app actions from registry aliases", () => {
    const action = actionForVoiceToolCall({
      action_type: "meds_inventory_report",
      medication_name: "ibuprofen",
    });

    expect(action?.actionType).toBe("meds.inventory_report");
    expect(action?.route).toBe("/meds/adherence-report");
    expect(action?.payload?.medication_name).toBe("ibuprofen");
  });

  it("infers ride actions from ambiguous Concierge tool calls", () => {
    const action = actionForVoiceToolCall({
      route: "/concierge",
      domain: "concierge",
      source_text: "Book me a ride to the doctor tomorrow morning",
    });

    expect(action?.actionType).toBe("concierge.ride_booking");
    expect(action?.route).toBe("/concierge");
    expect(action?.payload).toMatchObject({
      task_type: "ride",
      destination: "doctor",
      time: "tomorrow morning",
    });
  });

  it("infers Brain Coach actions from ambiguous cognitive exercise tool calls", () => {
    const action = actionForVoiceToolCall({
      domain: "brain",
      source_text: "I want cognitive exercises",
    });

    expect(action?.actionType).toBe("brain.activity");
    expect(action?.domain).toBe("brain_coach");
    expect(action?.route).toBe("/mind-memory");
  });

  it("rejects unrecognised app action routes from tool parameters", () => {
    expect(actionForVoiceToolCall({ route: "https://example.com" })).toBeNull();
    expect(actionForVoiceToolCall({ route: "/unknown" })).toBeNull();
  });

  it("creates specialist transfer requests from tool parameters", () => {
    const transfer = specialistTransferFromToolCall({
      domain: "brain-coach",
      reason: "The user asked for a memory game.",
    });

    expect(transfer?.domain).toBe("brain_coach");
    expect(transfer?.agentSlug).toBe("brain-coach");

    const action = transfer ? actionForSpecialistTransfer(transfer) : null;
    expect(action?.id).toBe("voice_transfer_brain_coach");
    expect(action?.route).toBe("/mind-memory");
  });

  it("exposes action registry contracts for simulator and app fulfilment", () => {
    const entries = voiceActionRegistryEntries();
    const meds = entries.find((entry) => entry.actionType === "meds.inventory_report");
    const safety = entries.find((entry) => entry.actionType === "safety.support");
    const ride = entries.find((entry) => entry.actionType === "concierge.ride_booking");
    const refill = entries.find((entry) => entry.actionType === "meds.refill_request");

    expect(entries.length).toBeGreaterThan(18);
    expect(meds?.optionalPayloadKeys).toContain("medication_name");
    expect(safety?.safetyLevel).toBe("urgent");
    expect(safety?.requiresConfirmation).toBe(true);
    expect(ride?.requiredPayloadKeys).toEqual(["pickup", "destination", "time"]);
    expect(refill?.requiresConfirmation).toBe(true);
  });
});

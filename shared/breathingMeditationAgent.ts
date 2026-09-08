export const BREATHING_MEDITATION_AGENT_SLUG = "breathing-meditation" as const;

export type BreathingMeditationActivityId = "breath_garden" | "relax_breathe";

type ActivityPlaybook = {
  version: string;
  title: string;
  purpose: string;
  agentRole: string;
};

export const BREATHING_MEDITATION_ACTIVITY_PLAYBOOKS: Record<BreathingMeditationActivityId, ActivityPlaybook> = {
  breath_garden: {
    version: "breath_garden.gentle_5_6.v1",
    title: "Breath Garden",
    purpose: "calm body awareness with a longer exhale",
    agentRole: "Give a brief welcome, use only short phase cues during the timer, accept pause, resume, finish, and safety interruptions, then close gently.",
  },
  relax_breathe: {
    version: "relax_breathe.adaptive.v1",
    title: "Relax & Breathe",
    purpose: "choose and guide a breathing or meditation plan for the user's current need",
    agentRole: "Help choose a suitable plan, explain one step at a time, accept changes and interruptions, and follow the application phase state.",
  },
};

export function buildBreathingMeditationAgentContext(input: {
  activityId: BreathingMeditationActivityId;
  language: string;
  durationSeconds?: number;
  patternId?: string;
  inhaleSeconds?: number;
  exhaleSeconds?: number;
  holdSeconds?: number;
  guidanceMode?: string;
}) {
  const playbook = BREATHING_MEDITATION_ACTIVITY_PLAYBOOKS[input.activityId];
  return {
    routing_domain: "breathing_meditation",
    app_entrypoint: input.activityId,
    activity_id: input.activityId,
    activity_title: playbook.title,
    activity_playbook_version: playbook.version,
    activity_purpose: playbook.purpose,
    activity_agent_role: playbook.agentRole,
    activity_language: input.language,
    timer_authority: "application",
    guidance_mode: input.guidanceMode ?? "guided_audio",
    duration_seconds: input.durationSeconds ?? 0,
    breathing_pattern_id: input.patternId ?? "activity_defined",
    inhale_seconds: input.inhaleSeconds ?? 0,
    exhale_seconds: input.exhaleSeconds ?? 0,
    hold_seconds: input.holdSeconds ?? 0,
  };
}

export function buildBreathingMeditationOpeningPrompt(context: ReturnType<typeof buildBreathingMeditationAgentContext>) {
  return [
    `You are assisting with ${context.activity_title}.`,
    `Use playbook ${context.activity_playbook_version}.`,
    context.activity_agent_role,
    "The application is the authority for timing and phase state; never invent a new phase or breathing measurement.",
    "Keep spoken guidance calm, brief, and easy to interrupt.",
    "If the user reports pain, dizziness, chest discomfort, or unusual difficulty breathing, tell them to stop and follow the application's safety response.",
  ].join(" ");
}

export function buildBreathGardenPhasePrompt(phase: "inhale" | "exhale", language: string) {
  return [
    "Breath Garden phase cue requested.",
    `Current phase: ${phase}.`,
    `Required response language: ${language}.`,
    `Say exactly one short, natural ${phase} cue in that language.`,
    "Do not name the language, translate aloud, count, explain, or add anything else.",
  ].join(" ");
}

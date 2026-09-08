import { describe, expect, it } from "vitest";
import { drAiFirstMessage, resolveVoiceContextDomain } from "./voiceContext";
import { shouldUseLegacyVoiceContextMem0 } from "../lib/voiceContext.js";

describe("voice context domain resolution", () => {
  it("keeps onboarding profile voice sessions out of generic social context", () => {
    expect(resolveVoiceContextDomain({ agent_slug: "onboarding-profile" })).toBe("onboarding_profile");
    expect(resolveVoiceContextDomain({ agent_slug: "profile-onboarding" })).toBe("onboarding_profile");
    expect(resolveVoiceContextDomain({ domain: "onboarding_profile" })).toBe("onboarding_profile");
  });

  it("maps both Dr. AI slugs to the existing health context contract", () => {
    expect(resolveVoiceContextDomain({ agent_slug: "dr-ai" })).toBe("health");
    expect(resolveVoiceContextDomain({ agent_slug: "ask-dr-ai" })).toBe("health");
  });
});

describe("voice context Mem0 privacy boundary", () => {
  it.each(["health", "doctor", "meds", "safety"] as const)(
    "does not use legacy Mem0 for sensitive domain %s",
    (domain) => {
      expect(shouldUseLegacyVoiceContextMem0(domain)).toBe(false);
    },
  );

  it.each(["companion", "concierge", "brain_coach", "social"] as const)(
    "keeps legacy memory available for non-medical domain %s",
    (domain) => {
      expect(shouldUseLegacyVoiceContextMem0(domain)).toBe(true);
    },
  );
});

describe("Dr. AI first message", () => {
  it("uses the user's name naturally in the selected language", () => {
    expect(drAiFirstMessage("fr-FR", "Karim")).toBe(
      "Je suis là avec vous, Karim. Prenez votre temps et dites-moi ce qui vous semble différent aujourd’hui.",
    );
  });

  it("keeps a safe generic greeting when no name is available", () => {
    expect(drAiFirstMessage("en", "")).toBe(
      "I'm here with you. Tell me what feels different today.",
    );
  });
});

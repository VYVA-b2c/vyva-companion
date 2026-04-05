

## Plan: Add Voice-First Hero with "Talk to VYVA" to Every Screen

### Concept
Each screen gets a purple hero card (like Home) with a contextual message and a prominent "Talk to VYVA" mic button. The hero adapts its copy to the screen's purpose. Below the hero, existing content remains but users always have the voice option front and center.

### Changes by Screen

**1. Meds Screen (`src/pages/MedsScreen.tsx`)**
- Replace the current purple hero with the standard voice-first hero pattern
- Headline: "Need help with medications?" (Lora italic 26px)
- Subtitle: "2 of 3 taken today" with progress bar below
- Source row: mic orb + "VYVA manages your meds" + Live pill
- "Talk to VYVA" button at bottom of hero (navigates to `/chat`)
- Keep all medication cards below unchanged

**2. Health Screen (`src/pages/HealthScreen.tsx`)**
- Replace the green hero with the purple voice-first hero
- Headline: "How are you feeling, Margaret?" (Lora italic 26px)
- Subtitle: "Tell me about your symptoms"
- Source row: mic orb + "VYVA monitors your health" + Live pill
- "Talk to VYVA" button
- Keep stats row (Blood pressure, Mood, Sleep) inside the hero below the button
- Keep symptom checker and doctor referral cards below

**3. Activities Screen (`src/pages/ActivitiesScreen.tsx`)**
- Replace the current purple hero with the voice-first hero pattern
- Headline: "Ready for brain training?" (Lora italic 26px)
- Subtitle: "7-day streak — keep it going!"
- Source row: mic orb + "VYVA is your brain coach" + Live pill
- "Talk to VYVA" button + secondary "Start a session" white button below
- Keep activity grid and streak card below

**4. Concierge Screen (`src/pages/ConciergeScreen.tsx`)**
- Replace the cream hero with the purple voice-first hero
- Headline: "How can I help?" (Lora italic 26px)
- Subtitle: "Taxis, orders, appointments & more"
- Source row: mic orb + "VYVA handles it for you" + Live pill
- "Talk to VYVA" button (with mic-listening animation)
- Keep service tile grid below

**5. Home Screen (`src/pages/HomeScreen.tsx`)**
- Already has the voice-first hero — no changes needed

### Shared Hero Structure (all screens)
```text
┌─────────────────────────────────┐
│ [mic orb] Context text   ● Live│
│                                 │
│ Headline (Lora italic 26px)     │
│ Subtitle (DM Sans 14px)        │
│                                 │
│ [  🎙  Talk to VYVA           ]│
└─────────────────────────────────┘
```
- Purple bg `#6B21A8`, radius 24px, decorative circle
- mic-listening animation on the Talk button
- All navigate to `/chat` on tap

### Files Changed
- `src/pages/MedsScreen.tsx` — new voice hero, keep meds content
- `src/pages/HealthScreen.tsx` — new voice hero, keep health content
- `src/pages/ActivitiesScreen.tsx` — new voice hero, keep activities content
- `src/pages/ConciergeScreen.tsx` — new voice hero, keep concierge tiles


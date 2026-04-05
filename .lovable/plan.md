

## Plan: Extract VoiceHero Shared Component

### New File: `src/components/VoiceHero.tsx`
Reusable component with props:
- `sourceText: string` — context label (e.g. "VYVA is here for you")
- `headline: React.ReactNode` — Lora italic 26px title
- `subtitle?: React.ReactNode` — DM Sans 14px subtitle
- `children?: React.ReactNode` — slot for screen-specific content (progress bars, stats, extra buttons) rendered between subtitle and Talk button

Renders: purple bg, decorative circle, source row with mic orb + Live pill, headline, subtitle, children, "Talk to VYVA" button with mic-listening animation. Uses `useNavigate` internally.

### Screen Updates (5 files)

**HomeScreen.tsx** — replace lines 13–45 with `<VoiceHero sourceText="VYVA is here for you" headline="Good morning, Margaret!" subtitle="How are you feeling today?" />`

**MedsScreen.tsx** — replace lines 12–51 with `<VoiceHero>` passing progress bar as children

**HealthScreen.tsx** — replace hero with `<VoiceHero>` passing stats row as children

**ActivitiesScreen.tsx** — replace hero with `<VoiceHero>` passing "Start a session" button as children

**ConciergeScreen.tsx** — replace hero with `<VoiceHero>` with no children

### Files: 6 total (1 new + 5 edits)


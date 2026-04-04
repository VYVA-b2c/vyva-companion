

## VYVA — Phase 1 Build Plan

### Overview
Build the VYVA senior companion app: a voice-first mobile web app for elderly users (65+). 5 screens with bottom tab navigation, static mock data, warm cream-toned design system with Lora + DM Sans typography. Mobile-first (max-width 480px), centered on desktop.

---

### Step 1: Foundation & Design System
- Add Google Fonts (Lora + DM Sans) to `index.html` with preload
- Set up VYVA color palette as CSS custom properties (purple, gold, green, red, teal, rose, cream, warm tones)
- Configure Tailwind with VYVA's custom colors, typography, spacing, and border-radius tokens
- Set page background to `#FBF8F3` (cream)
- Create `mockData.ts` with Margaret's profile, medications, activities, caregivers, and VYVA chat messages

### Step 2: App Shell & Navigation
- **Bottom tab nav** (72px, white, sticky) with 5 tabs: Home, VYVA Chat, My Health, Activities, Settings
- Active state: purple icon bg + purple label; Inactive: muted label
- **Custom status bar** (sticky top): time + date (left), weather + battery (right)
- App wrapper: max-width 480px, centered, scrollable content area between status bar and nav
- Set up React Router routes for all 5 screens

### Step 3: Home Screen
- **VYVA greeting hero card** — purple bg, decorative circle, mic orb + "Live" pill, Lora italic headline, body text, "Tap to talk" CTA button (navigates to Chat)
- **SOS emergency bar** — red-tinted card with 52×52 SOS circle button, confirmation bottom sheet on tap
- **2×2 action tile grid** — Medications, Brain Coach, How I Feel, Help me with… (each with themed icon, title, subtitle, optional badge)
- **Mini action row** — 4 quick-access buttons: Chat, Call Sarah, Call family, Settings

### Step 4: VYVA Chat Screen
- **Chat header** — back button, VYVA avatar, title, "Here for you" status
- **Proactive note banner** — "VYVA started this conversation at 09:30"
- **Message bubbles** — VYVA (left, white bubble) and user (right, purple bubble) with avatars, pre-populated with 3 mock messages
- **Quick reply buttons** — horizontal scroll row with pill-shaped options
- **Sticky voice bar** — 58×58 purple mic button with pulsing "listening" animation, "Tap to speak" label, "Type" button

### Step 5: My Health Screen
- **Health hero card** — green bg, "All looking good" title, 3-column stats (meds taken, blood pressure, mood)
- **Medications card** — warm header with badge, 3 medication rows (taken/due states with icons), "Confirm I've taken Metformin" button
- **Symptom checker card** — selectable symptom tags (Headache, Knee pain, Tired, Dizzy, Chest pain), VYVA voice prompt row

### Step 6: Activities (Brain Coach) Screen
- **Activities hero** — purple bg, brain icon, title + subtitle, "Start a session" button
- **"Choose an activity" section** — 3×2 grid of activity cards (Trivia, Memory game, Scrabble, Logic puzzle, Meditation, Breathing) with themed icons and done states
- **7-day streak tracker** — day circles (M–S) with completed/today states, streak count display

### Step 7: Settings Screen
- **Profile card** — warm bg, avatar with initials, name + subtitle
- **Module sections** (5 grouped cards):
  - Companion (Core features, no toggles)
  - Medication Management (toggles)
  - Safety Monitoring (toggles, sensitive note about consent)
  - Brain Coach (toggle + frequency value)
  - What I Share & With Whom (3 sharing toggles)
- Each with section headers, icon rows, and purple/off toggles

### Key UX Details
- All tap targets minimum 52×52px
- Bottom sheets instead of full-screen modals (SOS confirmation)
- Mic button pulsing animation for "listening" state
- Scroll within content area; status bar + nav always visible
- Warm, human copy throughout — no clinical language


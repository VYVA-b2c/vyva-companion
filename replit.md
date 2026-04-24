# VYVA — Replit Project

## Overview
VYVA is a voice-first AI companion app for seniors, built with React + Vite (frontend) and an Express API server (backend). It uses ElevenLabs for conversational AI and Replit's built-in PostgreSQL (via Drizzle ORM) for data persistence.

## Architecture

### Frontend (Vite, port 5000)
- React 18 SPA with React Router, Tailwind CSS, and shadcn/ui components
- Located in `src/`
- Entry point: `src/main.tsx` → `src/App.tsx`
- Voice integration: `src/hooks/useVyvaVoice.ts` — calls `/api/router` then `/api/elevenlabs-conversation-token` to start a WebRTC session with ElevenLabs

### Backend (Express, port 3001)
- Located in `server/`
- `server/index.ts` — Express app entry point
- `server/db.ts` — Drizzle ORM client connected to Replit's PostgreSQL via `DATABASE_URL`
- `server/routes/router.ts` — Intent classification and routing logic; selects the correct ElevenLabs agent based on what the user says; reads/writes session state using Drizzle
- `server/routes/conversationToken.ts` — Fetches a short-lived conversation token from ElevenLabs for a given agent_id

### Database (Replit PostgreSQL)
- Schema defined in `shared/schema.ts` using Drizzle ORM
- 7 tables: `profiles`, `session_state`, `session_exchanges`, `agent_difficulty`, `caregiver_alerts`, `medication_adherence`, `user_medications`
- Push schema changes with `npm run db:push`

### Dev Setup
Vite proxies all `/api/*` requests to the Express server (port 3001). Both start together with `npm run dev` via `concurrently`.

## Running
```
npm run dev
```
This starts both the Express server (port 3001) and the Vite dev server (port 5000) concurrently.

## Database Schema
```
npm run db:push   # Push schema changes to Replit PostgreSQL
```

## Environment Variables / Secrets
All secrets are stored in Replit Secrets. Required secrets:

| Secret | Purpose |
|---|---|
| `ELEVENLABS_API_KEY` | ElevenLabs API authentication |
| `ELEVENLABS_COMPANION_AGENT_ID` | Agent for general companion chat |
| `ELEVENLABS_SAFETY_AGENT_ID` | Agent for emergency/safety situations |
| `ELEVENLABS_MEDS_AGENT_ID` | Agent for medication queries |
| `ELEVENLABS_HEALTH_AGENT_ID` | Agent for health/symptom queries |
| `ELEVENLABS_CONCIERGE_AGENT_ID` | Agent for scheduling/tasks |
| `ELEVENLABS_BRAIN_COACH_AGENT_ID` | Agent for cognitive exercises |
| `MEM0_API_KEY` | Memory retrieval for personalised responses (optional) |
| `DATABASE_URL` | Replit PostgreSQL connection string (auto-provisioned) |
| `GOOGLE_PLACES_API_KEY` | Google Maps JavaScript API key with Places API (New) enabled — served via `/api/config/places-key` to the `PlacesSearch` component. Used for GP, pharmacy, restaurant, beauty and all provider category searches. Without this key the search bar falls back to manual entry mode. |

## Key Pages

### Main App (wrapped in AppShell chrome)
- `/` — Home screen with voice hero and quick-action tiles
- `/chat` — Full chat screen with live voice transcript
- `/health` — Health check-in
- `/meds` — Medications screen
- `/brain-coach` — Cognitive games (Activities)
- `/concierge` — Concierge/scheduling
- `/settings` — Settings

### Onboarding Flow (full-screen, no AppShell)
- `/onboarding` — Welcome screen
- `/onboarding/basics` — Name, preferred name, DOB, language (Step 1)
- `/onboarding/channel` — How VYVA contacts you (Step 2)
- `/onboarding/consent` — GDPR data consent (Step 3)
- `/onboarding/activation` — Setup complete, prompt to fill profile (Step 4/5)
- `/onboarding/profile` — Health profile overview (11 sections)
- `/onboarding/profile/gp` — GP details with Google Places search
- `/onboarding/profile/providers` — Pharmacy/hospital/specialist details with Places search
- `/onboarding/complete/:section` — Section saved confirmation

### Settings Sub-pages (full-screen)
- `/settings/privacy` — Per-person GDPR consent toggles
- `/settings/subscription` — Free / Premium plan card with upgrade CTA

### Shared Onboarding Components (`src/components/onboarding/`)
- `PlacesSearch` — Google Places Autocomplete (fetches key from `/api/config/places-key`, which reads the `GOOGLE_PLACES_API_KEY` Replit Secret server-side)
- `PhoneFrame` — Mobile frame wrapper for previews
- `ChipSelector` — Multi-select / single-select pill chips
- `ToggleRow` — Reusable labelled toggle switch row
- `CategoryFilterBar` — Horizontal scrollable category filter tabs
- `SectionCard` — Profile section card with completion indicator

## Internationalisation (i18n)
The app uses **react-i18next** to switch the UI language based on the user's Preferred Language setting.

- **Setup**: `src/i18n/index.ts` — initialises i18next and loads all 7 locale files
- **Locale files**: `src/i18n/locales/{lang}.json` for en, es, fr, de, it, pt, cy
- **Language switching**: `src/contexts/ProfileContext.tsx` calls `i18n.changeLanguage()` whenever the profile's `language` field changes
- **Translated components**: `BottomNav`, `HomeScreen`, `ChatScreen`, `SettingsScreen`, `VoiceHero` (Talk to VYVA, Live, Active, status labels)
- **Not yet translated**: secondary screens (Health, Meds, Brain Coach, Activity); country and timezone option labels in Settings (proper nouns, kept as-is)

## Companion Matchmaking (Task #99)

A full senior-companion matchmaking system was added at `/companions`:

- **Interest/Values Picker** — First-time setup screen with 21 interests (4 categories), 8 values, and 8 preferred-activity chips; toggled chip UI saved to `companion_profiles`
- **Suggestion Cards** — Ranked by shared-interest count; shows name, age, shared interests, localized suggested activity; paginated with Connect / Skip; index clamped on refetch to prevent out-of-bounds crash
- **My Companions Tab** — Lists accepted companions, outgoing pending requests, and incoming requests (accept / decline)
- **Activity Screen Tile** — "Find a Companion" entry card on the Activities/Brain Coach screen
- **Backend**: `server/routes/companions.ts` with 5 REST endpoints (GET/POST `/profile`, GET `/suggestions`, POST `/connect`, PATCH `/connect/:id`, GET `/connections`)
- **Database**: Two new tables (`companion_profiles` with interests/hobbies/values/preferred_activities arrays, `companion_connections`) created via SQL migration + direct ALTER TABLE for new columns
- **i18n**: Full translations in all 7 locales (en, es, fr, de, it, pt, cy) covering interests, values, preferred activities, error toasts, and all UI strings

## Agent Routing Logic
The `router` API classifies each user utterance using keyword scoring across six domains: `safety`, `meds`, `health`, `concierge`, `brain_coach`, and `companion` (default). Safety is always checked first. Session state is persisted in Replit's PostgreSQL so agents have context across turns.

## Deployment
Deployment is configured for Replit Autoscale:
- **Build**: `npm run build`
  - `build:client` → Vite builds the React frontend into `dist/`
  - `build:server` → esbuild compiles the Express server TypeScript into `server-dist/index.cjs`
- **Run**: `npm start` (`NODE_ENV=production node ./server-dist/index.cjs`)

In production mode (`NODE_ENV=production`):
- Express listens on port 5000
- Serves static files from `dist/` (Vite build output)
- Catch-all route returns `dist/index.html` for SPA client-side routing
- `/api/*` routes continue to work normally

In development mode:
- Express listens on port 3001
- Vite dev server runs on port 5000 and proxies `/api/*` to Express

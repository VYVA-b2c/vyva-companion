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

## Key Pages
- `/` — Home screen with voice hero and quick-action tiles
- `/chat` — Full chat screen with live voice transcript
- `/health` — Health check-in
- `/meds` — Medications screen
- `/brain-coach` — Cognitive games (Activities)
- `/concierge` — Concierge/scheduling
- `/settings` — Settings

## Agent Routing Logic
The `router` API classifies each user utterance using keyword scoring across six domains: `safety`, `meds`, `health`, `concierge`, `brain_coach`, and `companion` (default). Safety is always checked first. Session state is persisted in Replit's PostgreSQL so agents have context across turns.

## Deployment
Deployment is configured for Replit Autoscale:
- **Build**: `npm run build && esbuild server/index.ts --bundle --platform=node --format=cjs --outfile=dist/index.cjs --packages=external`
  - Vite builds the React frontend into `dist/`
  - esbuild compiles the Express server TypeScript into `dist/index.cjs`
- **Run**: `NODE_ENV=production node ./dist/index.cjs`

In production mode (`NODE_ENV=production`):
- Express listens on port 5000
- Serves static files from `dist/` (Vite build output)
- Catch-all route returns `dist/index.html` for SPA client-side routing
- `/api/*` routes continue to work normally

In development mode:
- Express listens on port 3001
- Vite dev server runs on port 5000 and proxies `/api/*` to Express

# VYVA — Replit Project

## Overview
VYVA is a voice-first AI companion app for seniors, built with React + Vite (frontend) and an Express API server (backend). It uses ElevenLabs for conversational AI and Supabase for user data persistence.

## Architecture

### Frontend (Vite, port 5000)
- React 18 SPA with React Router, Tailwind CSS, and shadcn/ui components
- Located in `src/`
- Entry point: `src/main.tsx` → `src/App.tsx`
- Voice integration: `src/hooks/useVyvaVoice.ts` — calls `/api/router` then `/api/elevenlabs-conversation-token` to start a WebRTC session with ElevenLabs

### Backend (Express, port 3001)
- Located in `server/`
- `server/index.ts` — Express app entry point
- `server/routes/router.ts` — Intent classification and routing logic; selects the correct ElevenLabs agent based on what the user says; writes session state to Supabase
- `server/routes/conversationToken.ts` — Fetches a short-lived conversation token from ElevenLabs for a given agent_id

### Dev Setup
Vite proxies all `/api/*` requests to the Express server (port 3001). Both start together with `npm run dev` via `concurrently`.

## Running
```
npm run dev
```
This starts both the Express server (port 3001) and the Vite dev server (port 5000) concurrently.

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
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin access (server-side only) |
| `MEM0_API_KEY` | Memory retrieval for personalised responses (optional) |

Env vars (non-sensitive, set in Replit):

| Var | Value |
|---|---|
| `SUPABASE_URL` | `https://zhderqerctxjijvaesfr.supabase.co` |
| `VITE_SUPABASE_URL` | Same as above (for client-side Supabase auth if needed) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |

## Key Pages
- `/` — Home screen with voice hero and quick-action tiles
- `/chat` — Full chat screen with live voice transcript
- `/health` — Health check-in
- `/meds` — Medications screen
- `/brain-coach` — Cognitive games (Activities)
- `/concierge` — Concierge/scheduling
- `/settings` — Settings

## Agent Routing Logic
The `router` API classifies each user utterance using keyword scoring across six domains: `safety`, `meds`, `health`, `concierge`, `brain_coach`, and `companion` (default). Safety is always checked first. Session state is persisted in Supabase so agents have context across turns.

## Deployment
Deployment is configured for Replit Autoscale:
- Build: `npm run build` (Vite)
- Run: `node ./dist/index.cjs`

For production, the Express server will need to serve the Vite-built static files. This can be added to `server/index.ts` when ready to deploy.

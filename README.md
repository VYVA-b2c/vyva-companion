# VYVA 2.0

VYVA is a voice-first AI companion app for seniors. The app combines a React mobile-style frontend with an Express API server for onboarding, health support, medication adherence, concierge workflows, companion matching, billing, and AI-assisted scans.

## Stack

- React 18, Vite, TypeScript, React Router, TanStack Query
- Tailwind CSS and shadcn/ui components
- Express 5 API server
- Drizzle ORM with PostgreSQL
- ElevenLabs conversational AI, OpenAI-assisted features, Stripe billing, Google Places
- Vitest, Testing Library, Supertest, Playwright

## Getting Started

Install dependencies with npm:

```sh
npm ci
```

Start the app locally:

```sh
npm run dev
```

In development, the API runs on port 3001 and Vite serves the frontend on port 5000. Vite proxies `/api/*` calls to the Express server.

## Environment

Create a local `.env` file for secrets. The app expects these variables depending on which features you use:

- `DATABASE_URL`
- `JWT_SECRET`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_COMPANION_AGENT_ID`
- `ELEVENLABS_SAFETY_AGENT_ID`
- `ELEVENLABS_MEDS_AGENT_ID`
- `ELEVENLABS_HEALTH_AGENT_ID`
- `ELEVENLABS_CONCIERGE_AGENT_ID`
- `ELEVENLABS_BRAIN_COACH_AGENT_ID`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `GOOGLE_PLACES_API_KEY`
- `MEM0_API_KEY` optional

Server integration tests are skipped unless `DATABASE_URL` is present.

## Scripts

```sh
npm run dev          # Start API and frontend
npm run build        # Build client and server
npm run lint         # Run ESLint
npm test             # Run Vitest
npm run db:push      # Push Drizzle schema changes
```

## Project Layout

- `src/` - React application, pages, components, hooks, i18n, and client tests
- `server/` - Express routes, middleware, services, and server integration tests
- `shared/` - Shared Drizzle schema
- `schema/` and `migrations/` - SQL schema changes
- `supabase/functions/` - Supabase edge functions
- `public/` - Static assets

## Deployment

Production build:

```sh
npm run build
npm start
```

In production, Express serves the built frontend from `dist/` and keeps `/api/*` routes available.

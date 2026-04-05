

## Plan: Connect "Talk to VYVA" to ElevenLabs Conversational AI via Router

### Overview
Install `@elevenlabs/react`, create a conversation token edge function, build a `useVyvaVoice` hook that calls the router → gets the agent ID → fetches a conversation token → starts an ElevenLabs WebRTC session. The VoiceHero button and ChatScreen mic button both use this hook. The ChatScreen becomes a live voice conversation UI showing real-time status (listening, VYVA speaking, etc.).

### Architecture

```text
User taps "Talk to VYVA"
  → useVyvaVoice hook
    → POST /router (utterance: "hello", user_id, session_id)
    → receives { agent_id, system_prompt_override }
    → POST /elevenlabs-conversation-token (agent_id)
    → receives { token }
    → useConversation.startSession({ conversationToken: token })
    → Live WebRTC voice session with ElevenLabs agent
```

### Changes

**1. Install dependency**
- `npm install @elevenlabs/react`

**2. New edge function: `supabase/functions/elevenlabs-conversation-token/index.ts`**
- Accepts `{ agent_id }` in POST body
- Uses `ELEVENLABS_API_KEY` secret to call `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=...`
- Returns `{ token }` with CORS headers

**3. New hook: `src/hooks/useVyvaVoice.ts`**
- Wraps `useConversation` from `@elevenlabs/react`
- Exposes `startVoice(contextHint?: string)`, `stopVoice()`, `status`, `isSpeaking`, `transcript[]`
- `startVoice` flow:
  1. Request mic permission
  2. Call router edge function with utterance (contextHint or "hello"), a generated session_id, and a placeholder user_id
  3. Extract `agent_id` from response
  4. Call `elevenlabs-conversation-token` with that agent_id
  5. Call `conversation.startSession({ conversationToken: token })`
- Tracks user/agent transcript messages via `onMessage` callback
- Stores session_id in state so subsequent calls reuse it

**4. Update `src/components/VoiceHero.tsx`**
- Accept optional `contextHint` prop (e.g. "medication", "health check")
- On "Talk to VYVA" tap: call `startVoice(contextHint)` instead of navigating to `/chat`
- When voice is active, show inline status: "Listening..." / "VYVA is speaking..." with animated mic
- Add a "Stop" button to end the session
- When disconnected, revert to normal "Talk to VYVA" button

**5. Rewrite `src/pages/ChatScreen.tsx`**
- Use `useVyvaVoice` hook for the bottom mic button
- Display live transcript (user + agent messages) in the message list alongside mock history
- Show real-time status in the voice bar (connected/listening/speaking)
- Quick reply buttons send text via `conversation.sendUserMessage(text)`
- Keep existing visual design (purple bubbles, avatars, header)

**6. Update `src/pages/HomeScreen.tsx`**
- Pass `contextHint="companion"` to VoiceHero

**7. Update other screens** (MedsScreen, HealthScreen, ActivitiesScreen, ConciergeScreen)
- Pass appropriate `contextHint` to VoiceHero (e.g. "medication reminder", "health symptoms", "brain training", "book a taxi")

### Files changed: 9
- `package.json` — add `@elevenlabs/react`
- `supabase/functions/elevenlabs-conversation-token/index.ts` — new
- `src/hooks/useVyvaVoice.ts` — new
- `src/components/VoiceHero.tsx` — voice integration with inline status
- `src/pages/ChatScreen.tsx` — live transcript + voice controls
- `src/pages/HomeScreen.tsx` — contextHint prop
- `src/pages/MedsScreen.tsx` — contextHint prop
- `src/pages/HealthScreen.tsx` — contextHint prop
- `src/pages/ActivitiesScreen.tsx` — contextHint prop
- `src/pages/ConciergeScreen.tsx` — contextHint prop


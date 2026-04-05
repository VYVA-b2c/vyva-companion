

## Plan: Add VYVA Logo & Reduce Text for Voice-First Feel

### 1. Add logo asset to project
- Copy `user-uploads://logo-with-bg.png` to `src/assets/vyva-logo.png`

### 2. Subtle logo placement in StatusBar
- Replace the text-based time/date left section with the VYVA logo (small, ~28px height) as a brand mark in the status bar left side, keeping time next to it
- This gives persistent, subtle branding without a dedicated header

### 3. Logo in Chat header
- Replace the purple circle + mic icon VYVA avatar in the chat header with the actual logo image (cropped/sized to 44×44, rounded)

### 4. Reduce text across screens — voice-first principle

**Home Screen:**
- Remove the body paragraph from the hero card ("I noticed you had a lovely brain session...") — the greeting headline is enough; VYVA would *say* the rest
- Shorten SOS subtitle to just "Tap to alert your family"
- Remove subtitles from the 2×2 action tiles — keep only icon + title + badge. The voice explains context

**Health Screen:**
- Remove the body text from the health hero ("Your medications are mostly on track...")
- Remove "Tell me if anything is bothering you today" label from symptom checker — the tags are self-explanatory
- Shorten symptom voice row text to "Tell VYVA in your own words"

**Activities Screen:**
- Remove hero subtitle text ("Keep your mind sharp · VYVA guides everything") — the button speaks for itself

**Chat Screen:**
- No changes needed — chat is naturally voice-first

**Settings Screen:**
- No changes needed — settings requires explicit text labels

### 5. Add a voice-first visual cue on Home
- Make the hero CTA button more prominent: larger mic icon with a subtle pulsing animation, shorter label "Talk to VYVA"

### Summary of changes
- 1 asset copy
- 2 files for logo integration (StatusBar, ChatScreen)
- 3 screen files for text reduction (Home, Health, Activities)
- Result: cleaner, less text-heavy UI with subtle branding throughout


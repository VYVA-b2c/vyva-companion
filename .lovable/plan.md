

## Plan: Visual Layer Rebuild to Match VYVA Spec

### Overview
Align every screen pixel-perfectly with the provided spec. The current structure is close but needs refinement across sizing, icons, animations, text content, and spacing. No routing or data changes needed.

---

### 1. CSS & Animations Update (`src/index.css`)
- Add `live-pulse`, `sos-ring`, and `mic-listen` keyframe animations from the spec
- Add corresponding utility classes (`.live-dot`, `.sos-btn`, `.mic-listening`)
- Keep existing animations that don't conflict
- Ensure body font-smoothing rule is present

### 2. StatusBar Updates (`src/components/StatusBar.tsx`)
- Change time to Lora 20px (currently 22px)
- Add battery indicator back (right side, per spec: weather + battery)
- Keep settings gear icon

### 3. BottomNav Updates (`src/components/BottomNav.tsx`)
- Change height to 72px explicitly
- Active icon container: 28x28 radius 10px bg `#EDE9FE`
- Label: DM Sans 11px 500
- Inactive label color: `#B5A89F`
- Use `BrainCircuit` icon instead of `Brain` for Activities tab

### 4. Home Screen (`src/pages/HomeScreen.tsx`)
- Hero: change decorative div to CSS `::before` pseudo-element, headline to Lora italic 26px, add `\n` linebreak in greeting
- Source row: refine sizing (36x36 orb, Live pill with specific rgba values)
- Live dot: use `.live-dot` animation class
- Talk button: full width, rgba bg/border per spec, 9999px radius
- SOS bar: add `.sos-btn` animation, increase button to 56x56, update text
- Action grid tiles: add subtitle text back (spec includes subtitles), min-height 130px, icon container 48x48 radius 14px, title Lora 19px
- Mini action row: icon container 38x38 radius 12px, label 12px, min-height 80px
- SOS modal: update button text to "Send Alert"

### 5. Chat Screen (`src/pages/ChatScreen.tsx`)
- Header: back button 42x42, avatar 46x46, status dot 7x7
- Proactive banner: padding 5px 14px
- Message bubbles: padding 14px 16px, DM Sans 16px line-height 1.6
- Quick replies: DM Sans 15px, padding 11px 20px, min-height 46px
- Voice bar: mic 62x62, update layout to match spec exactly
- Use `.mic-listening` class for active state

### 6. Health Screen (`src/pages/HealthScreen.tsx`)
- Hero: add decorative circle `::before`, uppercase label styling
- Med rows: min-height 64px, gap 14px
- Confirm button: radius 9999px, min-height 56px, use link icon instead of pill
- Symptom tags: min-height 44px, padding 9px 16px
- Voice row: update text to "Tell VYVA how you're feeling in your own words"

### 7. Activities Screen (`src/pages/ActivitiesScreen.tsx`)
- Hero: icon container 64x64 radius 18px, BrainCircuit 32px
- Add subtitle text: DM Sans 14px rgba(255,255,255,0.75)
- Activity icons: use HelpCircle (Trivia), Layers (Memory), Type (Scrabble), Puzzle (Logic), Headphones (Meditation), Wind (Breathing)
- Card min-height 100px, icon container 44x44 radius 14px
- Streak day circles: 32x32 radius 9px, gap 6px
- Streak number: Lora 34px

### 8. Concierge Screen (`src/pages/ConciergeScreen.tsx`)
- Hero: padding 24px 20px, title Lora italic 26px
- Mic button: 72x72, mic icon 28px
- Tile grid: radius 18px, padding 18px 16px, min-height 72px, icon container 44x44 radius 13px
- Update icon colors per spec (pharmacy → teal, nearby → gold, prescriptions → rose)

### 9. AppShell (`src/components/AppShell.tsx`)
- Ensure bottom padding accounts for 72px nav

### Files changed: 9 files (index.css, StatusBar, BottomNav, HomeScreen, ChatScreen, HealthScreen, ActivitiesScreen, ConciergeScreen, AppShell)


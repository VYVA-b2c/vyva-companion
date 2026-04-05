

## Plan: Swap Battery → Settings (top) and Settings → Concierge (bottom)

### Changes

**`src/components/StatusBar.tsx`**
- Remove the Battery icon and "82%" text
- Replace with a Settings (gear) icon that navigates to `/settings`

**`src/components/BottomNav.tsx`**
- Change the last tab from Settings (gear icon, `/settings`) to Concierge
- Use the `ConciergeBell` lucide icon, label "Concierge", path `/concierge`

**`src/pages/ConciergeScreen.tsx`** (new)
- Create a placeholder Concierge screen with a warm hero card, mic button, and a few mock concierge task tiles (e.g. "Book a taxi", "Order groceries", "Call the pharmacy")
- Voice-first style consistent with other screens

**`src/App.tsx`**
- Add route for `/concierge` → `ConciergeScreen`


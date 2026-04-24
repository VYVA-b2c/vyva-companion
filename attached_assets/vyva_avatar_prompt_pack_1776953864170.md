# VYVA Avatar Prompt Pack for Replit

## 1) Master avatar prompt

Create a reusable character asset for the VYVA app. This is **not** a one-off illustration and **not** a random avatar. It must be a fixed, reusable assistant character used consistently across all screens.

### Character identity
- female-presenting AI companion
- warm, calm, trustworthy, elegant
- emotionally reassuring
- premium soft 3D / polished cartoon style
- senior-friendly
- modern but not trendy
- same character every time

### Face and hair
- medium-length silver / grey bob haircut
- soft side part
- rounded friendly face
- large warm brown eyes
- soft eyebrows
- gentle natural smile
- no exaggerated expression
- no glasses
- no heavy makeup

### Clothing
- simple lavender / soft purple knit top
- minimal, plain, elegant
- no jewelry
- no accessories
- no patterns

### Art style
- soft 3D character illustration
- polished app-mascot quality
- clean edges
- subtle shading
- premium mobile product aesthetic
- not anime
- not flat vector
- not realistic photo
- not childish cartoon
- not Pixar imitation
- not a different character per render

### Composition
- portrait orientation
- transparent background preferred
- waist-up composition for hero use
- centered character
- slightly turned toward viewer
- relaxed shoulders
- kind, reassuring expression

### Quality constraints
- same facial identity across all variants
- same hairstyle across all variants
- same outfit across all variants
- only expression changes between variants
- avoid background clutter
- avoid props
- avoid scene elements

### Negative prompt
Do not generate:
- different women across variations
- different hairstyles
- different outfits
- exaggerated smiles
- childish mascot energy
- hyper-realistic skin
- flat icon style
- extra accessories
- busy background
- hand gestures
- waving
- over-animation feel

---

## 2) Variant prompts

Use the **same master character** and generate these 4 fixed variants only.

### A. Happy
Use the master VYVA avatar. Keep the exact same woman, face, hair, and outfit. Expression: warm supportive smile, slightly brighter eyes, calm positive energy. Subtle and elegant, not exaggerated.

### B. Calm
Use the master VYVA avatar. Keep the exact same woman, face, hair, and outfit. Expression: neutral-soft smile, relaxed eyes, very reassuring and stable. This should be the default state.

### C. Thoughtful
Use the master VYVA avatar. Keep the exact same woman, face, hair, and outfit. Expression: attentive and reflective, slightly softer smile, subtly focused eyes, mild thoughtful presence.

### D. Gentle Concern
Use the master VYVA avatar. Keep the exact same woman, face, hair, and outfit. Expression: gentle concern, slightly softer mouth, attentive caring eyes, supportive rather than worried. No dramatic sadness.

---

## 3) Required deliverables for Replit

Please generate and save these files in a reusable asset folder:

- /assets/vyva/avatar-happy.png
- /assets/vyva/avatar-calm.png
- /assets/vyva/avatar-thoughtful.png
- /assets/vyva/avatar-gentle-concern.png

### Asset rules
- same canvas size for all files
- same crop and framing
- transparent background if possible
- optimized for app UI
- do not regenerate a different face per file

---

## 4) Replit implementation note

Use the avatar as a fixed component, not as a newly generated image on each screen.

Example mapping:

```ts
const avatarMap = {
  happy: "/assets/vyva/avatar-happy.png",
  calm: "/assets/vyva/avatar-calm.png",
  thoughtful: "/assets/vyva/avatar-thoughtful.png",
  gentleConcern: "/assets/vyva/avatar-gentle-concern.png",
};
```

Example props:

```ts
type VyvaAvatarMood =
  | "happy"
  | "calm"
  | "thoughtful"
  | "gentleConcern";

type VyvaAvatarSize =
  | "hero"
  | "card"
  | "badge";

type VyvaAvatarProps = {
  mood?: VyvaAvatarMood;
  size?: VyvaAvatarSize;
  animated?: boolean;
  timeOfDay?: "morning" | "afternoon" | "evening";
  className?: string;
};
```

### Animation
Only allow:
- soft blink
- subtle breathing
- tiny floating motion

Do not allow:
- waving
- bouncing
- lip-sync talking animation on the homepage
- exaggerated emotional changes

---

## 5) Short version prompt for quick paste

Create one fixed reusable female AI companion avatar for VYVA in a premium soft 3D polished cartoon style. She must have medium-length silver bob hair, warm brown eyes, a rounded friendly face, and a simple lavender knit top. She should feel calm, warm, trustworthy, elegant, and emotionally reassuring for a senior-care app. Generate the exact same character in 4 variants only: happy, calm, thoughtful, and gentle concern. Keep the same face, hair, outfit, crop, and proportions across all variants. Transparent background preferred. Do not generate different women or different styles across versions.

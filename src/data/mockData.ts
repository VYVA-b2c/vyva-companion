export const margaret = {
  name: "Margaret Hughes",
  initials: "MH",
  streak: 7,
  wellbeing: 82,
  medications: [
    { name: "Aspirin 75mg", note: "Taken this morning with breakfast", status: "taken" as const },
    { name: "Lisinopril 10mg", note: "Taken at 9:00", status: "taken" as const },
    { name: "Metformin 500mg", note: "Due this evening at 19:00 · I'll remind you", status: "due" as const },
  ],
  mood: ["great", "great", "ok", "great", "great", "great", "ok"] as const,
  activities: [
    { name: "Trivia quiz", done: true, icon: "trophy", iconBg: "bg-vyva-green-light", iconColor: "text-vyva-green" },
    { name: "Memory game", done: false, icon: "brain", iconBg: "bg-vyva-purple-light", iconColor: "text-vyva-purple" },
    { name: "Scrabble", done: false, icon: "type", iconBg: "bg-vyva-rose-light", iconColor: "text-vyva-rose" },
    { name: "Logic puzzle", done: false, icon: "puzzle", iconBg: "bg-vyva-gold-light", iconColor: "text-vyva-gold" },
    { name: "Meditation", done: false, icon: "flower", iconBg: "bg-vyva-teal-light", iconColor: "text-vyva-teal" },
    { name: "Breathing", done: false, icon: "wind", iconBg: "bg-vyva-green-light", iconColor: "text-vyva-green" },
  ],
  caregivers: [
    { name: "Sarah", role: "Daughter", initials: "SC" },
    { name: "James", role: "Son", initials: "JH" },
    { name: "Linda", role: "Carer", initials: "LP" },
  ],
};

export const vyvaMessages = [
  { from: "vyva" as const, text: "Good morning, Margaret! How did you sleep last night? And how is your knee feeling this morning?" },
  { from: "user" as const, text: "Morning! Slept alright. Knee is a bit stiff but not bad." },
  { from: "vyva" as const, text: "I'm glad you're feeling okay! A stiff knee in the mornings is so common — I've let Sarah know. Are you ready for your morning medication?" },
];

export const quickReplies = ["Yes, ready for meds", "Memory game first", "About my knee"];

export const symptoms = [
  { label: "Headache", selected: false, urgent: false },
  { label: "Knee pain", selected: true, urgent: false },
  { label: "Tired", selected: false, urgent: false },
  { label: "Dizzy", selected: false, urgent: false },
  { label: "Chest pain", selected: false, urgent: true },
];

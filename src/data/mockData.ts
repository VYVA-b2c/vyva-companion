export const margaret = {
  name: "Margaret Hughes",
  initials: "MH",
  streak: 7,
  wellbeing: 82,
  medications: [
    { name: "meds.names.aspirin75", note: "meds.notes.takenMorning", status: "taken" as const, scheduledTime: "morning" },
    { name: "meds.names.lisinopril10", note: "meds.notes.takenAt9", status: "taken" as const, scheduledTime: "morning" },
    { name: "meds.names.metformin500", note: "meds.notes.dueEvening", status: "due" as const, scheduledTime: "evening" },
  ],
  mood: ["great", "great", "ok", "great", "great", "great", "ok"] as const,
  activities: [
    { name: "brain.activities.triviaQuiz", done: true, icon: "trophy", iconBg: "bg-vyva-green-light", iconColor: "text-vyva-green" },
    { name: "brain.activities.memoryGame", done: false, icon: "brain", iconBg: "bg-vyva-purple-light", iconColor: "text-vyva-purple" },
    { name: "brain.activities.scrabble", done: false, icon: "type", iconBg: "bg-vyva-rose-light", iconColor: "text-vyva-rose" },
    { name: "brain.activities.logicPuzzle", done: false, icon: "puzzle", iconBg: "bg-vyva-gold-light", iconColor: "text-vyva-gold" },
    { name: "brain.activities.meditation", done: false, icon: "flower", iconBg: "bg-vyva-teal-light", iconColor: "text-vyva-teal" },
    { name: "brain.activities.breathing", done: false, icon: "wind", iconBg: "bg-vyva-green-light", iconColor: "text-vyva-green" },
  ],
  caregivers: [
    { name: "Sarah", role: "profile.roles.daughter", initials: "SC" },
    { name: "James", role: "profile.roles.son", initials: "JH" },
    { name: "Linda", role: "profile.roles.carer", initials: "LP" },
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

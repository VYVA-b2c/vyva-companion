export type SocialLanguage = "es" | "de" | "en";

export type SocialRoomCategory = "activity" | "social" | "useful" | "connection";

export type SocialActivityType =
  | "discussion"
  | "quiz"
  | "challenge"
  | "recipe"
  | "game"
  | "story"
  | "advice";

export type SocialRoom = {
  slug: string;
  name: string;
  category: SocialRoomCategory;
  agentSlug: string;
  agentFullName: string;
  agentColour: string;
  agentCredential: string;
  ctaLabel: string;
  topicTags: string[];
  timeSlots: string[];
  featured: boolean;
  participantCount: number;
  sessionDate: string;
  topic: string;
  opener: string;
  quote: string;
  activityType: SocialActivityType;
  contentTag: string;
  contentTitle: string;
  contentBody: string;
  options: string[];
  liveBadge: string;
  heroScore?: number;
};

export type SocialTranscriptItem = {
  id: string;
  speaker: "agent" | "user";
  text: string;
  createdAt: string;
};

export type SocialRoomMember = {
  id: string;
  name: string;
  sharedTopic?: string;
  statusLabel?: string;
};

export type SocialRoomChatItem = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
  connectable?: boolean;
};

export type SocialHubResponse = {
  user: {
    id: string;
    firstName: string;
    language: SocialLanguage;
  };
  timeSlot: string;
  activeCount: number;
  interestTags: string[];
  lastRooms: string[];
  heroRooms: SocialRoom[];
  alsoForYou: SocialRoom[];
  listRooms: SocialRoom[];
};

export type SocialRoomResponse = {
  room: SocialRoom;
  transcript: SocialTranscriptItem[];
  promptChips: string[];
  members: SocialRoomMember[];
  memberChat: SocialRoomChatItem[];
};

export type SocialMatchResponse = {
  noMatch: boolean;
  agentMessage: string;
  matchedUser?: {
    userId: string;
    name: string;
  };
  sharedTopics?: string[];
};

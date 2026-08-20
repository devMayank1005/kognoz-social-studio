import { C } from "@/lib/tokens";
import type { FormatId } from "@/lib/formats";
import type { DesignSetId } from "@/lib/designSets";
import type { IdeaStyle } from "@/lib/promptBuilders";

export type ContentPlatform =
  | "LinkedIn"
  | "Instagram"
  | "X (Twitter)"
  | "YouTube"
  | "Kognoz page"
  | "Lokesh"
  | "Harpreet"
  | "Other";

export type ContentStatus = "Draft" | "Planned" | "Scheduled" | "Posted";

export type CalendarViewMode = "month" | "week" | "list";

export interface ContentItem {
  id: string;
  n?: number; // Legacy plan number compatibility
  title: string;
  topic: string;
  content?: string; // Caption or post copy
  platform: string;
  contentType: string; // FormatId | "Text post" | "Poll"
  date: string; // YYYY-MM-DD
  time?: string; // e.g. "09:00", "13:30"
  status: ContentStatus;
  pillar: string;
  authorName?: string; // e.g. "Mayank", "Lokesh", "Yashwant"
  authorEmail?: string;
  tags?: string[];
  set?: DesignSetId;
  style?: IdeaStyle;
  createdAt: string;
  updatedAt: string;
}

export interface DynamicCalendarStore {
  version: number;
  month?: number;
  items: ContentItem[];
  updatedAt?: string;
}

export const AUTHOR_COLORS: Record<string, { bg: string; color: string }> = {
  M: { bg: "#EBF3FA", color: "#005184" }, // Mayank
  L: { bg: "#EEF7F5", color: "#00838F" }, // Lokesh
  Y: { bg: "#FEF6EC", color: "#B86B14" }, // Yashwant
  H: { bg: "#EDF7ED", color: "#2E7D32" }, // Harpreet
  K: { bg: "#F3E8FF", color: "#7E22CE" }, // Kognoz
};

export function getAuthorInfo(name?: string | null, email?: string | null): { initial: string; displayName: string; bg: string; color: string } {
  const rawName = name || (email ? email.split("@")[0] : "User") || "User";
  // Clean first name (e.g. "Mayank Tripathi" -> "Mayank")
  const firstName = rawName.split(" ")[0].trim();
  const initial = (firstName[0] || "U").toUpperCase();
  const palette = AUTHOR_COLORS[initial] || { bg: "#EAF1F4", color: "#005184" };
  return {
    initial,
    displayName: firstName,
    bg: palette.bg,
    color: palette.color
  };
}

export const PLATFORMS: { id: ContentPlatform; label: string; color: string; bg: string }[] = [
  { id: "LinkedIn", label: "LinkedIn", color: "#0A66C2", bg: "#EBF3FA" },
  { id: "Kognoz page", label: "Kognoz Page", color: "#005184", bg: "#EAF1F4" },
  { id: "Lokesh", label: "Lokesh", color: "#005184", bg: "#EAF1F4" },
  { id: "Harpreet", label: "Harpreet", color: "#55B09D", bg: "#EEF7F5" },
  { id: "Instagram", label: "Instagram", color: "#E1306C", bg: "#FDF0F5" },
  { id: "X (Twitter)", label: "X (Twitter)", color: "#111111", bg: "#F0F0F0" },
  { id: "YouTube", label: "YouTube", color: "#FF0000", bg: "#FEEBEB" },
  { id: "Other", label: "Other", color: "#6B7680", bg: "#F4F7F9" }
];

export const STATUS_CONFIG: Record<ContentStatus, { label: string; color: string; bg: string; border: string }> = {
  Draft: { label: "Draft", color: "#6B7680", bg: "#F4F7F9", border: "#DCE6EB" },
  Planned: { label: "Planned", color: "#005184", bg: "#EAF1F4", border: "#B8D5E5" },
  Scheduled: { label: "Scheduled", color: "#B86B14", bg: "#FEF6EC", border: "#F7D8B5" },
  Posted: { label: "Posted", color: "#2E7D32", bg: "#EDF7ED", border: "#B7DFB9" }
};

export const STATUS_ORDER: ContentStatus[] = ["Draft", "Planned", "Scheduled", "Posted"];

export const STATUS_NEXT: Record<ContentStatus, ContentStatus> = {
  Draft: "Planned",
  Planned: "Scheduled",
  Scheduled: "Posted",
  Posted: "Draft"
};

export const PILLARS_LIST = [
  "Behavioral Signal",
  "Consulting POV",
  "Market Intelligence",
  "Human + AI",
  "From the Work"
] as const;

export const PILLAR_COLORS: Record<string, string> = {
  "Behavioral Signal": C.blue,
  "Consulting POV": C.teal,
  "Market Intelligence": C.green,
  "Human + AI": "#C79A2A",
  "From the Work": "#8F5E9B"
};

export const ALL_CONTENT_TYPES = [
  "Carousel",
  "Square",
  "Idea Deck",
  "Article Cover",
  "Stat Card",
  "Says vs Does",
  "Dialogue",
  "Montage",
  "Story",
  "Video",
  "Founder Video",
  "Text post",
  "Poll"
] as const;

import {
  Sparkles,
  Calendar,
  FileText,
  FolderKanban,
  FileCode,
  Mic,
  Palette,
  Activity,
  Settings,
  type LucideIcon
} from "lucide-react";
import type { NavId } from "@/lib/navigation";

// Which glyph each destination wears. Exactly the icons the reference UI uses
// (demo-frontend/src/components/Sidebar.tsx), so the two look the same.
//
// It lives here rather than in lib/navigation.ts on purpose: that module is pure data
// and gets unit-tested in a node environment. Putting React components in it would drag
// lucide into every one of those tests for no benefit.
//
// The ⌘K palette reads this same map, so a destination cannot end up with one icon in
// the rail and a different one in search.
export const NAV_ICONS: Record<NavId, LucideIcon> = {
  studio: Sparkles,
  calendar: Calendar,
  articles: FileText,
  assets: FolderKanban,
  style: FileCode,
  voice: Mic,
  design: Palette,
  audit: Activity,
  settings: Settings
};

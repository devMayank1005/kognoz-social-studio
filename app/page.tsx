import { redirect } from "next/navigation";
import { HOME_HREF } from "@/lib/navigation";

// `/` is not a page any more — Studio lives at /studio, alongside five siblings.
// Redirecting rather than rendering Studio here keeps one canonical URL per screen, so
// the sidebar highlight, the command palette and a shared link all agree.
export default function RootPage() {
  redirect(HOME_HREF);
}

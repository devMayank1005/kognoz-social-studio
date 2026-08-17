import CalendarView from "@/components/CalendarView";

// Calendar (/calendar) — PRD §11. Real 36-item Month-1 plan (ported verbatim
// from kognoz-social-studio-v3.jsx), shared via Supabase, status tap-cycle
// wired. Create->/Write-> (opens Studio, auto-generates) isn't wired yet —
// that needs the Studio deck editor, which needs the <Slide> renderer port.

export default function CalendarPage() {
  return (
    <main style={{ padding: 48, maxWidth: 900, margin: "0 auto" }}>
      <h1 className="display">Calendar</h1>
      <CalendarView />
    </main>
  );
}

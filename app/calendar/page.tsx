"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import CalendarView from "@/components/CalendarView";
import { Logo } from "@/components/Logo";
import { C } from "@/lib/tokens";

export default function CalendarPage() {
  const { data: session } = useSession();

  return (
    <main style={{ padding: "32px 48px", maxWidth: 960, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 32,
          paddingBottom: 16,
          borderBottom: `1px solid ${C.line}`
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Logo h={36} />
          <Link
            href="/"
            style={{
              fontFamily: "'Open Sans', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: C.blue,
              textDecoration: "none",
              background: C.mist,
              padding: "6px 12px",
              borderRadius: 8
            }}
          >
            ← Back to Studio
          </Link>
        </div>

        {session?.user && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontFamily: "'Open Sans', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                color: C.inkSoft,
                background: C.mist,
                padding: "5px 10px",
                borderRadius: 14
              }}
            >
              {session.user.name || session.user.email}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{
                fontFamily: "'Open Sans', sans-serif",
                border: `1px solid ${C.line}`,
                background: "#fff",
                color: C.inkMute,
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                padding: "5px 10px",
                cursor: "pointer"
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      <h1 className="display" style={{ fontSize: 28, margin: "0 0 8px 0" }}>
        Content Calendar
      </h1>
      <CalendarView />
    </main>
  );
}

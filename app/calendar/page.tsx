"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import CalendarView from "@/components/calendar/CalendarView";
import { Logo } from "@/components/Logo";
import { C, FONT } from "@/lib/tokens";

export default function CalendarPage() {
  const { data: session } = useSession();

  return (
    <main
      style={{
        padding: "24px 32px 48px",
        maxWidth: 1380,
        margin: "0 auto",
        fontFamily: FONT,
        minHeight: "100vh",
        boxSizing: "border-box"
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: `1px solid ${C.line}`,
          flexWrap: "wrap",
          gap: 12
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Logo h={34} />
          <Link
            href="/"
            style={{
              fontFamily: FONT,
              fontSize: 12.5,
              fontWeight: 700,
              color: C.blue,
              textDecoration: "none",
              background: C.mist,
              padding: "7px 14px",
              borderRadius: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <span>←</span>
            <span>Back to Studio</span>
          </Link>
        </div>

        {session?.user && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 700,
                color: C.blue,
                background: C.mist,
                padding: "5px 12px",
                borderRadius: 14
              }}
            >
              {session.user.name || session.user.email}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{
                fontFamily: FONT,
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

      <CalendarView />
    </main>
  );
}

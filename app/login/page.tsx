"use client";

// Force this page to render at request time, never at build time. NextAuth's
// client code (signIn, below) builds a URL from NEXTAUTH_URL, and Next.js's
// static-export step tries to pre-render this page during `next build` —
// before Vercel has necessarily made NEXTAUTH_URL available to the build, or
// while it's still blank early in setup. Login is inherently request-time
// anyway (it depends on session state), so nothing is lost by opting out of
// static generation here.
export const dynamic = "force-dynamic";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (res?.error) {
      // Deliberately generic — don't reveal whether the email exists (product
      // principle #4 wants visible errors, but not ones that leak account state).
      setError("Wrong email or password.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-off)"
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          border: "1px solid var(--color-line)",
          borderRadius: 8,
          padding: "40px 36px",
          width: 340,
          display: "flex",
          flexDirection: "column",
          gap: 16
        }}
      >
        <h1 className="display" style={{ fontSize: 22, margin: 0 }}>
          Kognoz Social Studio
        </h1>
        <p style={{ margin: 0, color: "var(--color-ink-soft)", fontSize: 14 }}>
          Team access only.
        </p>

        <label style={{ fontSize: 13, color: "var(--color-ink-soft)" }}>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 4,
              padding: "10px 12px",
              border: "1px solid var(--color-line)",
              borderRadius: 6,
              fontSize: 14
            }}
          />
        </label>

        <label style={{ fontSize: 13, color: "var(--color-ink-soft)" }}>
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 4,
              padding: "10px 12px",
              border: "1px solid var(--color-line)",
              borderRadius: 6,
              fontSize: 14
            }}
          />
        </label>

        {error && (
          <p style={{ color: "#B3261E", fontSize: 13, margin: 0 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            background: "var(--gradient-brand)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "10px 12px",
            fontSize: 14,
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1
          }}
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>

        <p style={{ margin: 0, color: "var(--color-ink-mute)", fontSize: 12 }}>
          No account? Ask an admin to add you — see scripts/add-user.mjs.
        </p>
      </form>
    </main>
  );
}

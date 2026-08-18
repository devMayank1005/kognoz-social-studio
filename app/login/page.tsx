"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { C, GRAD } from "@/lib/tokens";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const oauthError = searchParams.get("error");
  let displayError = error;
  if (!displayError && oauthError) {
    if (oauthError === "AccessDenied") {
      displayError = "Access denied: Only @kognozconsulting.com company accounts are permitted to sign in.";
    } else {
      displayError = "Authentication failed. Please try again or sign in with your password.";
    }
  }

  async function handleMicrosoftSignIn() {
    setBusy(true);
    setError("");
    try {
      await signIn("azure-ad", { callbackUrl });
    } catch (e) {
      setBusy(false);
      setError("Failed to initiate Microsoft 365 sign in. Please try again.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl
      });

      setBusy(false);

      if (res?.error) {
        setError("Invalid email or password. Please verify your credentials.");
        return;
      }

      // Hard redirect ensures cookies are immediately sent to middleware on the next request
      window.location.href = callbackUrl;
    } catch (err) {
      setBusy(false);
      setError("An unexpected error occurred during sign in. Please try again.");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #F4F7F9 0%, #E6ECF0 50%, #DCE6EB 100%)",
        position: "relative",
        overflow: "hidden",
        padding: "24px"
      }}
    >
      {/* Decorative Kognoz Brand Circles / Petal Motif */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          right: "-5%",
          width: "520px",
          height: "520px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0, 155, 221, 0.22) 0%, rgba(67, 175, 205, 0.08) 60%, transparent 80%)",
          filter: "blur(40px)",
          pointerEvents: "none",
          animation: "kzBreathe 9s ease-in-out infinite"
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-12%",
          left: "-6%",
          width: "480px",
          height: "480px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(117, 160, 47, 0.18) 0%, rgba(85, 176, 157, 0.08) 60%, transparent 80%)",
          filter: "blur(40px)",
          pointerEvents: "none",
          animation: "kzBreathe 11s ease-in-out infinite alternate"
        }}
      />

      {/* Login Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `1px solid rgba(255, 255, 255, 0.9)`,
          boxShadow: "0 24px 60px rgba(0, 40, 70, 0.14), 0 4px 16px rgba(0, 0, 0, 0.04)",
          borderRadius: 18,
          padding: "44px 38px",
          position: "relative",
          zIndex: 10,
          boxSizing: "border-box"
        }}
      >
        {/* Brand Header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 24 }}>
          <Logo h={46} style={{ marginBottom: 16 }} />
          <h1
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: 26,
              fontWeight: 600,
              color: C.ink,
              margin: "0 0 6px 0",
              letterSpacing: "-0.02em"
            }}
          >
            Social Studio
          </h1>
          <p
            style={{
              fontFamily: "'Open Sans', sans-serif",
              fontSize: 13.5,
              color: C.inkSoft,
              margin: 0,
              lineHeight: 1.5
            }}
          >
            AI-powered content production for Kognoz LinkedIn presence
          </p>
        </div>

        {/* Microsoft 365 Single Sign-On Button */}
        <button
          type="button"
          onClick={handleMicrosoftSignIn}
          disabled={busy}
          style={{
            width: "100%",
            background: "#FFFFFF",
            border: `1.5px solid ${C.line}`,
            borderRadius: 10,
            padding: "13px 18px",
            fontSize: 14.5,
            fontWeight: 600,
            fontFamily: "'Open Sans', sans-serif",
            color: C.ink,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.75 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
            transition: "all 0.2s ease",
            marginBottom: 20
          }}
          onMouseEnter={(e) => {
            if (!busy) {
              e.currentTarget.style.borderColor = C.blue;
              e.currentTarget.style.background = "#F8FAFC";
            }
          }}
          onMouseLeave={(e) => {
            if (!busy) {
              e.currentTarget.style.borderColor = C.line;
              e.currentTarget.style.background = "#FFFFFF";
            }
          }}
        >
          <svg width="19" height="19" viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#F25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
            <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
          </svg>
          Sign in with Microsoft 365
        </button>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: C.line }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.inkMute, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            or password
          </span>
          <div style={{ flex: 1, height: 1, background: C.line }} />
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Email field */}
          <div>
            <label
              style={{
                display: "block",
                fontFamily: "'Open Sans', sans-serif",
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: C.inkSoft,
                marginBottom: 7
              }}
            >
              Work Email
            </label>
            <input
              id="work-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@kognozconsulting.com"
              style={{
                display: "block",
                width: "100%",
                padding: "11px 14px",
                border: `1.5px solid ${C.line}`,
                borderRadius: 9,
                fontSize: 14,
                fontFamily: "'Open Sans', sans-serif",
                color: C.ink,
                background: "#ffffff",
                boxSizing: "border-box",
                outline: "none",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => (e.target.style.borderColor = C.blue)}
              onBlur={(e) => (e.target.style.borderColor = C.line)}
            />
          </div>

          {/* Password field */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
              <label
                htmlFor="account-password"
                style={{
                  fontFamily: "'Open Sans', sans-serif",
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: C.inkSoft
                }}
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontFamily: "'Open Sans', sans-serif",
                  fontSize: 12,
                  color: C.blue,
                  cursor: "pointer",
                  fontWeight: 600,
                  padding: 0
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <input
              id="account-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{
                display: "block",
                width: "100%",
                padding: "11px 14px",
                border: `1.5px solid ${C.line}`,
                borderRadius: 9,
                fontSize: 14,
                fontFamily: "'Open Sans', sans-serif",
                color: C.ink,
                background: "#ffffff",
                boxSizing: "border-box",
                outline: "none",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => (e.target.style.borderColor = C.blue)}
              onBlur={(e) => (e.target.style.borderColor = C.line)}
            />
          </div>

          {/* Error Message */}
          {displayError && (
            <div
              style={{
                padding: "10px 14px",
                background: "#FDF2F2",
                border: "1px solid #F8B4B4",
                borderRadius: 8,
                color: "#B4442E",
                fontSize: 12.5,
                fontFamily: "'Open Sans', sans-serif",
                lineHeight: 1.4,
                display: "flex",
                alignItems: "center",
                gap: 8
              }}
            >
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span>{displayError}</span>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={busy}
            style={{
              width: "100%",
              background: GRAD,
              color: "#ffffff",
              border: "none",
              borderRadius: 9,
              padding: "13px 18px",
              fontSize: 14.5,
              fontWeight: 700,
              fontFamily: "'Open Sans', sans-serif",
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.75 : 1,
              boxShadow: "0 6px 18px rgba(0, 81, 132, 0.22)",
              transition: "all 0.2s ease",
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8
            }}
          >
            {busy ? "Authenticating…" : "Sign in to Social Studio →"}
          </button>
        </form>

        {/* Footer Note */}
        <div
          style={{
            marginTop: 20,
            textAlign: "center",
            fontFamily: "'Open Sans', sans-serif",
            fontSize: 11.5,
            color: C.inkMute,
            lineHeight: 1.5
          }}
        >
          Protected team environment. User access is managed via the authorized Kognoz member allowlist.
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

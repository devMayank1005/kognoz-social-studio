import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getSupabaseServerClient } from "@/lib/supabase";
import { recordActivityAsync } from "@/lib/activity";
import { currentRequestOrigin } from "@/lib/requestContext";
import { isAdmin } from "@/lib/adminAccess";
import { randomUUID } from "node:crypto";

// Auth: Microsoft 365 (Entra ID) Single Sign-On for @kognozconsulting.com
// with fallback to Supabase `users` table via CredentialsProvider.

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "kognoz-social-studio-secure-auth-secret-key-2026",
  session: { strategy: "jwt" },
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID || "3421373a-9203-4376-a6be-f7ce26ed85e8",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || "",
      tenantId: process.env.AZURE_AD_TENANT_ID || "2dbb05c9-b19f-4164-bc87-9a3f87e7d02e"
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();
        const password = credentials.password;
        const origin = currentRequestOrigin();

        // A rejected sign-in is recorded against the address that was TYPED, not
        // against an account — the whole point is that it may not be one. This is
        // the row that shows a password being guessed.
        const refuse = (why: string) => {
          recordActivityAsync({
            actorEmail: email,
            action: "login_failed",
            entity: "session",
            entityLabel: email,
            screen: "login",
            ip: origin?.ip,
            userAgent: origin?.userAgent,
            meta: { provider: "credentials", reason: why }
          });
          return null;
        };

        // Authenticate against the Supabase `users` table
        try {
          if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
            const supabase = getSupabaseServerClient();
            const { data: user, error } = await supabase
              .from("users")
              .select("email, name, password_hash")
              .eq("email", email)
              .maybeSingle();

            if (!error && user?.password_hash) {
              const valid = await bcrypt.compare(password, user.password_hash);
              if (valid) {
                return { id: user.email, email: user.email, name: user.name || user.email.split("@")[0] };
              }
              return refuse("wrong password");
            }
            return refuse(error ? "lookup failed" : "no such account");
          }
        } catch (e) {
          console.warn("Supabase auth lookup error:", e);
        }

        return refuse("unavailable"); // Invalid credentials
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "azure-ad") {
        const prof = profile as Record<string, any> | undefined;
        const rawEmail = (user.email || prof?.preferred_username || prof?.upn || prof?.email || "").toString();
        const email = rawEmail.toLowerCase().trim();
        if (email) {
          user.email = email;
          if (!user.name && prof?.name) {
            user.name = prof.name;
          }
        }
        // Strict domain verification: Allow only @kognozconsulting.com & @kognoz.com
        if (!email.includes("kognozconsulting.com") && !email.includes("kognoz.com")) {
          console.warn(`Blocked sign-in attempt from unauthorized domain: ${email}`);
          const origin = currentRequestOrigin();
          recordActivityAsync({
            actorEmail: email || "unknown",
            action: "login_blocked",
            entity: "session",
            entityLabel: email || "no address supplied",
            screen: "login",
            ip: origin?.ip,
            userAgent: origin?.userAgent,
            meta: { provider: "azure-ad", reason: "domain not allowed" }
          });
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;

        // `user` is only present on the initial sign-in — every later call is a
        // refresh — so this branch is the one moment a session begins. That makes it
        // the right place both to mint the id that groups this visit's actions and to
        // record the sign-in itself.
        //
        // Not `events.signIn`, which is the more obvious hook: it is handed no token,
        // so a login logged there could not carry the sid and the visit could never
        // be reassembled.
        token.sid = randomUUID();
        // Resolved here, once per sign-in, so the UI can hide a link nobody outside
        // the allowlist can follow. Both API routes re-check independently — this is
        // for discoverability, never for access.
        token.isAdmin = isAdmin(user.email);

        const origin = currentRequestOrigin();
        if (user.email) {
          recordActivityAsync({
            actorEmail: user.email,
            actorName: user.name,
            action: "login",
            entity: "session",
            screen: "login",
            ip: origin?.ip,
            userAgent: origin?.userAgent,
            sessionId: token.sid,
            meta: { provider: account?.provider || "unknown" }
          });
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        // Exposed so the browser can stamp its events with the visit they belong to.
        session.user.sid = token.sid;
        session.user.isAdmin = token.isAdmin === true;
      }
      return session;
    }
  },
  events: {
    // Fires only when someone actually clicks sign out. A session that simply expires
    // or a browser that is closed produces a login with no matching logout — the
    // timeline shows the visit ending at its last action, which is the honest reading.
    async signOut({ token }) {
      const email = typeof token?.email === "string" ? token.email : "";
      if (!email) return;
      const origin = currentRequestOrigin();
      recordActivityAsync({
        actorEmail: email,
        actorName: typeof token?.name === "string" ? token.name : null,
        action: "logout",
        entity: "session",
        screen: "login",
        ip: origin?.ip,
        userAgent: origin?.userAgent,
        sessionId: token?.sid
      });
    }
  },
  pages: {
    signIn: "/login",
    error: "/login"
  }
};

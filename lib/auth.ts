import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getSupabaseServerClient } from "@/lib/supabase";

// Auth: a single admin account via env vars for now (no Supabase needed yet),
// with the Supabase `users` table as a fallback once real teammates are
// added later. The password lives in Vercel's env vars, not in this file —
// a value once committed to git stays in history forever even if deleted
// later, so env vars are the safer place for it even for a "just for now" setup.

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase().trim();

        // 1. Single admin account via env vars (set in Vercel, not in code).
        const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (adminEmail && adminPassword && email === adminEmail && credentials.password === adminPassword) {
          return { id: adminEmail, email: adminEmail, name: "Admin" };
        }

        // 2. Supabase `users` table — for when real teammates are added later.
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
        try {
          const supabase = getSupabaseServerClient();
          const { data: user, error } = await supabase
            .from("users")
            .select("email, name, password_hash")
            .eq("email", email)
            .single();
          if (error || !user) return null; // no row = not allowed, same error either way (no email enumeration)
          const valid = await bcrypt.compare(credentials.password, user.password_hash);
          if (!valid) return null;
          return { id: user.email, email: user.email, name: user.name };
        } catch {
          return null; // Supabase not reachable/configured yet — fail closed, not a crash
        }
      }
    })
  ],
  pages: {
    signIn: "/login",
    error: "/login"
  }
};

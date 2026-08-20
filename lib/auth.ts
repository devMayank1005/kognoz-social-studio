import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getSupabaseServerClient } from "@/lib/supabase";

// Auth: Microsoft 365 (Entra ID) Single Sign-On for @kognozconsulting.com
// with fallback to Supabase `users` table via CredentialsProvider.

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID || "",
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
            }
          }
        } catch (e) {
          console.warn("Supabase auth lookup error:", e);
        }

        return null; // Invalid credentials
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
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.name = token.name as string;
        session.user.email = token.email as string;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
    error: "/login"
  }
};

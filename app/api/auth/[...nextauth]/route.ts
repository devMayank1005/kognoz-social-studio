import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

if (!process.env.NEXTAUTH_URL) {
  if (process.env.NODE_ENV === "production") {
    process.env.NEXTAUTH_URL = "https://kognoz-social-studio.vercel.app";
  } else if (process.env.RENDER_EXTERNAL_URL) {
    process.env.NEXTAUTH_URL = process.env.RENDER_EXTERNAL_URL;
  }
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next 16: `middleware.ts` → `proxy.ts`. Зөвхөн session байгаа эсэхийг шалгана;
// эрх (role, isActive)-ийг server тал хүсэлт бүрт DB-ээс дахин шалгана.
const { auth } = NextAuth(authConfig);

export const proxy = auth;

export const config = {
  matcher: ["/admin/:path*"],
};

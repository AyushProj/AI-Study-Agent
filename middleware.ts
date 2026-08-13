import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const protectedPaths = ["/dashboard", "/documents", "/flashcards", "/quizzes", "/chat", "/progress", "/settings"];

export default auth((req) => {
  const isProtected = protectedPaths.some((path) =>
    req.nextUrl.pathname.startsWith(path)
  );

  if (isProtected && !req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/documents/:path*", "/flashcards/:path*", "/quizzes/:path*", "/chat/:path*", "/progress/:path*", "/settings/:path*"],
};
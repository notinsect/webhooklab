import { NextResponse, NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { env } from "./src/lib/env";

const COOKIE_NAME = "webhooklab_session";
const SECRET_KEY = new TextEncoder().encode(env.AUTH_SECRET);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect /dashboard and all /dashboard subroutes
  if (pathname.startsWith("/dashboard")) {
    const token = req.cookies.get(COOKIE_NAME)?.value;

    let isAuthenticated = false;
    if (token) {
      try {
        const { payload } = await jwtVerify(token, SECRET_KEY);
        if (payload?.userId) {
          isAuthenticated = true;
        }
      } catch {
        isAuthenticated = false;
      }
    }

    if (!isAuthenticated) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};

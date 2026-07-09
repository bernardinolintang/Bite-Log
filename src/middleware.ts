import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/api/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token && (await verifySessionToken(token))) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  // exclude static assets and generated icons/manifest from auth
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icon|apple-icon|manifest\\.webmanifest).*)"],
};

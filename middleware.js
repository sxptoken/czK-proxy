import { NextResponse } from "next/server";

export default function middleware(request) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname === "/login.html" ||
    pathname === "/api/auth" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const authenticated = request.cookies.get("czx_auth")?.value === "1";
  if (authenticated) return NextResponse.next();

  const loginUrl = new URL("/login.html", request.url);
  const next = pathname + search;
  if (next !== "/") loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api/youtube|api/game-proxy).*)"]
};

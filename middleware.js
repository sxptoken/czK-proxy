export default function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (
    pathname === "/login.html" ||
    pathname === "/api/auth" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return;
  }

  const cookie = request.headers.get("cookie") || "";
  const authenticated = /(?:^|;\s*)czx_auth=1(?:;|$)/.test(cookie);
  if (authenticated) return;

  const loginUrl = new URL("/login.html", request.url);
  const next = pathname + url.search;
  if (next !== "/") loginUrl.searchParams.set("next", next);

  return Response.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api/youtube|api/game-proxy).*)"]
};

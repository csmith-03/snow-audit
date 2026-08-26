import type { NextRequest } from "next/server";
import { withAuth } from "@kinde-oss/kinde-auth-nextjs/middleware";

// Runs on every route below (except the exclusions in `matcher`) so that an
// expired access token gets silently refreshed from the refresh_token cookie
// before any page reads the session — otherwise pages that check auth
// outside this middleware (the root layout, the home page) see a stale
// expired token and treat the visitor as logged out, even though a valid
// refresh token is sitting right there. /upload, /report, and /api/analyze
// stay behind a hard login redirect when there's no session to refresh;
// everything else is public but still benefits from the refresh.
export default function middleware(req: NextRequest) {
  return withAuth(req, {
    publicPaths: ["/", "/checklist"],
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|logo.png|kinde-background.png|api/auth).*)",
  ],
};

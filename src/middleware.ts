import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/fixtures/:path*",
    "/matches/:path*",
    "/history/:path*",
    "/accuracy/:path*",
    "/following/:path*",
    "/admin/:path*",
    "/pricing/:path*",
    "/simulation/:path*",
    "/login",
    "/signup",
    "/api/predict",
    "/api/sync",
  ],
};

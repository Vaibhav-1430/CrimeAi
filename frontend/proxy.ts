import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// NOTE: In Next.js 16 the `middleware.ts` convention was renamed to `proxy.ts`
// (see node_modules/next/dist/docs/.../proxy.md). This file is the equivalent
// of what older Next versions called middleware.
//
// Auth gating is intentionally NOT done here: the access token is stored in
// localStorage and is invisible to the server, so a server-side redirect would
// produce false negatives. Route protection is enforced client-side by
// ProtectedRoute (components/auth/ProtectedRoute.tsx) and by the API itself.
//
// What this proxy does provide is baseline hardening headers on every HTML
// response, supporting the app's XSS-protection requirements.
export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  // Run on app routes only; skip API, static assets, and image optimization.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};

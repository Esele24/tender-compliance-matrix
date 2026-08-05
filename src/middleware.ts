/**
 * Password gate for the deployed demo.
 *
 * This app calls Gemini with a server-side API key, so a public URL means
 * anyone who finds it can spend that key. Tenders are long documents, so a
 * handful of runs by a stranger is real money. This puts the whole site behind
 * a username and password before any route — including the API routes — can be
 * reached.
 *
 * Middleware runs BEFORE the page or API route does, on every matching request.
 * That is why the gate goes here rather than inside each route: one file
 * protects everything, and there is no route to forget.
 *
 * It uses HTTP Basic Auth, which is the browser's own built-in login prompt.
 * No login page, no session, no database. Fine for a demo behind HTTPS; not
 * what you would use for real user accounts.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // .trim() matters more than it looks. Setting these from a shell pipe, a
  // pasted dashboard field, or a .env file very easily leaves a trailing
  // newline or space on the value — and then the comparison below silently
  // never matches, so the browser just re-prompts forever with no error to
  // explain why. Trim the EXPECTED values only; never trim what the user
  // typed, since a password is allowed to contain spaces.
  const expectedUser = process.env.DEMO_USER?.trim();
  const expectedPass = process.env.DEMO_PASSWORD?.trim();

  // Gate is OFF unless both are set. Local development stays frictionless —
  // you only set these in Vercel, so `npm run dev` never prompts you.
  if (!expectedUser || !expectedPass) {
    return NextResponse.next();
  }

  const header = req.headers.get("authorization");

  if (header?.startsWith("Basic ")) {
    // The browser sends "Basic " + base64("user:password").
    // atob() decodes base64 and exists in the Edge runtime middleware runs in.
    let decoded = "";
    try {
      decoded = atob(header.slice(6));
    } catch {
      decoded = ""; // malformed base64 — treat as a failed attempt
    }

    // Split on the FIRST colon only: passwords are allowed to contain colons.
    const separator = decoded.indexOf(":");
    if (separator !== -1) {
      const user = decoded.slice(0, separator);
      const pass = decoded.slice(separator + 1);

      if (user === expectedUser && pass === expectedPass) {
        return NextResponse.next(); // let the request through
      }
    }
  }

  // 401 + this header is what makes the browser show its login box.
  // Without WWW-Authenticate the user just sees a blank error page.
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Tender tool", charset="UTF-8"',
    },
  });
}

export const config = {
  /**
   * Which requests this runs on. The negative lookahead `(?!...)` skips Next's
   * own static files and the favicon — they carry no secrets, and gating them
   * makes the 401 page itself render unstyled.
   *
   * Everything else — pages AND /api/* — is covered.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

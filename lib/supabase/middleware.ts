import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { APP_AUTH_EMAIL_COOKIE, APP_SESSION_COOKIE, getAppSessionCookieOptions, isAppSessionExpired } from "@/lib/auth-session";
import { logPerf, startPerfTimer } from "@/lib/perf";

const SESSION_REFRESH_INTERVAL_MS = 60 * 1000;

export async function updateSession(request: NextRequest) {
  const perfTimer = startPerfTimer();
  const isProtectedPath =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/requests") ||
    request.nextUrl.pathname.startsWith("/inventory") ||
    request.nextUrl.pathname.startsWith("/rentals") ||
    request.nextUrl.pathname.startsWith("/reports") ||
    request.nextUrl.pathname.startsWith("/vendors") ||
    request.nextUrl.pathname.startsWith("/users");

  if (!isProtectedPath) {
    logPerf("middleware.updateSession", perfTimer, {
      path: request.nextUrl.pathname,
      protected: false
    });
    return NextResponse.next({
      request
    });
  }

  const lastSeenAt = request.cookies.get(APP_SESSION_COOKIE)?.value;
  const lastSeenTimestamp = Number(lastSeenAt);
  const hasRecentAppSession =
    Number.isFinite(lastSeenTimestamp) &&
    !isAppSessionExpired(lastSeenAt) &&
    Date.now() - lastSeenTimestamp < SESSION_REFRESH_INTERVAL_MS;

  if (hasRecentAppSession) {
    const response = NextResponse.next({
      request
    });
    response.cookies.set(APP_SESSION_COOKIE, String(Date.now()), getAppSessionCookieOptions(request.nextUrl.protocol === "https:"));
    logPerf("middleware.updateSession", perfTimer, {
      path: request.nextUrl.pathname,
      mode: "heartbeat-skip-auth"
    });
    return response;
  }

  let response = NextResponse.next({
    request
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));

          response = NextResponse.next({
            request
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user && isProtectedPath && isAppSessionExpired(lastSeenAt)) {
    const logoutUrl = new URL("/auth/logout", request.url);
    logoutUrl.searchParams.set("next", "/login?error=session_expired");
    logPerf("middleware.updateSession", perfTimer, {
      path: request.nextUrl.pathname,
      mode: "redirect-expired"
    });
    return NextResponse.redirect(logoutUrl);
  }

  if (user && isProtectedPath) {
    response.cookies.set(APP_SESSION_COOKIE, String(Date.now()), getAppSessionCookieOptions(request.nextUrl.protocol === "https:"));
    response.cookies.set(APP_AUTH_EMAIL_COOKIE, user.email?.toLowerCase() ?? "", getAppSessionCookieOptions(request.nextUrl.protocol === "https:"));
  } else if (isProtectedPath) {
    response.cookies.set(APP_AUTH_EMAIL_COOKIE, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0)
    });
  }

  logPerf("middleware.updateSession", perfTimer, {
    path: request.nextUrl.pathname,
    mode: "supabase-auth-check",
    authenticated: Boolean(user)
  });
  return response;
}

import { NextResponse } from "next/server";
import { APP_AUTH_EMAIL_COOKIE, APP_SESSION_COOKIE } from "@/lib/auth-session";
import { DEV_IMPERSONATION_COOKIE } from "@/lib/dev-impersonation";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = requestUrl.searchParams.get("next") ?? "/login";
  const safeNext = next.startsWith("/") ? next : "/login";

  const supabase = await createClient();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL(safeNext, requestUrl.origin));
  response.cookies.set(APP_SESSION_COOKIE, "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0)
  });
  response.cookies.set(APP_AUTH_EMAIL_COOKIE, "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0)
  });
  response.cookies.set(DEV_IMPERSONATION_COOKIE, "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0)
  });

  return response;
}

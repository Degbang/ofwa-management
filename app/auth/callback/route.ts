import { NextResponse } from "next/server";
import { APP_AUTH_EMAIL_COOKIE, APP_SESSION_COOKIE, getAppSessionCookieOptions } from "@/lib/auth-session";
import { ensureConfiguredAppUserByEmail, getApprovedAppUserByEmail } from "@/lib/auth-user";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", requestUrl.origin));
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(new URL("/login?error=oauth_exchange_failed", requestUrl.origin));
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=missing_email", requestUrl.origin));
  }

  await ensureConfiguredAppUserByEmail(user.email);
  const approvedUser = await getApprovedAppUserByEmail(user.email);
  if (!approvedUser) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=unauthorized_email", requestUrl.origin));
  }

  const response = NextResponse.redirect(new URL(safeNext, requestUrl.origin));
  response.cookies.set(APP_SESSION_COOKIE, String(Date.now()), getAppSessionCookieOptions(requestUrl.protocol === "https:"));
  response.cookies.set(APP_AUTH_EMAIL_COOKIE, user.email.toLowerCase(), getAppSessionCookieOptions(requestUrl.protocol === "https:"));

  return response;
}

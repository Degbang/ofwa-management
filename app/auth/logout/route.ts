import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [{ APP_AUTH_EMAIL_COOKIE, APP_SESSION_COOKIE }, { DEV_IMPERSONATION_COOKIE }, { createClient }] = await Promise.all([
    import("@/lib/auth-session"),
    import("@/lib/dev-impersonation"),
    import("@/lib/supabase/server")
  ]);
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

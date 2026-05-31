export const APP_SESSION_COOKIE = "ofwa_app_session_last_seen_at";
export const APP_AUTH_EMAIL_COOKIE = "ofwa_app_auth_email";
export const APP_SESSION_MAX_AGE_SECONDS = 60 * 60;

export function getAppSessionCookieOptions(isSecure: boolean) {
  return {
    path: "/",
    maxAge: APP_SESSION_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecure
  };
}

export function getAppSessionExpiresAt(lastSeenAt: string | undefined | null) {
  const lastSeenAtMs = Number(lastSeenAt);
  if (!Number.isFinite(lastSeenAtMs)) {
    return null;
  }

  return lastSeenAtMs + APP_SESSION_MAX_AGE_SECONDS * 1000;
}

export function isAppSessionExpired(lastSeenAt: string | undefined | null) {
  const expiresAt = getAppSessionExpiresAt(lastSeenAt);
  if (!expiresAt) {
    return true;
  }

  return Date.now() > expiresAt;
}

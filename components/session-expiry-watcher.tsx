"use client";

import { useEffect } from "react";

type SessionExpiryWatcherProps = {
  expiresAt: number;
};

export function SessionExpiryWatcher({ expiresAt }: SessionExpiryWatcherProps) {
  useEffect(() => {
    const redirectToLogout = () => {
      window.location.href = `/auth/logout?next=${encodeURIComponent("/login?error=session_expired")}`;
    };

    const scheduleExpiryCheck = () => {
      const remainingMs = expiresAt - Date.now();
      if (remainingMs <= 0) {
        redirectToLogout();
        return null;
      }

      return window.setTimeout(redirectToLogout, remainingMs);
    };

    let timeout = scheduleExpiryCheck();

    const onFocus = () => {
      if (timeout) {
        window.clearTimeout(timeout);
      }

      timeout = scheduleExpiryCheck();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      if (timeout) {
        window.clearTimeout(timeout);
      }

      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [expiresAt]);

  return null;
}

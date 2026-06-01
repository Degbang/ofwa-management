import { Role } from "@prisma/client";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { APP_AUTH_EMAIL_COOKIE, APP_SESSION_COOKIE, getAppSessionExpiresAt, isAppSessionExpired } from "@/lib/auth-session";
import { getApprovedAppUserByEmail, listApprovedAppUsers, type AppSessionUser } from "@/lib/auth-user";
import { DEV_IMPERSONATION_COOKIE, canUseDevImpersonation } from "@/lib/dev-impersonation";
import { logPerf, startPerfTimer } from "@/lib/perf";
import { canAccessPage, hasRole } from "@/lib/permissions";

const getAuthenticatedAppUser = cache(async () => {
  const perfTimer = startPerfTimer();
  const cookieStore = await cookies();
  const lastSeenAt = cookieStore.get(APP_SESSION_COOKIE)?.value;
  if (isAppSessionExpired(lastSeenAt)) {
    logPerf("session.getAuthenticatedAppUser", perfTimer, {
      reason: "app-session-expired"
    });
    return null;
  }

  const authenticatedEmail = cookieStore.get(APP_AUTH_EMAIL_COOKIE)?.value?.trim().toLowerCase();
  if (!authenticatedEmail) {
    logPerf("session.getAuthenticatedAppUser", perfTimer, {
      reason: "missing-auth-user"
    });
    return null;
  }

  const approvedUser = await getApprovedAppUserByEmail(authenticatedEmail);
  logPerf("session.getAuthenticatedAppUser", perfTimer, {
    signedInEmail: authenticatedEmail,
    source: "app-auth-cookie",
    approved: Boolean(approvedUser)
  });
  return approvedUser;
});

const getResolvedSessionUsers = cache(async () => {
  const perfTimer = startPerfTimer();
  const signedInUser = await getAuthenticatedAppUser();
  if (!signedInUser) {
    logPerf("session.getResolvedSessionUsers", perfTimer, {
      reason: "no-signed-in-user"
    });
    return null;
  }

  if (!canUseDevImpersonation(signedInUser.email)) {
    logPerf("session.getResolvedSessionUsers", perfTimer, {
      user: signedInUser.email,
      impersonating: false
    });
    return {
      user: signedInUser,
      signedInUser,
      isImpersonating: false
    };
  }

  const cookieStore = await cookies();
  const impersonatedEmail = cookieStore.get(DEV_IMPERSONATION_COOKIE)?.value?.toLowerCase();
  if (!impersonatedEmail || impersonatedEmail === signedInUser.email) {
    logPerf("session.getResolvedSessionUsers", perfTimer, {
      user: signedInUser.email,
      impersonating: false
    });
    return {
      user: signedInUser,
      signedInUser,
      isImpersonating: false
    };
  }

  const impersonatedUser = await getApprovedAppUserByEmail(impersonatedEmail);
  if (!impersonatedUser) {
    logPerf("session.getResolvedSessionUsers", perfTimer, {
      user: signedInUser.email,
      impersonating: false,
      reason: "invalid-impersonation-user"
    });
    return {
      user: signedInUser,
      signedInUser,
      isImpersonating: false
    };
  }

  logPerf("session.getResolvedSessionUsers", perfTimer, {
    user: impersonatedUser.email,
    signedInUser: signedInUser.email,
    impersonating: true
  });
  return {
    user: impersonatedUser,
    signedInUser,
    isImpersonating: true
  };
});

export async function getCurrentSessionUser() {
  const session = await getResolvedSessionUsers();
  return session?.user ?? null;
}

export const requireSession = cache(async () => {
  const perfTimer = startPerfTimer();
  const cookieStore = await cookies();
  const lastSeenAt = cookieStore.get(APP_SESSION_COOKIE)?.value;
  const session = await getResolvedSessionUsers();
  if (!session) {
    logPerf("session.requireSession", perfTimer, {
      reason: "missing-session"
    });
    redirect("/login?error=session_expired");
  }

  const expiresAt = getAppSessionExpiresAt(lastSeenAt);
  if (!expiresAt) {
    logPerf("session.requireSession", perfTimer, {
      reason: "missing-expiry"
    });
    redirect("/login?error=session_expired");
  }

  const impersonationOptions = canUseDevImpersonation(session.signedInUser.email) ? await listApprovedAppUsers() : [];
  logPerf("session.requireSession", perfTimer, {
    user: session.user.email,
    impersonating: session.isImpersonating,
    impersonationOptions: impersonationOptions.length
  });

  return {
    user: session.user,
    signedInUser: session.signedInUser,
    isImpersonating: session.isImpersonating,
    expiresAt,
    impersonationOptions
  };
});

export async function requireRoles(roles: Role[]) {
  const session = await requireSession();
  if (!hasRole(session.user.roles, roles)) {
    redirect("/dashboard");
  }

  return session;
}

export async function requirePageRoles(roles: Role[]) {
  const session = await requireSession();
  if (!canAccessPage(session.user.email, session.user.roles, roles)) {
    redirect("/dashboard");
  }

  return session;
}

export async function requireApiSession(): Promise<AppSessionUser | null> {
  return getCurrentSessionUser();
}

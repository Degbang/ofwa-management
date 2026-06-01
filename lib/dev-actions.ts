"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureConfiguredAppUserByEmail, getApprovedAppUserByEmail } from "@/lib/auth-user";
import { DEV_IMPERSONATION_COOKIE, canUseDevImpersonation } from "@/lib/dev-impersonation";
import { requireSession } from "@/lib/session";

export async function setDevImpersonationAction(formData: FormData) {
  const session = await requireSession();

  const next = String(formData.get("next") ?? "/dashboard");
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  if (!canUseDevImpersonation(session.signedInUser.email)) {
    redirect(safeNext);
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const cookieStore = await cookies();

  if (!email) {
    cookieStore.delete(DEV_IMPERSONATION_COOKIE);
    redirect(safeNext);
  }

  await ensureConfiguredAppUserByEmail(email);
  const user = await getApprovedAppUserByEmail(email);
  if (!user) {
    throw new Error("Invalid impersonation user.");
  }

  cookieStore.set(DEV_IMPERSONATION_COOKIE, email, {
    path: "/",
    httpOnly: true,
    sameSite: "lax"
  });

  redirect(safeNext);
}

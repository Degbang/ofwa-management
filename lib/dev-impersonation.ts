export const DEV_IMPERSONATION_COOKIE = "ofwa_dev_impersonation_email";

export function canUseDevImpersonation(email?: string | null) {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const configured = process.env.ALFRED_EMAIL?.trim().toLowerCase();
  return Boolean(configured && email?.trim().toLowerCase() === configured);
}

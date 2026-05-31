export const DEV_IMPERSONATION_COOKIE = "ofwa_dev_impersonation_email";

export function canUseDevImpersonation() {
  return process.env.NODE_ENV !== "production";
}

import Image from "next/image";
import { redirect } from "next/navigation";
import { GoogleSignInButton } from "@/components/auth-buttons";
import { getCurrentSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams?: { error?: string } }) {
  const user = await getCurrentSessionUser();
  if (user) {
    redirect("/dashboard");
  }

  const errorMessage =
    searchParams?.error === "unauthorized_email"
      ? "This Google account is not approved for OFWA Operations."
      : searchParams?.error === "session_expired"
        ? "Your session expired. Sign in again to continue."
      : searchParams?.error
        ? "Sign-in could not be completed. Check the OAuth setup and try again."
        : null;

  return (
    <div className="login-page">
      <div className="login-card stack">
        <div className="login-hero">
          <div className="login-brand">
            <Image alt="OFWA logo" className="brand-logo brand-logo-login" height={156} priority src="/ofwa-logo.png" width={156} />
            <div className="login-copy">
              <p className="eyebrow">OFWA</p>
              <h1>Operations Management</h1>
              <p className="muted">Internal requests, approvals, inventory tracking, and equipment rentals.</p>
            </div>
          </div>
        </div>

        {errorMessage ? <div className="empty-state">{errorMessage}</div> : null}

        <div className="login-actions">
          <GoogleSignInButton />
        </div>
      </div>
    </div>
  );
}

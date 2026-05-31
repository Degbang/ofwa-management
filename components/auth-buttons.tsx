"use client";

import { createClient } from "@/lib/supabase/client";

export function GoogleSignInButton() {
  return (
    <button
      className="button button-primary"
      onClick={async () => {
        const supabase = createClient();
        const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`;

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo
          }
        });

        if (error) {
          window.location.href = "/login?error=oauth_start_failed";
          return;
        }

        if (data.url) {
          window.location.href = data.url;
        }
      }}
      type="button"
    >
      Sign in with Google
    </button>
  );
}

export function SignOutButton() {
  return (
    <button
      className="button button-secondary sidebar-signout-button"
      onClick={async () => {
        window.location.href = "/auth/logout?next=/login";
      }}
      type="button"
    >
      Sign out
    </button>
  );
}

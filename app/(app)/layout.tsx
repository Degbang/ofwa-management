import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <AppShell
      impersonationOptions={session.impersonationOptions}
      isImpersonating={session.isImpersonating}
      sessionExpiresAt={session.expiresAt}
      signedInUser={session.signedInUser}
      user={session.user}
    >
      {children}
    </AppShell>
  );
}

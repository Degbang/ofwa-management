import Link from "next/link";
import { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/constants";
import { setDevImpersonationAction } from "@/lib/dev-actions";
import { SessionExpiryWatcher } from "@/components/session-expiry-watcher";
import {
  canAccessInventoryModule,
  canAccessReportsModule,
  canAccessRentalsModule,
  canAccessUsersModule,
  canAccessVendorsModule
} from "@/lib/permissions";
import { SignOutButton } from "@/components/auth-buttons";
import { NavLink } from "@/components/nav-link";

type AppShellProps = {
  children: React.ReactNode;
  user: {
    name?: string | null;
    email: string;
    roles: Role[];
  };
  signedInUser: {
    name?: string | null;
    email: string;
    roles: Role[];
  };
  impersonationOptions: Array<{
    email: string;
    name: string | null;
    roles: Role[];
  }>;
  isImpersonating: boolean;
  sessionExpiresAt: number;
};

export function AppShell({ children, impersonationOptions, isImpersonating, sessionExpiresAt, signedInUser, user }: AppShellProps) {
  const initialsSource = user.name ?? user.email;
  const initials = initialsSource
    .split(/[ @.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const primaryRole = user.roles[0] ? ROLE_LABELS[user.roles[0]] : "Staff";
  const requestLinks = [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/requests", label: "Requests", icon: "pending_actions" }
  ];
  const adminLinks = [
    canAccessUsersModule(user.email, user.roles) ? { href: "/users", label: "Users", icon: "group" } : null,
    canAccessInventoryModule(user.email, user.roles) ? { href: "/inventory", label: "Inventory", icon: "inventory_2" } : null,
    canAccessVendorsModule(user.email, user.roles) ? { href: "/vendors", label: "Vendors", icon: "handshake" } : null,
    canAccessReportsModule(user.email, user.roles) ? { href: "/reports", label: "Damage Reports", icon: "report_problem" } : null,
    canAccessRentalsModule(user.email, user.roles) ? { href: "/rentals", label: "Rentals", icon: "key" } : null
  ].filter(Boolean) as Array<{ href: string; label: string; icon: string }>;

  return (
    <div className="app-shell">
      <SessionExpiryWatcher expiresAt={sessionExpiresAt} />
      <aside className="sidebar">
        <div className="sidebar-top stack">
          <div className="brand-block">
            <div className="brand-lockup sidebar-brand-lockup">
              <div className="brand-copy">
                <h1>OFWA Portal</h1>
                <p className="brand-caption">Operations Command</p>
              </div>
            </div>
          </div>

          <div className="user-panel">
            <p className="user-name">{user.name ?? user.email}</p>
            <p className="user-meta">{user.email}</p>
            <p className="user-meta">{user.roles.map((role) => ROLE_LABELS[role]).join(", ")}</p>
            {isImpersonating ? <p className="user-meta user-meta-accent">Signed in as {signedInUser.email}</p> : null}
          </div>
        </div>

        <nav className="nav">
          <div className="nav-section">
            <p className="nav-section-label">Workspace</p>
            <div className="nav-links">
              {requestLinks.map((link) => (
                <NavLink href={link.href} icon={link.icon} key={link.href} label={link.label} />
              ))}
            </div>
          </div>

          {adminLinks.length > 0 ? (
            <div className="nav-section">
              <p className="nav-section-label">Operations</p>
              <div className="nav-links">
                {adminLinks.map((link) => (
                  <NavLink href={link.href} icon={link.icon} key={link.href} label={link.label} />
                ))}
              </div>
            </div>
          ) : null}
        </nav>

        <div className="sidebar-footer stack">
          <Link className="button button-primary sidebar-primary-action" href="/requests/new">
            New request
          </Link>
          {impersonationOptions.length > 0 ? (
            <div className="dev-panel">
              <p className="eyebrow">Developer View</p>
              <p className="dev-note">Switch screen access locally without changing Google accounts.</p>
              <form action={setDevImpersonationAction} className="dev-form">
                <input name="next" type="hidden" value="/dashboard" />
                <label className="dev-form-field">
                  View as
                  <select defaultValue={isImpersonating ? user.email : ""} name="email">
                    <option value="">Actual signed-in user</option>
                    {impersonationOptions.map((option) => (
                      <option key={option.email} value={option.email}>
                        {(option.name ?? option.email).trim()} · {option.roles.map((role) => ROLE_LABELS[role]).join(", ")}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button button-secondary dev-apply-button" type="submit">
                  Apply view
                </button>
              </form>
            </div>
          ) : null}
          <SignOutButton />
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-search">
            <span aria-hidden="true" className="material-symbols-outlined">
              search
            </span>
            <input aria-label="Search operations" placeholder="Search operations, assets, or reports..." type="search" />
          </div>
          <div className="topbar-actions">
            <button aria-label="Notifications" className="topbar-icon-button" type="button">
              <span aria-hidden="true" className="material-symbols-outlined">
                notifications
              </span>
              <span className="topbar-alert-dot" />
            </button>
            <button aria-label="Settings" className="topbar-icon-button" type="button">
              <span aria-hidden="true" className="material-symbols-outlined">
                settings
              </span>
            </button>
            <div className="topbar-divider" />
            <div className="topbar-user">
              <div>
                <strong>{user.name ?? user.email}</strong>
                <p>{primaryRole}</p>
              </div>
              <div aria-hidden="true" className="topbar-avatar">
                {initials || "O"}
              </div>
            </div>
          </div>
        </header>
        <div className="content-frame">{children}</div>
      </main>
    </div>
  );
}

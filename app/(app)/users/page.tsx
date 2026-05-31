import { Role } from "@prisma/client";
import Link from "next/link";
import { upsertUserAction } from "@/lib/actions";
import { ROLE_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { requirePageRoles } from "@/lib/session";

const assignableRoles = [Role.STAFF, Role.BRIAN, Role.JAEL, Role.DICKSON, Role.EDMOND] as const;
const PAGE_SIZE = 6;

function getInitials(name: string | null, email: string) {
  const source = name?.trim() || email;
  return (
    source
      .split(/[ @.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

type UsersPageProps = {
  searchParams?: {
    page?: string;
    status?: string;
  };
};

function parsePage(value?: string) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function usersHref(statusFilter: string, page: number) {
  const query = new URLSearchParams();
  if (statusFilter !== "all") query.set("status", statusFilter);
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return suffix ? `/users?${suffix}` : "/users";
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  await requirePageRoles([Role.BRIAN, Role.JAEL]);
  const statusFilter = searchParams?.status === "active" || searchParams?.status === "inactive" ? searchParams.status : "all";
  const page = parsePage(searchParams?.page);
  const skip = (page - 1) * PAGE_SIZE;
  const where =
    statusFilter === "active"
      ? { isActive: true }
      : statusFilter === "inactive"
        ? { isActive: false }
        : undefined;

  const [users, totalUsers, activeCount] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        roleAssignments: true
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }, { email: "asc" }],
      skip,
      take: PAGE_SIZE
    }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { isActive: true } })
  ]);

  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const startUser = totalUsers === 0 ? 0 : skip + 1;
  const endUser = Math.min(skip + users.length, totalUsers);

  return (
    <div className="page users-page">
      <div className="users-page-header">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>User Management</h1>
        </div>
        <div className="users-page-actions">
          <button className="button button-secondary" type="button">
            Export CSV
          </button>
          <button className="button button-primary users-icon-button" type="button">
            <span aria-hidden="true" className="material-symbols-outlined">
              person_add
            </span>
            Bulk Import
          </button>
        </div>
      </div>

      <div className="users-admin-grid">
        <section className="users-add-card">
          <div className="users-card-heading">
            <h2>Add New User</h2>
            <p>Register a new personnel to the portal.</p>
          </div>

          <form action={upsertUserAction} className="users-form">
            <label>
              <span>Full name</span>
              <input name="name" placeholder="e.g. John Doe" />
            </label>
            <label>
              <span>Email address</span>
              <input name="email" placeholder="john.doe@ofwafrica.org" required type="email" />
            </label>
            <label>
              <span>Account status</span>
              <select defaultValue="true" name="isActive">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>

            <div className="users-role-section">
              <span>Assign roles</span>
              <div className="users-role-grid">
                {assignableRoles.map((role) => (
                  <label className="users-role-choice" key={role}>
                    <input defaultChecked={role === Role.STAFF} name="roles" type="checkbox" value={role} />
                    <span>{ROLE_LABELS[role]}</span>
                  </label>
                ))}
              </div>
            </div>

            <button className="button button-primary users-submit-button" type="submit">
              Create User Account
            </button>
          </form>
        </section>

        <section className="users-table-card">
          <div className="users-table-head">
            <div>
              <h2>Current Users</h2>
              <p>Managing {activeCount} active personnel in the system.</p>
            </div>
            <div className="users-filter-tabs">
              <Link className={statusFilter === "all" ? "is-active" : ""} href="/users">
                All Users
              </Link>
              <Link className={statusFilter === "active" ? "is-active" : ""} href="/users?status=active">
                Active
              </Link>
              <Link className={statusFilter === "inactive" ? "is-active" : ""} href="/users?status=inactive">
                Inactive
              </Link>
            </div>
          </div>

          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Roles</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const roles = user.roleAssignments.map((assignment) => assignment.role);

                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="users-person-cell">
                          <span className="users-avatar">{getInitials(user.name, user.email)}</span>
                          <strong>{user.name || user.email.split("@")[0]}</strong>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`users-status-pill${user.isActive ? " is-active" : " is-inactive"}`}>
                          <span />
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="users-role-pills">
                          {roles.map((role) => (
                            <span key={`${user.id}-${role}`}>{ROLE_LABELS[role]}</span>
                          ))}
                        </div>
                      </td>
                      <td className="users-action-cell">
                        <details className="users-edit-details">
                          <summary aria-label={`Edit ${user.email}`}>
                            <span aria-hidden="true" className="material-symbols-outlined">
                              edit_square
                            </span>
                          </summary>
                          <form action={upsertUserAction} className="users-inline-edit">
                            <input name="userId" type="hidden" value={user.id} />
                            <label>
                              Name
                              <input defaultValue={user.name ?? ""} name="name" />
                            </label>
                            <label>
                              Email
                              <input defaultValue={user.email} name="email" required type="email" />
                            </label>
                            <label>
                              Status
                              <select defaultValue={String(user.isActive)} name="isActive">
                                <option value="true">Active</option>
                                <option value="false">Inactive</option>
                              </select>
                            </label>
                            <div className="users-role-grid">
                              {assignableRoles.map((role) => (
                                <label className="users-role-choice" key={`${user.id}-${role}`}>
                                  <input defaultChecked={roles.includes(role)} name="roles" type="checkbox" value={role} />
                                  <span>{ROLE_LABELS[role]}</span>
                                </label>
                              ))}
                            </div>
                            <button className="button button-primary" type="submit">
                              Save changes
                            </button>
                          </form>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="users-table-footer">
            <span>
              Showing {startUser}-{endUser} of {totalUsers} members
            </span>
            <div>
              <Link aria-disabled={page <= 1} className={page <= 1 ? "is-disabled" : ""} href={usersHref(statusFilter, Math.max(1, page - 1))}>
                <span aria-hidden="true" className="material-symbols-outlined">
                  chevron_left
                </span>
              </Link>
              <Link
                aria-disabled={page >= totalPages}
                className={page >= totalPages ? "is-disabled" : ""}
                href={usersHref(statusFilter, Math.min(totalPages, page + 1))}
              >
                <span aria-hidden="true" className="material-symbols-outlined">
                  chevron_right
                </span>
              </Link>
            </div>
          </div>
        </section>
      </div>

    </div>
  );
}

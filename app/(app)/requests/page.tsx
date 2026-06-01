import Link from "next/link";
import { PaymentStatus, RequestStatus, Role } from "@prisma/client";
import { StatusBadge } from "@/components/status-badge";
import { REQUEST_TYPE_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { hasRole, isDeveloperViewerEmail } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

const PAGE_SIZE = 6;

function toneForStatus(status: string) {
  if (["APPROVED", "PAID", "CLOSED", "RETURNED"].includes(status)) {
    return "success" as const;
  }

  if (["REJECTED", "MISSING", "RETURNED_DAMAGED"].includes(status)) {
    return "danger" as const;
  }

  if (["SUBMITTED", "UNDER_REVIEW", "FORWARDED", "PENDING", "NOT_RETURNED"].includes(status)) {
    return "warning" as const;
  }

  return "neutral" as const;
}

type RequestsPageProps = {
  searchParams?: {
    actionsPage?: string;
    minePage?: string;
  };
};

function parsePage(value?: string) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function requestsHref(params: RequestsPageProps["searchParams"], key: "minePage" | "actionsPage", page: number) {
  const query = new URLSearchParams();
  if (params?.minePage && key !== "minePage") query.set("minePage", params.minePage);
  if (params?.actionsPage && key !== "actionsPage") query.set("actionsPage", params.actionsPage);
  if (page > 1) query.set(key, String(page));
  const suffix = query.toString();
  return suffix ? `/requests?${suffix}` : "/requests";
}

export default async function RequestsPage({ searchParams }: RequestsPageProps) {
  const session = await requireSession();
  const isBrian = hasRole(session.user.roles, [Role.BRIAN]);
  const isDickson = hasRole(session.user.roles, [Role.DICKSON]);
  const isJael = hasRole(session.user.roles, [Role.JAEL]);
  const isDeveloperViewer = isDeveloperViewerEmail(session.user.email);
  const minePage = parsePage(searchParams?.minePage);
  const actionsPage = parsePage(searchParams?.actionsPage);
  const mineSkip = (minePage - 1) * PAGE_SIZE;
  const actionsSkip = (actionsPage - 1) * PAGE_SIZE;
  const myRequestsWhere = {
    requesterId: session.user.id
  };
  const actionableWhere = isDeveloperViewer
    ? {
        OR: [
          {
            currentApproverId: {
              not: null
            }
          },
          {
            status: RequestStatus.APPROVED,
            paymentStatus: PaymentStatus.PENDING
          }
        ]
      }
    : {
        OR: [
          {
            currentApproverId: session.user.id
          },
          ...(isBrian
            ? [
                {
                  currentApprover: {
                    roleAssignments: {
                      some: {
                        role: Role.BRIAN
                      }
                    }
                  }
                }
              ]
            : []),
          ...(isDickson
            ? [
                {
                  currentApprover: {
                    roleAssignments: {
                      some: {
                        role: Role.DICKSON
                      }
                    }
                  }
                }
              ]
            : []),
          ...(isJael
            ? [
                {
                  currentApprover: {
                    roleAssignments: {
                      some: {
                        role: Role.JAEL
                      }
                    }
                  }
                }
              ]
            : []),
          ...(isBrian
            ? [
                {
                  status: RequestStatus.APPROVED,
                  paymentStatus: PaymentStatus.PENDING
                }
              ]
            : [])
        ]
      };

  const [myRequests, actionableRequests, myRequestsTotal, actionableRequestsTotal] = await Promise.all([
    prisma.request.findMany({
      where: myRequestsWhere,
      select: {
        id: true,
        type: true,
        status: true,
        amount: true,
        paymentStatus: true,
        updatedAt: true,
        rejectionReason: true,
        currentApprover: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      skip: mineSkip,
      take: PAGE_SIZE
    }),
    prisma.request.findMany({
      where: actionableWhere,
      select: {
        id: true,
        type: true,
        status: true,
        amount: true,
        submittedAt: true,
        externalName: true,
        externalEmail: true,
        requester: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      },
      skip: actionsSkip,
      take: PAGE_SIZE
    }),
    prisma.request.count({ where: myRequestsWhere }),
    prisma.request.count({ where: actionableWhere })
  ]);
  const myRequestsTotalPages = Math.max(1, Math.ceil(myRequestsTotal / PAGE_SIZE));
  const actionableTotalPages = Math.max(1, Math.ceil(actionableRequestsTotal / PAGE_SIZE));
  const myRequestsStart = myRequestsTotal === 0 ? 0 : mineSkip + 1;
  const myRequestsEnd = Math.min(mineSkip + myRequests.length, myRequestsTotal);
  const actionableStart = actionableRequestsTotal === 0 ? 0 : actionsSkip + 1;
  const actionableEnd = Math.min(actionsSkip + actionableRequests.length, actionableRequestsTotal);

  return (
    <div className="page">
      <section className="table-card">
        <div className="section-header">
          <div>
            <h2>My requests</h2>
          </div>
          <Link className="button button-primary" href="/requests/new">
            New request
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Current approver</th>
                <th>Payment</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {myRequests.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">No requests submitted yet.</div>
                  </td>
                </tr>
              ) : (
                myRequests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <Link href={`/requests/${request.id}`}>{REQUEST_TYPE_LABELS[request.type]}</Link>
                    </td>
                    <td>
                      <StatusBadge tone={toneForStatus(request.status)}>{request.status.replaceAll("_", " ")}</StatusBadge>
                      {request.rejectionReason ? <p className="muted">Reason: {request.rejectionReason}</p> : null}
                    </td>
                    <td>{formatCurrency(request.amount?.toString())}</td>
                    <td>{request.currentApprover?.name ?? request.currentApprover?.email ?? "-"}</td>
                    <td>{request.paymentStatus.replaceAll("_", " ")}</td>
                    <td>{formatDateTime(request.updatedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <p>
            Showing {myRequestsStart}-{myRequestsEnd} of {myRequestsTotal}
          </p>
          <div>
            <Link
              aria-disabled={minePage <= 1}
              className={minePage <= 1 ? "is-disabled" : ""}
              href={requestsHref(searchParams, "minePage", Math.max(1, minePage - 1))}
            >
              <span aria-hidden="true" className="material-symbols-outlined">
                chevron_left
              </span>
            </Link>
            <span>{minePage}</span>
            <Link
              aria-disabled={minePage >= myRequestsTotalPages}
              className={minePage >= myRequestsTotalPages ? "is-disabled" : ""}
              href={requestsHref(searchParams, "minePage", Math.min(myRequestsTotalPages, minePage + 1))}
            >
              <span aria-hidden="true" className="material-symbols-outlined">
                chevron_right
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="table-card">
        <div className="section-header">
          <div>
            <h2>{isDeveloperViewer ? "Requests in workflow" : "Requests waiting for your action"}</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Requester</th>
                <th>Type</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {actionableRequests.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">No approval or payment actions pending.</div>
                  </td>
                </tr>
              ) : (
                actionableRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.requester?.name ?? request.externalName ?? request.requester?.email ?? request.externalEmail ?? "-"}</td>
                    <td>
                      <Link href={`/requests/${request.id}`}>{REQUEST_TYPE_LABELS[request.type]}</Link>
                    </td>
                    <td>
                      <StatusBadge tone={toneForStatus(request.status)}>{request.status.replaceAll("_", " ")}</StatusBadge>
                    </td>
                    <td>{formatCurrency(request.amount?.toString())}</td>
                    <td>{formatDate(request.submittedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <p>
            Showing {actionableStart}-{actionableEnd} of {actionableRequestsTotal}
          </p>
          <div>
            <Link
              aria-disabled={actionsPage <= 1}
              className={actionsPage <= 1 ? "is-disabled" : ""}
              href={requestsHref(searchParams, "actionsPage", Math.max(1, actionsPage - 1))}
            >
              <span aria-hidden="true" className="material-symbols-outlined">
                chevron_left
              </span>
            </Link>
            <span>{actionsPage}</span>
            <Link
              aria-disabled={actionsPage >= actionableTotalPages}
              className={actionsPage >= actionableTotalPages ? "is-disabled" : ""}
              href={requestsHref(searchParams, "actionsPage", Math.min(actionableTotalPages, actionsPage + 1))}
            >
              <span aria-hidden="true" className="material-symbols-outlined">
                chevron_right
              </span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

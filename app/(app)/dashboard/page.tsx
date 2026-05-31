import Link from "next/link";
import { RequestStatus, Role, ReturnStatus } from "@prisma/client";
import { StatusBadge } from "@/components/status-badge";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { canAccessInventoryModule, canAccessReportsModule, canAccessRentalsModule, isDeveloperViewerEmail } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

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

export default async function DashboardPage() {
  const session = await requireSession();
  const isDeveloperViewer = isDeveloperViewerEmail(session.user.email);
  const isBrian = isDeveloperViewer || session.user.roles.includes(Role.BRIAN);
  const canViewInventory = canAccessInventoryModule(session.user.email, session.user.roles);
  const canViewReports = canAccessReportsModule(session.user.email, session.user.roles);
  const canViewRentals = canAccessRentalsModule(session.user.email, session.user.roles);
  const pendingStatuses: RequestStatus[] = [RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW, RequestStatus.FORWARDED];
  const approvedStatuses: RequestStatus[] = [RequestStatus.APPROVED, RequestStatus.PAID];

  const requestStatuses = await prisma.request.findMany({
    where: {
      requesterId: session.user.id
    },
    select: {
      status: true
    }
  });

  const inventoryItems = canViewInventory
    ? await prisma.inventoryItem.findMany({
        where: {
          quantityInStock: {
            lte: 5
          }
        },
        select: {
          id: true,
          name: true,
          quantityInStock: true,
          minimumStockThreshold: true
        },
        orderBy: {
          quantityInStock: "asc"
        },
        take: 6
      })
    : [];

  const damageReports = canViewReports
    ? await prisma.damageReport.findMany({
        where: isBrian
          ? undefined
          : {
              reportedById: session.user.id
            },
        select: {
          id: true,
          itemName: true,
          reportType: true,
          dateReported: true,
          item: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 6
      })
    : [];

  const rentals = canViewRentals
    ? await prisma.rental.findMany({
        where: isBrian
          ? {
              OR: [
                { returnStatus: ReturnStatus.NOT_RETURNED },
                {
                  expectedReturnDate: {
                    lt: new Date()
                  }
                }
              ]
            }
          : {
              createdById: session.user.id,
              OR: [
                { returnStatus: ReturnStatus.NOT_RETURNED },
                {
                  expectedReturnDate: {
                    lt: new Date()
                  }
                }
              ]
            },
        select: {
          id: true,
          rentalId: true,
          renterName: true,
          expectedReturnDate: true,
          returnStatus: true,
          item: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          expectedReturnDate: "asc"
        },
        take: 6
      })
    : [];

  const stats = {
    total: requestStatuses.length,
    pending: requestStatuses.filter((request) => pendingStatuses.includes(request.status)).length,
    approved: requestStatuses.filter((request) => approvedStatuses.includes(request.status)).length,
    rejected: requestStatuses.filter((request) => request.status === RequestStatus.REJECTED).length
  };

  const lowStockItems = inventoryItems.filter((item) => item.quantityInStock <= item.minimumStockThreshold);
  return (
    <div className="page dashboard-page">
      <section className="dashboard-page-header">
        <div className="dashboard-page-header-row">
          <div className="dashboard-overview-copy">
            <p className="eyebrow">Operations overview</p>
            <h1>Request workspace</h1>
          </div>
          <div className="dashboard-overview-actions">
            <Link className="button button-secondary" href="/requests">
              Open requests
            </Link>
            <Link className="button button-primary" href="/requests/new">
              New request
            </Link>
          </div>
        </div>
      </section>

      <section className="dashboard-metrics-grid">
        <div className="dashboard-kpi-grid">
          <article className="dashboard-kpi-card">
            <span aria-hidden="true" className="material-symbols-outlined dashboard-kpi-mark">
              analytics
            </span>
            <span>Total requests</span>
            <strong>{stats.total}</strong>
            <p className="dashboard-kpi-note">
              <span aria-hidden="true" className="material-symbols-outlined">
                trending_up
              </span>
              Current workspace volume
            </p>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card-warm">
            <span aria-hidden="true" className="material-symbols-outlined dashboard-kpi-mark">
              timer
            </span>
            <span>Pending</span>
            <strong>{stats.pending}</strong>
            <p className="dashboard-kpi-note">
              <span className="dashboard-pulse-dot" />
              Requiring review
            </p>
          </article>
          <article className="dashboard-kpi-card">
            <span aria-hidden="true" className="material-symbols-outlined dashboard-kpi-mark">
              check_circle
            </span>
            <span>Approved / Paid</span>
            <strong>{stats.approved}</strong>
            <p className="dashboard-kpi-note">
              <span aria-hidden="true" className="material-symbols-outlined">
                verified
              </span>
              Completed approvals
            </p>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card-danger">
            <span aria-hidden="true" className="material-symbols-outlined dashboard-kpi-mark">
              cancel
            </span>
            <span>Rejected</span>
            <strong>{stats.rejected}</strong>
            <p className="dashboard-kpi-note">
              <span aria-hidden="true" className="material-symbols-outlined">
                info
              </span>
              Closed by rejection
            </p>
          </article>
        </div>
      </section>

      {(canViewInventory || canViewReports || canViewRentals) && (
        <>
          <section className="dashboard-ops-grid">
            {canViewInventory ? (
            <article className="table-card dashboard-summary-card">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Inventory</p>
                  <h2>Low stock</h2>
                </div>
                <Link href="/inventory">All inventory ›</Link>
              </div>
              <div className="dashboard-summary-list">
                {lowStockItems.length === 0 ? (
                  <div className="empty-state">No low stock items right now.</div>
                ) : (
                  lowStockItems.map((item) => (
                    <div className="dashboard-summary-row" key={item.id}>
                      <span aria-hidden="true" className="material-symbols-outlined dashboard-summary-glyph">
                        warning
                      </span>
                      <div className="dashboard-summary-row-body">
                        <strong>{item.name}</strong>
                        <p className="muted">
                          Remaining {item.quantityInStock} • threshold {item.minimumStockThreshold}
                        </p>
                      </div>
                      <span className="dashboard-inline-tag">Low stock</span>
                    </div>
                  ))
                )}
              </div>
            </article>
            ) : null}

            {canViewReports ? (
            <article className="table-card dashboard-summary-card">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Maintenance</p>
                  <h2>Damage / missing reports</h2>
                </div>
                <Link href="/reports">All reports ›</Link>
              </div>
              <div className="dashboard-summary-list">
                {damageReports.length === 0 ? (
                  <div className="empty-state">No reports filed yet.</div>
                ) : (
                  damageReports.map((report) => (
                    <div className="dashboard-summary-row" key={report.id}>
                      <span aria-hidden="true" className="material-symbols-outlined dashboard-summary-glyph">
                        report
                      </span>
                      <div className="dashboard-summary-row-body">
                        <strong>{report.itemName || report.item?.name || "Unspecified item"}</strong>
                        <p className="muted">
                          {report.reportType} • {formatDate(report.dateReported)}
                        </p>
                      </div>
                      <span className="dashboard-inline-tag dashboard-inline-tag-muted">{report.reportType}</span>
                    </div>
                  ))
                )}
              </div>
            </article>
            ) : null}
          </section>

          {canViewRentals ? (
          <section className="table-card dashboard-rentals-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Fleet</p>
                <h2>Active rentals</h2>
              </div>
              <Link href="/rentals">View all rentals ›</Link>
            </div>
            {rentals.length === 0 ? (
              <div className="empty-state">No active or overdue rentals.</div>
            ) : (
              <div className="dashboard-rentals-strip">
                {rentals.map((rental) => (
                  <div className="dashboard-rental-card" key={rental.id}>
                    <div className="dashboard-rental-card-head">
                      <span>{rental.rentalId}</span>
                      <StatusBadge tone={toneForStatus(rental.returnStatus)}>{rental.returnStatus.replaceAll("_", " ")}</StatusBadge>
                    </div>
                    <strong>{rental.item.name}</strong>
                    <p className="muted">{rental.renterName}</p>
                    <p className="dashboard-rental-card-date">Due {formatDate(rental.expectedReturnDate)}</p>
                    <span aria-hidden="true" className="material-symbols-outlined dashboard-rental-arrow">
                      arrow_forward
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
          ) : null}
        </>
      )}

      <footer className="dashboard-statusbar">
        <div className="dashboard-statusbar-left">
          <div className="dashboard-status-indicator" />
          <span>System status: optimal</span>
          <p>Last sync: 2 mins ago</p>
        </div>
        <div className="dashboard-statusbar-right">
          <span>Terms</span>
          <span>Privacy</span>
          <p>© OFWA Operations</p>
        </div>
      </footer>
    </div>
  );
}

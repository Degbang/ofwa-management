import { ReportStatus, Role } from "@prisma/client";
import { createDamageReportAction, updateDamageReportAction } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { canAccessPage } from "@/lib/permissions";
import { requirePageRoles } from "@/lib/session";

const PAGE_SIZE = 6;

function statusLabel(status: ReportStatus) {
  return status.replaceAll("_", " ");
}

type ReportsPageProps = {
  searchParams?: {
    page?: string;
  };
};

function parsePage(value?: string) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function reportsHref(page: number) {
  return page > 1 ? `/reports?page=${page}` : "/reports";
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await requirePageRoles([Role.BRIAN, Role.EDMOND, Role.DICKSON]);
  const isBrian = canAccessPage(session.user.email, session.user.roles, [Role.BRIAN]);
  const page = parsePage(searchParams?.page);
  const skip = (page - 1) * PAGE_SIZE;
  const where = isBrian
    ? undefined
    : {
        reportedById: session.user.id
      };

  const [reports, totalReports, damagedCount, missingCount, openCount] = await Promise.all([
    prisma.damageReport.findMany({
      where,
      include: {
        item: true,
        reportedBy: true
      },
      orderBy: {
        createdAt: "desc"
      },
      skip,
      take: PAGE_SIZE
    }),
    prisma.damageReport.count({ where }),
    prisma.damageReport.count({
      where: {
        ...(where ?? {}),
        reportType: "DAMAGED"
      }
    }),
    prisma.damageReport.count({
      where: {
        ...(where ?? {}),
        reportType: "MISSING"
      }
    }),
    prisma.damageReport.count({
      where: {
        ...(where ?? {}),
        status: {
          not: ReportStatus.RESOLVED
        }
      }
    })
  ]);

  const totalPages = Math.max(1, Math.ceil(totalReports / PAGE_SIZE));
  const startReport = totalReports === 0 ? 0 : skip + 1;
  const endReport = Math.min(skip + reports.length, totalReports);

  return (
    <div className="page reports-page">
      <div className="reports-header">
        <div>
          <p className="eyebrow">Damage Reports</p>
          <h1>Damaged and missing items</h1>
          <p>{isBrian ? "Review all reported issues and keep resolution updates moving." : "Track the damaged or missing items you have reported."}</p>
        </div>
        <div className="reports-stats">
          <div>
            <span>Open</span>
            <strong>{openCount}</strong>
          </div>
          <div>
            <span>Damaged</span>
            <strong>{damagedCount}</strong>
          </div>
          <div>
            <span>Missing</span>
            <strong>{missingCount}</strong>
          </div>
        </div>
      </div>

      <div className="reports-layout">
        <aside className="reports-side-panel">
          <div className="reports-panel-head">
            <h2>New condition report</h2>
            <p>Capture an item issue and attach supporting evidence when needed.</p>
          </div>

          <form action={createDamageReportAction} className="reports-form">
            <label>
              Item name
              <input name="itemName" placeholder="e.g. Canon DSLR Camera" required />
            </label>
            <label>
              Report type
              <select name="reportType" required>
                <option value="DAMAGED">Damaged</option>
                <option value="MISSING">Missing</option>
              </select>
            </label>
            <label>
              Description
              <textarea name="description" required />
            </label>
            <label>
              Photo upload
              <input accept=".pdf,.jpg,.jpeg,.png,.docx" name="photo" type="file" />
            </label>
            <button className="button button-primary" type="submit">
              Save report
            </button>
          </form>
        </aside>

        <section className="reports-list-panel">
          <div className="reports-list-head">
            <div>
              <h2>Current reports</h2>
              <p>
                Showing {startReport}-{endReport} of {totalReports} condition issue(s).
              </p>
            </div>
          </div>

          <div className="reports-list">
            {reports.length === 0 ? (
              <div className="empty-state">No reports filed yet.</div>
            ) : (
              reports.map((report) => (
                <article className="report-card" key={report.id}>
                  <div className="report-card-icon">
                    <span aria-hidden="true" className="material-symbols-outlined">
                      {report.reportType === "DAMAGED" ? "construction" : "inventory"}
                    </span>
                  </div>
                  <div className="report-card-main">
                    <div className="report-card-title-row">
                      <div>
                        <h3>{report.itemName || report.item?.name || "Unspecified item"}</h3>
                        <p>
                          {report.reportType} • Reported by {report.reportedBy.name ?? report.reportedBy.email} •{" "}
                          {formatDate(report.dateReported)}
                        </p>
                      </div>
                      <span className={`report-status report-status-${report.status.toLowerCase().replaceAll("_", "-")}`}>
                        {statusLabel(report.status)}
                      </span>
                    </div>
                    <p className="report-description">{report.description}</p>

                    {isBrian ? (
                      <details className="report-resolution">
                        <summary>Update resolution</summary>
                        <form action={updateDamageReportAction} className="reports-resolution-form">
                          <input name="reportId" type="hidden" value={report.id} />
                          <label>
                            Status
                            <select defaultValue={report.status} name="status">
                              <option value="REPORTED">Reported</option>
                              <option value="UNDER_REVIEW">Under Review</option>
                              <option value="RESOLVED">Resolved</option>
                            </select>
                          </label>
                          <label>
                            Resolution notes
                            <textarea defaultValue={report.resolutionNotes ?? ""} name="resolutionNotes" />
                          </label>
                          <button className="button button-secondary" type="submit">
                            Update report
                          </button>
                        </form>
                      </details>
                    ) : report.resolutionNotes ? (
                      <p className="report-resolution-note">{report.resolutionNotes}</p>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
          <div className="reports-table-footer">
            <p>
              Page {page} of {totalPages}
            </p>
            <div>
              <a aria-disabled={page <= 1} className={page <= 1 ? "is-disabled" : ""} href={reportsHref(Math.max(1, page - 1))}>
                <span aria-hidden="true" className="material-symbols-outlined">
                  chevron_left
                </span>
              </a>
              <span>{page}</span>
              <a
                aria-disabled={page >= totalPages}
                className={page >= totalPages ? "is-disabled" : ""}
                href={reportsHref(Math.min(totalPages, page + 1))}
              >
                <span aria-hidden="true" className="material-symbols-outlined">
                  chevron_right
                </span>
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

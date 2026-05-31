import Link from "next/link";
import { Prisma, ReturnStatus, Role } from "@prisma/client";
import { StatusBadge } from "@/components/status-badge";
import { createRentalAction, markRentalReturnedAction } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { canAccessPage } from "@/lib/permissions";
import { requirePageRoles } from "@/lib/session";

const PAGE_SIZE = 6;

type RentalsPageProps = {
  searchParams?: {
    q?: string;
    status?: string;
    date?: string;
    page?: string;
  };
};

function parsePage(value?: string) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function dayRange(value?: string) {
  if (!value) {
    return null;
  }

  const start = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function rentalsHref(params: RentalsPageProps["searchParams"], page: number) {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.status) query.set("status", params.status);
  if (params?.date) query.set("date", params.date);
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return suffix ? `/rentals?${suffix}` : "/rentals";
}

function statusTone(isOverdue: boolean, status: ReturnStatus) {
  if (isOverdue || status === ReturnStatus.NOT_RETURNED) {
    return "warning" as const;
  }

  return "neutral" as const;
}

export default async function RentalsPage({ searchParams }: RentalsPageProps) {
  const session = await requirePageRoles([Role.BRIAN, Role.EDMOND]);
  const canManageRentals = canAccessPage(session.user.email, session.user.roles, [Role.EDMOND]);
  const isBrianViewer = canAccessPage(session.user.email, session.user.roles, [Role.BRIAN]);
  const isViewerMode = isBrianViewer && !canManageRentals;

  const page = parsePage(searchParams?.page);
  const search = searchParams?.q?.trim() ?? "";
  const status = searchParams?.status ?? "";
  const range = dayRange(searchParams?.date);
  const now = new Date();

  const filters: Prisma.RentalWhereInput[] = [];
  if (search) {
    filters.push({
      OR: [
        { renterName: { contains: search, mode: "insensitive" } },
        { renterPhone: { contains: search, mode: "insensitive" } },
        { renterEmail: { contains: search, mode: "insensitive" } },
        { paymentStatus: { contains: search, mode: "insensitive" } },
        { item: { name: { contains: search, mode: "insensitive" } } }
      ]
    });
  }
  if (status === "OVERDUE") {
    filters.push({
      returnStatus: ReturnStatus.NOT_RETURNED,
      expectedReturnDate: {
        lt: now
      }
    });
  } else if (Object.values(ReturnStatus).includes(status as ReturnStatus)) {
    filters.push({ returnStatus: status as ReturnStatus });
  }
  if (range) {
    filters.push({
      expectedReturnDate: {
        gte: range.start,
        lt: range.end
      }
    });
  }

  const baseWhere: Prisma.RentalWhereInput =
    isBrianViewer && !canManageRentals
      ? {}
      : {
          createdById: session.user.id
        };
  const where: Prisma.RentalWhereInput =
    filters.length > 0
      ? {
          AND: [baseWhere, ...filters]
        }
      : baseWhere;
  const skip = (page - 1) * PAGE_SIZE;

  const [items, rentals, totalRentals] = await Promise.all([
    canManageRentals
      ? prisma.inventoryItem.findMany({
          where: {
            quantityInStock: {
              gt: 0
            }
          },
          orderBy: {
            name: "asc"
          }
        })
      : Promise.resolve([]),
    prisma.rental.findMany({
      where,
      include: {
        item: true
      },
      orderBy: {
        createdAt: "desc"
      },
      skip,
      take: PAGE_SIZE
    }),
    prisma.rental.count({ where })
  ]);

  const totalPages = Math.max(1, Math.ceil(totalRentals / PAGE_SIZE));
  const startRental = totalRentals === 0 ? 0 : skip + 1;
  const endRental = Math.min(skip + rentals.length, totalRentals);

  return (
    <div className="page rentals-page">
      <div className="rentals-header">
        <div>
          <p className="eyebrow">Rental dashboard</p>
          <h1>{isViewerMode ? "Equipment rental tracking" : "Camera and equipment rentals"}</h1>
          {isViewerMode ? <p className="muted">View who currently has equipment and monitor return status.</p> : null}
        </div>
      </div>

      <div className={`rentals-layout${isViewerMode ? " rentals-layout-viewer" : ""}`}>
        {canManageRentals ? (
          <aside className="rentals-form-card">
            <div className="rentals-card-title">
              <span aria-hidden="true" className="material-symbols-outlined">
                key
              </span>
              <h2>Create rental</h2>
            </div>
            <form action={createRentalAction} className="rentals-form">
              <label>
                Item rented
                <select name="itemId" required>
                  {items.length === 0 ? (
                    <option value="">No equipment available. Add or seed inventory first.</option>
                  ) : (
                    items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.quantityInStock} available)
                      </option>
                    ))
                  )}
                </select>
              </label>
              <div className="rentals-form-row">
                <label>
                  Quantity
                  <input min="1" name="quantityRented" required type="number" />
                </label>
                <label>
                  Payment status
                  <input name="paymentStatus" placeholder="Paid / Pending" required />
                </label>
              </div>
              <label>
                Customer / renter name
                <input name="renterName" required />
              </label>
              <div className="rentals-form-row">
                <label>
                  Phone
                  <input name="renterPhone" required />
                </label>
                <label>
                  Email
                  <input name="renterEmail" type="email" />
                </label>
              </div>
              <div className="rentals-form-row">
                <label>
                  Start date
                  <input name="rentalStartDate" required type="date" />
                </label>
                <label>
                  Expected return
                  <input name="expectedReturnDate" required type="date" />
                </label>
              </div>
              <div className="rentals-form-row">
                <label>
                  Rental fee
                  <input min="0" name="rentalFee" step="0.01" type="number" />
                </label>
                <label>
                  Deposit
                  <input min="0" name="depositAmount" step="0.01" type="number" />
                </label>
              </div>
              <label>
                Agreement / ID upload
                <input accept=".pdf,.jpg,.jpeg,.png,.docx" name="agreement" type="file" />
              </label>
              <label>
                Notes
                <textarea name="notes" />
              </label>
              <button className="button button-primary rentals-save-button" type="submit">
                Save rental
              </button>
            </form>
          </aside>
        ) : null}

        <section className={`rentals-table-card${isViewerMode ? " rentals-table-card-viewer" : ""}`}>
          <div className="rentals-table-head">
            <div>
              <h2>Rental records</h2>
              <p>
                Showing {startRental}-{endRental} of {totalRentals}
              </p>
            </div>
            <form className="rentals-filter-form">
              <input name="q" placeholder="Search by renter, item, phone..." type="search" defaultValue={search} />
              <select defaultValue={status} name="status">
                <option value="">All statuses</option>
                <option value="OVERDUE">Overdue</option>
                {Object.values(ReturnStatus).map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <input defaultValue={searchParams?.date ?? ""} name="date" type="date" />
              <button className="button button-dark" type="submit">
                Filter
              </button>
              <Link className="button button-secondary" href="/rentals">
                Reset
              </Link>
            </form>
          </div>

          <div className="rentals-table-wrap">
            <table className="rentals-table">
              <thead>
                <tr>
                  <th>Renter</th>
                  <th>Item</th>
                  <th>Dates</th>
                  <th>Fees</th>
                  <th>Status</th>
                  <th>Return action</th>
                </tr>
              </thead>
              <tbody>
                {rentals.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">No rentals match this filter.</div>
                    </td>
                  </tr>
                ) : (
                  rentals.map((rental) => {
                    const isOverdue =
                      rental.returnStatus === ReturnStatus.NOT_RETURNED && new Date(rental.expectedReturnDate) < now;

                    return (
                      <tr key={rental.id}>
                        <td>
                          <strong>{rental.renterName}</strong>
                          <p className="muted">{rental.renterPhone}</p>
                        </td>
                        <td>
                          {rental.item.name}
                          <p className="muted">Qty: {rental.quantityRented}</p>
                        </td>
                        <td>
                          <p>Start: {formatDate(rental.rentalStartDate)}</p>
                          <p>Due: {formatDate(rental.expectedReturnDate)}</p>
                          <p>Actual: {formatDate(rental.actualReturnDate)}</p>
                        </td>
                        <td>
                          <p>Fee: {formatCurrency(rental.rentalFee?.toString())}</p>
                          <p>Deposit: {formatCurrency(rental.depositAmount?.toString())}</p>
                          <p className="muted">{rental.paymentStatus}</p>
                        </td>
                        <td>
                          <StatusBadge tone={statusTone(isOverdue, rental.returnStatus)}>
                            {isOverdue ? "Overdue" : rental.returnStatus.replaceAll("_", " ")}
                          </StatusBadge>
                        </td>
                        <td>
                          {rental.returnStatus === ReturnStatus.NOT_RETURNED && canManageRentals ? (
                            <details className="rentals-return-details">
                              <summary>Update return</summary>
                              <form action={markRentalReturnedAction} className="rentals-return-form">
                                <input name="rentalId" type="hidden" value={rental.id} />
                                <label>
                                  Return status
                                  <select name="returnStatus" required>
                                    <option value="RETURNED">Returned</option>
                                    <option value="RETURNED_DAMAGED">Returned Damaged</option>
                                    <option value="MISSING">Missing</option>
                                  </select>
                                </label>
                                <label>
                                  Actual return date
                                  <input name="actualReturnDate" required type="date" />
                                </label>
                                <label>
                                  Notes
                                  <textarea name="notes" />
                                </label>
                                <button className="button button-secondary" type="submit">
                                  Save return
                                </button>
                              </form>
                            </details>
                          ) : rental.returnStatus === ReturnStatus.NOT_RETURNED ? (
                            <span className="muted">View only</span>
                          ) : (
                            <span className="muted">Completed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="rentals-table-footer">
            <p>
              Page {page} of {totalPages}
            </p>
            <div>
              <Link aria-disabled={page <= 1} className={page <= 1 ? "is-disabled" : ""} href={rentalsHref(searchParams, Math.max(1, page - 1))}>
                <span aria-hidden="true" className="material-symbols-outlined">
                  chevron_left
                </span>
              </Link>
              <span>{page}</span>
              <Link
                aria-disabled={page >= totalPages}
                className={page >= totalPages ? "is-disabled" : ""}
                href={rentalsHref(searchParams, Math.min(totalPages, page + 1))}
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

import { Role } from "@prisma/client";
import { createVendorAction, updateVendorAction } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { requirePageRoles } from "@/lib/session";

const PAGE_SIZE = 6;

function categoryLabel(value: string | null) {
  return value?.trim() || "General supplier";
}

type VendorsPageProps = {
  searchParams?: {
    page?: string;
  };
};

function parsePage(value?: string) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function vendorsHref(page: number) {
  return page > 1 ? `/vendors?page=${page}` : "/vendors";
}

export default async function VendorsPage({ searchParams }: VendorsPageProps) {
  await requirePageRoles([Role.BRIAN]);
  const page = parsePage(searchParams?.page);
  const skip = (page - 1) * PAGE_SIZE;

  const [vendors, totalVendors] = await Promise.all([
    prisma.vendor.findMany({
      orderBy: {
        name: "asc"
      },
      skip,
      take: PAGE_SIZE
    }),
    prisma.vendor.count()
  ]);

  const totalPages = Math.max(1, Math.ceil(totalVendors / PAGE_SIZE));
  const startVendor = totalVendors === 0 ? 0 : skip + 1;
  const endVendor = Math.min(skip + vendors.length, totalVendors);

  return (
    <div className="page vendors-page">
      <div className="vendors-header">
        <div>
          <p className="eyebrow">Logistics Portal</p>
          <h1>Suppliers & Contacts</h1>
        </div>
        <div className="vendors-header-actions">
          <button className="button button-secondary" type="button">
            Export CSV
          </button>
          <button className="button button-dark" type="button">
            <span aria-hidden="true" className="material-symbols-outlined">
              filter_list
            </span>
            Filter
          </button>
        </div>
      </div>

      <div className="vendors-grid">
        <aside className="vendors-form-card">
          <div className="vendors-card-title">
            <span aria-hidden="true" className="material-symbols-outlined">
              person_add
            </span>
            <h2>Add Vendor</h2>
          </div>

          <form action={createVendorAction} className="vendors-form">
            <label>
              Vendor name
              <input name="name" placeholder="e.g. Atlas Global Logistics" required />
            </label>
            <div className="vendors-form-row">
              <label>
                Contact person
                <input name="contactPerson" placeholder="Full name" />
              </label>
              <label>
                Phone
                <input name="phoneNumber" placeholder="+233 ..." />
              </label>
            </div>
            <label>
              Email address
              <input name="email" placeholder="contact@vendor.com" type="email" />
            </label>
            <label>
              Street address
              <textarea name="address" placeholder="Primary warehouse or office location" rows={2} />
            </label>
            <label>
              Items / services supplied
              <input name="suppliedItems" placeholder="Equipment, freight, catering, printing..." />
            </label>
            <label>
              Internal notes
              <textarea name="notes" placeholder="Contract terms, delivery preferences, etc." rows={3} />
            </label>
            <button className="button button-primary vendors-save-button" type="submit">
              <span aria-hidden="true" className="material-symbols-outlined">
                save
              </span>
              Save Vendor
            </button>
          </form>
        </aside>

        <section className="vendors-table-card">
          <div className="vendors-table-head">
            <div className="vendors-table-title">
              <h2>Current Vendors</h2>
              <span>{totalVendors} total</span>
            </div>
            <div className="vendors-table-tools">
              <button aria-label="Sort vendors" type="button">
                <span aria-hidden="true" className="material-symbols-outlined">
                  sort_by_alpha
                </span>
              </button>
              <button aria-label="More vendor options" type="button">
                <span aria-hidden="true" className="material-symbols-outlined">
                  more_vert
                </span>
              </button>
            </div>
          </div>

          <div className="vendors-table-wrap">
            <table className="vendors-table">
              <thead>
                <tr>
                  <th>Vendor Name</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {vendors.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state">No vendors added yet.</div>
                    </td>
                  </tr>
                ) : (
                  vendors.map((vendor) => (
                    <tr key={vendor.id}>
                      <td>
                        <div className="vendors-name-cell">
                          <span className="vendors-vendor-icon">
                            <span aria-hidden="true" className="material-symbols-outlined">
                              local_shipping
                            </span>
                          </span>
                          <div>
                            <strong>{vendor.name}</strong>
                            <p>{categoryLabel(vendor.suppliedItems)}</p>
                          </div>
                        </div>
                      </td>
                      <td>{vendor.contactPerson || "-"}</td>
                      <td>
                        {vendor.email ? (
                          <a className="vendors-email-link" href={`mailto:${vendor.email}`}>
                            {vendor.email}
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        <span className="vendors-status-pill">
                          <span />
                          Active
                        </span>
                      </td>
                      <td className="vendors-action-cell">
                        <details className="vendors-edit-details">
                          <summary aria-label={`Edit ${vendor.name}`}>
                            <span aria-hidden="true" className="material-symbols-outlined">
                              edit
                            </span>
                          </summary>
                          <form action={updateVendorAction} className="vendors-inline-edit">
                            <input name="vendorId" type="hidden" value={vendor.id} />
                            <label>
                              Vendor name
                              <input defaultValue={vendor.name} name="name" required />
                            </label>
                            <label>
                              Contact person
                              <input defaultValue={vendor.contactPerson ?? ""} name="contactPerson" />
                            </label>
                            <label>
                              Phone
                              <input defaultValue={vendor.phoneNumber ?? ""} name="phoneNumber" />
                            </label>
                            <label>
                              Email
                              <input defaultValue={vendor.email ?? ""} name="email" type="email" />
                            </label>
                            <label>
                              Address
                              <textarea defaultValue={vendor.address ?? ""} name="address" />
                            </label>
                            <label>
                              Items/services supplied
                              <textarea defaultValue={vendor.suppliedItems ?? ""} name="suppliedItems" />
                            </label>
                            <label>
                              Notes
                              <textarea defaultValue={vendor.notes ?? ""} name="notes" />
                            </label>
                            <button className="button button-primary" type="submit">
                              Update vendor
                            </button>
                          </form>
                        </details>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="vendors-table-footer">
            <p>Showing {startVendor}-{endVendor} of {totalVendors} vendors</p>
            <div>
              <a aria-disabled={page <= 1} className={page <= 1 ? "is-disabled" : ""} href={vendorsHref(Math.max(1, page - 1))}>
                <span aria-hidden="true" className="material-symbols-outlined">
                  chevron_left
                </span>
              </a>
              <span className="is-current">{page}</span>
              <a
                aria-disabled={page >= totalPages}
                className={page >= totalPages ? "is-disabled" : ""}
                href={vendorsHref(Math.min(totalPages, page + 1))}
              >
                <span aria-hidden="true" className="material-symbols-outlined">
                  chevron_right
                </span>
              </a>
            </div>
          </div>

          <div className="vendors-insights">
            <article>
              <div className="vendors-insight-icon vendors-insight-icon-primary">
                <span aria-hidden="true" className="material-symbols-outlined">
                  trending_up
                </span>
              </div>
              <div>
                <p>Vendor records</p>
                <strong>{totalVendors}</strong>
              </div>
            </article>
            <article>
              <div className="vendors-insight-icon vendors-insight-icon-dark">
                <span aria-hidden="true" className="material-symbols-outlined">
                  verified
                </span>
              </div>
              <div>
                <p>Contact coverage</p>
                <strong>{vendors.filter((vendor) => vendor.email || vendor.phoneNumber).length}</strong>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}

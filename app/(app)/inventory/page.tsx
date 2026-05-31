import Link from "next/link";
import { InventoryCondition, Prisma, Role } from "@prisma/client";
import { StatusBadge } from "@/components/status-badge";
import { createInventoryItemAction } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { canAccessPage } from "@/lib/permissions";
import { requirePageRoles } from "@/lib/session";

const PAGE_SIZE = 6;

type InventoryPageProps = {
  searchParams?: {
    q?: string;
    condition?: string;
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

function inventoryHref(params: InventoryPageProps["searchParams"], page: number) {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.condition) query.set("condition", params.condition);
  if (params?.date) query.set("date", params.date);
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return suffix ? `/inventory?${suffix}` : "/inventory";
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const session = await requirePageRoles([Role.BRIAN, Role.JAEL]);
  const isBrian = canAccessPage(session.user.email, session.user.roles, [Role.BRIAN]);
  const page = parsePage(searchParams?.page);
  const search = searchParams?.q?.trim() ?? "";
  const condition =
    searchParams?.condition && Object.values(InventoryCondition).includes(searchParams.condition as InventoryCondition)
      ? (searchParams.condition as InventoryCondition)
      : "";
  const range = dayRange(searchParams?.date);

  const filters: Prisma.InventoryItemWhereInput[] = [];
  if (search) {
    filters.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { vendor: { name: { contains: search, mode: "insensitive" } } }
      ]
    });
  }
  if (condition) {
    filters.push({ condition });
  }
  if (range) {
    filters.push({
      updatedAt: {
        gte: range.start,
        lt: range.end
      }
    });
  }

  const where: Prisma.InventoryItemWhereInput = filters.length > 0 ? { AND: filters } : {};
  const skip = (page - 1) * PAGE_SIZE;

  const [vendors, inventoryItems, totalItems] = await Promise.all([
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
    prisma.inventoryItem.findMany({
      where,
      include: {
        vendor: true
      },
      orderBy: {
        updatedAt: "desc"
      },
      skip,
      take: PAGE_SIZE
    }),
    prisma.inventoryItem.count({ where })
  ]);

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const startItem = totalItems === 0 ? 0 : skip + 1;
  const endItem = Math.min(skip + inventoryItems.length, totalItems);

  return (
    <div className="page inventory-page">
      <div className="inventory-header">
        <div>
          <p className="eyebrow">Inventory</p>
          <h1>Assets and stock</h1>
        </div>
        <div className="inventory-header-actions">
          {isBrian ? (
            <Link className="button button-secondary" href="/vendors">
              Manage vendors
            </Link>
          ) : null}
          <Link className="button button-dark" href="/reports">
            Damage reports
          </Link>
        </div>
      </div>

      <div className="inventory-layout">
        {isBrian ? (
          <aside className="inventory-form-card">
            <div className="inventory-card-title">
              <span aria-hidden="true" className="material-symbols-outlined">
                inventory_2
              </span>
              <h2>Add inventory item</h2>
            </div>
            <form action={createInventoryItemAction} className="inventory-form">
              <label>
                Item name
                <input name="name" required />
              </label>
              <label>
                Category
                <input name="category" required />
              </label>
              <label>
                Description
                <textarea name="description" />
              </label>
              <div className="inventory-form-row">
                <label>
                  Quantity
                  <input min="0" name="quantityInStock" required type="number" />
                </label>
                <label>
                  Low stock threshold
                  <input min="0" name="minimumStockThreshold" required type="number" />
                </label>
              </div>
              <div className="inventory-form-row">
                <label>
                  Unit cost
                  <input min="0" name="unitCost" step="0.01" type="number" />
                </label>
                <label>
                  Vendor
                  <select name="vendorId">
                    <option value="">No vendor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Location
                <input name="location" />
              </label>
              <button className="button button-primary inventory-save-button" type="submit">
                Save item
              </button>
            </form>
          </aside>
        ) : null}

        <section className="inventory-table-card">
          <div className="inventory-table-head">
            <div>
              <h2>Inventory items</h2>
              <p>
                Showing {startItem}-{endItem} of {totalItems}
              </p>
            </div>
            <form className="inventory-filter-form">
              <input name="q" placeholder="Search by item, vendor, location..." type="search" defaultValue={search} />
              <select defaultValue={condition} name="condition">
                <option value="">All conditions</option>
                {Object.values(InventoryCondition).map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <input defaultValue={searchParams?.date ?? ""} name="date" type="date" />
              <button className="button button-dark" type="submit">
                Filter
              </button>
              <Link className="button button-secondary" href="/inventory">
                Reset
              </Link>
            </form>
          </div>

          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Condition</th>
                  <th>Vendor</th>
                  <th>Updated</th>
                  <th>Unit cost</th>
                </tr>
              </thead>
              <tbody>
                {inventoryItems.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">No inventory items match this filter.</div>
                    </td>
                  </tr>
                ) : (
                  inventoryItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="inventory-name-cell">
                          <span className="inventory-item-icon">
                            <span aria-hidden="true" className="material-symbols-outlined">
                              inventory_2
                            </span>
                          </span>
                          <div>
                            <strong>{item.name}</strong>
                            <p>{item.location ?? "No location"}</p>
                          </div>
                        </div>
                      </td>
                      <td>{item.category}</td>
                      <td>
                        <strong>
                          {item.quantityInStock} / {item.minimumStockThreshold}
                        </strong>
                        {item.quantityInStock <= item.minimumStockThreshold ? (
                          <p>
                            <StatusBadge tone="warning">Low Stock</StatusBadge>
                          </p>
                        ) : null}
                      </td>
                      <td>{item.condition.replaceAll("_", " ")}</td>
                      <td>{item.vendor?.name ?? "-"}</td>
                      <td>{formatDate(item.updatedAt)}</td>
                      <td>{formatCurrency(item.unitCost?.toString())}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="inventory-table-footer">
            <p>
              Page {page} of {totalPages}
            </p>
            <div>
              <Link aria-disabled={page <= 1} className={page <= 1 ? "is-disabled" : ""} href={inventoryHref(searchParams, Math.max(1, page - 1))}>
                <span aria-hidden="true" className="material-symbols-outlined">
                  chevron_left
                </span>
              </Link>
              <span>{page}</span>
              <Link
                aria-disabled={page >= totalPages}
                className={page >= totalPages ? "is-disabled" : ""}
                href={inventoryHref(searchParams, Math.min(totalPages, page + 1))}
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

export function formatCurrency(amount?: string | number | null) {
  if (amount === null || amount === undefined || amount === "") {
    return "-";
  }

  const numeric = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(numeric)) {
    return "-";
  }

  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS"
  }).format(numeric);
}

export function formatDate(value?: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium"
  }).format(new Date(value));
}

export function formatDateTime(value?: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

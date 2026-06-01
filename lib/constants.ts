import { RequestType, Role } from "@prisma/client";

export const APP_NAME = "OFWA Operations";

export const HUB_OPTIONS = [
  "Kumasi Wiki Hub",
  "Accra Wiki Hub",
  "Tamale Wiki Hub",
  "Walewale Wiki Hub",
  "SDD UBBIDS Wiki Club",
  "Ho Wiki Hub",
  "Wikitech Student Developers Club, Kumasi",
  "Dr. Hilla Limman Wiki Club",
  "Central Wikitech Club",
  "New Health Wiki Club",
  "Enchi Wiki Club",
  "UG Wiki Club",
  "UDS Wiki Tech",
  "GH Media Wiki Club"
] as const;

export const ALLOWED_UPLOAD_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

export const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".docx"];
export const MAX_UPLOAD_SIZE_BYTES = Number(process.env.MAX_UPLOAD_SIZE_BYTES ?? 10 * 1024);

export function formatUploadSizeLimit(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
  }

  return `${Math.round(bytes / 1024)} KB`;
}

export const PAYABLE_REQUEST_TYPES = new Set<RequestType>([
  RequestType.CASH_DISBURSEMENT,
  RequestType.HUB_FUND
]);

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  CASH_DISBURSEMENT: "Cash Disbursement",
  HUB_FUND: "Hub Fund Request",
  REIMBURSEMENT: "Reimbursement",
  LEAVE: "Leave Request",
  GENERAL: "General/Other Request"
};

export const ROLE_LABELS: Record<Role, string> = {
  STAFF: "Staff",
  BRIAN: "Finance",
  JAEL: "Admin",
  DICKSON: "Programs",
  EDMOND: "Media"
};

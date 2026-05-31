import { RequestStatus, RequestType, Role } from "@prisma/client";

export function hasRole(userRoles: Role[], requiredRoles: Role[]) {
  return requiredRoles.some((role) => userRoles.includes(role));
}

export function isDeveloperViewerEmail(email?: string | null) {
  const configured = process.env.ALFRED_EMAIL?.trim().toLowerCase();
  return Boolean(configured && email?.trim().toLowerCase() === configured);
}

export function canAccessPage(email: string, userRoles: Role[], requiredRoles: Role[]) {
  return isDeveloperViewerEmail(email) || hasRole(userRoles, requiredRoles);
}

export function canManageInventory(userRoles: Role[]) {
  return hasRole(userRoles, [Role.BRIAN]);
}

export function canManageRentals(userRoles: Role[]) {
  return hasRole(userRoles, [Role.EDMOND]);
}

export function canAccessUsersModule(email: string, userRoles: Role[]) {
  return canAccessPage(email, userRoles, [Role.BRIAN, Role.JAEL]);
}

export function canAccessInventoryModule(email: string, userRoles: Role[]) {
  return canAccessPage(email, userRoles, [Role.BRIAN, Role.JAEL]);
}

export function canAccessReportsModule(email: string, userRoles: Role[]) {
  return canAccessPage(email, userRoles, [Role.BRIAN, Role.EDMOND, Role.DICKSON]);
}

export function canAccessRentalsModule(email: string, userRoles: Role[]) {
  return canAccessPage(email, userRoles, [Role.BRIAN, Role.EDMOND]);
}

export function canAccessVendorsModule(email: string, userRoles: Role[]) {
  return canAccessPage(email, userRoles, [Role.BRIAN]);
}

export function canReviewRequest(userRoles: Role[], requestType: RequestType, status: RequestStatus) {
  if (
    status === RequestStatus.REJECTED ||
    status === RequestStatus.CLOSED ||
    status === RequestStatus.PAID ||
    status === RequestStatus.APPROVED
  ) {
    return false;
  }

  if (requestType === RequestType.HUB_FUND) {
    return hasRole(userRoles, [Role.DICKSON, Role.BRIAN, Role.JAEL]);
  }

  if (requestType === RequestType.LEAVE) {
    return hasRole(userRoles, [Role.JAEL]);
  }

  return hasRole(userRoles, [Role.BRIAN, Role.JAEL]);
}

export function isFinanceRole(userRoles: Role[]) {
  return hasRole(userRoles, [Role.BRIAN]);
}

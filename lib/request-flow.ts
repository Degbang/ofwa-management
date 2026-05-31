import {
  ApprovalActionType,
  NotificationType,
  PaymentStatus,
  RequestStatus,
  RequestType,
  Role
} from "@prisma/client";
import { PAYABLE_REQUEST_TYPES } from "@/lib/constants";

type ReviewNotificationInput = {
  actorRoles: Role[];
  requestType: RequestType;
  requesterEmail?: string | null;
  nextApproverEmail?: string | null;
  brianEmails?: string[];
};

function uniqueEmails(values: Array<string | null | undefined>) {
  return [...new Set(values.filter(Boolean))] as string[];
}

export function getInitialApproverRole(type: RequestType) {
  switch (type) {
    case RequestType.HUB_FUND:
      return Role.DICKSON;
    case RequestType.LEAVE:
      return Role.JAEL;
    default:
      return Role.BRIAN;
  }
}

export function getSubmissionStatus(type: RequestType) {
  return type === RequestType.LEAVE ? RequestStatus.UNDER_REVIEW : RequestStatus.SUBMITTED;
}

export function isPhaseOneInternalRequestType(type: RequestType) {
  return type === RequestType.CASH_DISBURSEMENT || type === RequestType.LEAVE;
}

export function getNextRoleAfterForwardForActor(type: RequestType, actorRoles: Role[]) {
  if (type === RequestType.HUB_FUND) {
    if (actorRoles.includes(Role.DICKSON)) {
      return Role.BRIAN;
    }

    if (actorRoles.includes(Role.BRIAN)) {
      return Role.JAEL;
    }

    return null;
  }

  if (
    actorRoles.includes(Role.BRIAN) &&
    (type === RequestType.CASH_DISBURSEMENT || type === RequestType.REIMBURSEMENT || type === RequestType.GENERAL)
  ) {
    return Role.JAEL;
  }

  return null;
}

export function canForwardRequestForActor(type: RequestType, actorRoles: Role[]) {
  return getNextRoleAfterForwardForActor(type, actorRoles) !== null;
}

export function requiresPayment(type: RequestType) {
  return PAYABLE_REQUEST_TYPES.has(type);
}

export function getPaymentStatus(type: RequestType) {
  return requiresPayment(type) ? PaymentStatus.PENDING : PaymentStatus.NOT_APPLICABLE;
}

export function getApprovalOutcome(type: RequestType) {
  return {
    status: RequestStatus.APPROVED,
    paymentStatus: requiresPayment(type) ? PaymentStatus.PENDING : PaymentStatus.NOT_APPLICABLE,
    nextApproverRole: requiresPayment(type) ? Role.BRIAN : null,
    action: ApprovalActionType.APPROVED,
    notificationType: NotificationType.REQUEST_APPROVED
  };
}

export function calculateHubFundTotal(payload: {
  foodBudget?: number | null;
  waterBudget?: number | null;
  venueBudget?: number | null;
  facilitatorsBudget?: number | null;
  dataBudget?: number | null;
  otherCostsBudget?: number | null;
}) {
  return (
    (payload.foodBudget ?? 0) +
    (payload.waterBudget ?? 0) +
    (payload.venueBudget ?? 0) +
    (payload.facilitatorsBudget ?? 0) +
    (payload.dataBudget ?? 0) +
    (payload.otherCostsBudget ?? 0)
  );
}

export function getForwardNotificationRecipients({ nextApproverEmail }: ReviewNotificationInput) {
  return uniqueEmails([nextApproverEmail]);
}

export function getRejectionNotificationRecipients({ actorRoles, requestType, requesterEmail, brianEmails = [] }: ReviewNotificationInput) {
  if (actorRoles.includes(Role.JAEL)) {
    if (requestType === RequestType.LEAVE) {
      return uniqueEmails([requesterEmail]);
    }

    return uniqueEmails([requesterEmail, ...brianEmails]);
  }

  return uniqueEmails([requesterEmail]);
}

export function getFinalApprovalNotificationRecipients({ requestType, requesterEmail, brianEmails = [] }: ReviewNotificationInput) {
  if (requestType === RequestType.LEAVE) {
    return uniqueEmails([requesterEmail]);
  }

  return uniqueEmails([requesterEmail, ...brianEmails]);
}

export function getMarkedPaidNotificationRecipients({ requesterEmail }: ReviewNotificationInput) {
  return uniqueEmails([requesterEmail]);
}

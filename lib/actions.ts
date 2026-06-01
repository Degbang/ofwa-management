"use server";

import {
  ApprovalActionType,
  AttachmentEntityType,
  InventoryCondition,
  NotificationType,
  PaymentStatus,
  Prisma,
  ReportStatus,
  ReportType,
  RequestStatus,
  RequestType,
  ReturnStatus,
  Role
} from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { REQUEST_TYPE_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { ensureConfiguredRoleUser } from "@/lib/auth-user";
import { makeReadableId } from "@/lib/ids";
import {
  calculateHubFundTotal,
  canForwardRequestForActor,
  getApprovalOutcome,
  getFinalApprovalNotificationRecipients,
  getForwardNotificationRecipients,
  getInitialApproverRole,
  getMarkedPaidNotificationRecipients,
  getNextRoleAfterForwardForActor,
  getPaymentStatus,
  getRejectionNotificationRecipients,
  getSubmissionStatus
} from "@/lib/request-flow";
import { canReviewRequest, isFinanceRole } from "@/lib/permissions";
import { requirePageRoles, requireRoles, requireSession } from "@/lib/session";
import { runScheduledAlerts } from "@/lib/services/alerts";
import { sendEmail } from "@/lib/services/email";
import { saveUploadedFile } from "@/lib/services/storage";
import { getEmailsByRole, notify } from "@/lib/services/notifications";
import { damageReportSchema, inventoryItemSchema, vendorSchema } from "@/lib/validators/inventory";
import { parseRequestFormData } from "@/lib/validators/request";
import { rentalReturnSchema, rentalSchema } from "@/lib/validators/rental";
import { validateUpload } from "@/lib/validators/common";

async function findFirstUserByRole(role: Role) {
  const existingUser = await prisma.user.findFirst({
    where: {
      isActive: true,
      roleAssignments: {
        some: {
          role
        }
      }
    },
    orderBy: {
      email: "asc"
    }
  });

  if (existingUser) {
    return existingUser;
  }

  await ensureConfiguredRoleUser(role);

  return prisma.user.findFirst({
    where: {
      isActive: true,
      roleAssignments: {
        some: {
          role
        }
      }
    },
    orderBy: {
      email: "asc"
    }
  });
}

function parseRoleList(values: FormDataEntryValue[]) {
  return values
    .map((value) => String(value))
    .filter((value): value is Role => Object.values(Role).includes(value as Role));
}

function withToast(path: string, message: string, type: "success" | "error" | "info" = "success") {
  const params = new URLSearchParams({
    toast: message,
    toastType: type
  });

  return `${path}?${params.toString()}`;
}

function resolveWorkflowActorRole(userRoles: Role[], requestType: RequestType) {
  if (userRoles.includes(Role.JAEL)) {
    return Role.JAEL;
  }

  if (requestType === RequestType.HUB_FUND && userRoles.includes(Role.DICKSON)) {
    return Role.DICKSON;
  }

  if (userRoles.includes(Role.BRIAN)) {
    return Role.BRIAN;
  }

  if (userRoles.includes(Role.DICKSON)) {
    return Role.DICKSON;
  }

  if (userRoles.includes(Role.EDMOND)) {
    return Role.EDMOND;
  }

  return Role.STAFF;
}

async function logAudit(actorId: string, entityType: string, entityId: string, action: string, details?: Prisma.InputJsonValue) {
  await prisma.auditLog.create({
    data: {
      actorId,
      entityType,
      entityId,
      requestId: entityType === "request" ? entityId : undefined,
      action,
      details
    }
  });
}

function getRequestContactEmail(request: { requester?: { email: string } | null; externalEmail?: string | null }) {
  return request.requester?.email ?? request.externalEmail ?? null;
}

function getRequesterLabel(request: {
  requester?: { name: string | null; email: string } | null;
  externalName?: string | null;
  externalEmail?: string | null;
}) {
  return request.requester?.name ?? request.externalName ?? request.requester?.email ?? request.externalEmail ?? "Requester";
}

async function maybeSendLowStockAlert(itemId: string) {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId }
  });

  if (!item || item.quantityInStock > item.minimumStockThreshold) {
    return;
  }

  const brianEmails = await getEmailsByRole(Role.BRIAN);
  await notify({
    type: NotificationType.LOW_STOCK,
    recipients: brianEmails,
    subject: `Low stock: ${item.name}`,
    body: `${item.name} is at ${item.quantityInStock} item(s), which is at or below the minimum threshold of ${item.minimumStockThreshold}.`,
    metadata: {
      inventoryItemId: item.id
    }
  });
}

function toDateOrThrow(value: string, label: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${label}.`);
  }

  return parsed;
}

export async function createRequestAction(formData: FormData) {
  const session = await requireSession();
  const parsedPayload = parseRequestFormData(formData);
  const submissionRole = session.user.roles.includes(Role.STAFF) ? Role.STAFF : resolveWorkflowActorRole(session.user.roles, parsedPayload.requestType);
  const attachment = formData.get("attachment");
  if (
    parsedPayload.requestType !== RequestType.CASH_DISBURSEMENT &&
    parsedPayload.requestType !== RequestType.LEAVE
  ) {
    throw new Error("Only leave and cash disbursement requests can be submitted inside the app.");
  }

  const payload = parsedPayload;
  const requestType = payload.requestType;

  const requestPayload =
    requestType === RequestType.LEAVE
      ? (() => {
          const startDate = toDateOrThrow(payload.leaveStartDate, "leave start date");
          const endDate = toDateOrThrow(payload.leaveEndDate, "leave end date");
          if (endDate < startDate) {
            throw new Error("Leave end date cannot be before the start date.");
          }

          const millisecondsPerDay = 24 * 60 * 60 * 1000;
          const numberOfLeaveDays = Math.floor((endDate.getTime() - startDate.getTime()) / millisecondsPerDay) + 1;

          return {
            ...payload,
            numberOfLeaveDays
          };
        })()
      : payload;

  if (attachment instanceof File && attachment.size > 0) {
    validateUpload(attachment, false);
  }

  const initialApproverRole = getInitialApproverRole(requestType);
  const initialApprover = await findFirstUserByRole(initialApproverRole);

  if (!initialApprover) {
    throw new Error(`No active approver found for role ${initialApproverRole}.`);
  }

  const amount =
    "amount" in payload
        ? typeof payload.amount === "number"
          ? payload.amount
          : null
        : null;

  const title =
    requestType === RequestType.LEAVE
      ? "Leave Request"
      : "Cash Disbursement Request";
  const description = payload.description;

  const createdRequest = await prisma.$transaction(async (tx) => {
    const request = await tx.request.create({
      data: {
        requestId: makeReadableId("REQ"),
        type: requestType,
        title,
        description,
        requesterId: session.user.id,
        amount: amount ?? undefined,
        paymentMethod: null,
        mobileMoneyNumber: "mobileMoneyNumber" in payload ? payload.mobileMoneyNumber || null : null,
        mobileMoneyName: "mobileMoneyName" in payload ? payload.mobileMoneyName || null : null,
        status: getSubmissionStatus(requestType),
        paymentStatus: getPaymentStatus(requestType),
        currentApproverId: initialApprover.id,
        payload: requestPayload as Prisma.InputJsonValue,
        submittedAt: new Date()
      }
    });

    await tx.approvalAction.create({
      data: {
        requestId: request.id,
        actorId: session.user.id,
        role: submissionRole,
        action: ApprovalActionType.SUBMITTED,
        comment: "Request submitted"
      }
    });

    if (attachment instanceof File && attachment.size > 0) {
      const storedFile = await saveUploadedFile(attachment, AttachmentEntityType.REQUEST, request.id);
      if (storedFile) {
        await tx.attachment.create({
          data: {
            entityType: AttachmentEntityType.REQUEST,
            entityId: request.id,
            requestId: request.id,
            uploadedById: session.user.id,
            ...storedFile
          }
        });
      }
    }

    return request;
  });

  await logAudit(session.user.id, "request", createdRequest.id, "request.created", {
    requestType,
    requestId: createdRequest.requestId
  });

  const approverEmails = await getEmailsByRole(initialApproverRole);
  await notify({
    type: NotificationType.REQUEST_SUBMITTED,
    recipients: approverEmails,
    subject: `New ${requestType === RequestType.LEAVE ? "Leave" : "Cash Disbursement"} Request: ${createdRequest.requestId}`,
    body: `${session.user.name ?? session.user.email} submitted a ${requestType === RequestType.LEAVE ? "leave" : "cash disbursement"} request.`,
    metadata: { requestId: createdRequest.id }
  });

  revalidatePath("/requests");
  revalidatePath("/requests/new");
  redirect(withToast("/requests", "Request submitted successfully."));
}

export async function createPublicHubFundRequestAction(formData: FormData) {
  const parsedPayload = parseRequestFormData(formData);
  const attachment = formData.get("attachment");

  if (parsedPayload.requestType !== RequestType.HUB_FUND) {
    throw new Error("Invalid request type.");
  }

  if (attachment instanceof File && attachment.size > 0) {
    validateUpload(attachment, false);
  }

  const totalBudget = calculateHubFundTotal(parsedPayload);
  const payload = {
    ...parsedPayload,
    eventDate: toDateOrThrow(parsedPayload.eventDate, "event date").toISOString().slice(0, 10),
    totalBudget
  };

  const initialApproverRole = getInitialApproverRole(RequestType.HUB_FUND);
  const initialApprover = await findFirstUserByRole(initialApproverRole);

  if (!initialApprover) {
    throw new Error(`No active approver found for role ${initialApproverRole}.`);
  }

  const createdRequest = await prisma.$transaction(async (tx) => {
    const request = await tx.request.create({
      data: {
        requestId: makeReadableId("REQ"),
        type: RequestType.HUB_FUND,
        title: `Hub Fund Request - ${payload.eventName}`,
        description: `Hub Fund request for ${payload.eventName} (${payload.hubName})`,
        externalName: payload.requesterName,
        externalEmail: payload.requesterEmail,
        externalPhone: payload.requesterPhone,
        amount: totalBudget,
        mobileMoneyNumber: payload.mobileMoneyNumber,
        mobileMoneyName: payload.mobileMoneyName,
        status: RequestStatus.SUBMITTED,
        paymentStatus: getPaymentStatus(RequestType.HUB_FUND),
        currentApproverId: initialApprover.id,
        payload: payload as Prisma.InputJsonValue,
        submittedAt: new Date()
      }
    });

      if (attachment instanceof File && attachment.size > 0) {
        const storedFile = await saveUploadedFile(attachment, AttachmentEntityType.REQUEST, request.id);
      if (storedFile) {
        await tx.attachment.create({
          data: {
            entityType: AttachmentEntityType.REQUEST,
            entityId: request.id,
            requestId: request.id,
            uploadedById: initialApprover.id,
            ...storedFile
          }
        });
      }
    }

    return request;
  });

  const dicksonEmails = await getEmailsByRole(Role.DICKSON);
  await notify({
    type: NotificationType.REQUEST_SUBMITTED,
    recipients: dicksonEmails,
    subject: `New Hub Fund Request: ${createdRequest.requestId}`,
    body: `${payload.requesterName} submitted a Hub Fund Request. Review it in the dashboard.`,
    metadata: { requestId: createdRequest.id }
  });

  revalidatePath("/hub-fund");
  redirect("/hub-fund?submitted=1&toast=Hub+fund+request+submitted+successfully.&toastType=success");
}

export async function reviewRequestAction(formData: FormData) {
  const session = await requireSession();
  const requestId = String(formData.get("requestId") ?? "");
  const action = String(formData.get("action") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      requester: true,
      currentApprover: {
        include: {
          roleAssignments: true
        }
      }
    }
  });

  if (!request) {
    throw new Error("Request not found.");
  }

  const actorRole = resolveWorkflowActorRole(session.user.roles, request.type);

  if (action === "markPaid") {
    if (!isFinanceRole(session.user.roles) || request.paymentStatus !== PaymentStatus.PENDING) {
      throw new Error("You cannot mark this request as paid.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: request.id },
        data: {
          status: RequestStatus.PAID,
          paymentStatus: PaymentStatus.PAID,
          paidAt: new Date(),
          currentApproverId: null
        }
      });

      await tx.approvalAction.create({
        data: {
          requestId: request.id,
          actorId: session.user.id,
          role: Role.BRIAN,
          action: ApprovalActionType.MARKED_PAID,
          comment: comment || "Payment completed"
        }
      });
    });

    await logAudit(session.user.id, "request", request.id, "request.payment_marked", {
      comment
    });

    await notify({
      type: NotificationType.PAYMENT_MARKED,
      recipients: getMarkedPaidNotificationRecipients({
        actorRoles: session.user.roles,
        requestType: request.type,
        requesterEmail: getRequestContactEmail(request)
      }),
      subject: `Payment sent for ${request.requestId}`,
      body: `${REQUEST_TYPE_LABELS[request.type]} for ${getRequesterLabel(request)} has been marked as paid.`,
      metadata: { requestId: request.id }
    });

    revalidatePath("/requests");
    revalidatePath(`/requests/${request.id}`);
    redirect(withToast(`/requests/${request.id}`, "Payment marked as paid."));
    return;
  }

  const isAssignedReviewer =
    request.currentApproverId === session.user.id ||
    request.currentApprover?.roleAssignments.some((assignment) => session.user.roles.includes(assignment.role)) ||
    false;

  if (!isAssignedReviewer) {
    throw new Error("This request is not awaiting your action.");
  }

  if (!canReviewRequest(session.user.roles, request.type, request.status)) {
    throw new Error("You are not allowed to review this request.");
  }

  if (action === "forward") {
    if (!canForwardRequestForActor(request.type, session.user.roles)) {
      throw new Error("You cannot forward this request.");
    }
  }

  if (action === "approve" && !session.user.roles.includes(Role.JAEL)) {
    throw new Error("Only Jael can give final approval.");
  }

  if (action === "reject" && !comment) {
    throw new Error("A rejection reason is required.");
  }

  if (action === "forward") {
    const nextRole = getNextRoleAfterForwardForActor(request.type, session.user.roles);
    if (!nextRole) {
      throw new Error("This request cannot be forwarded.");
    }

    const nextApprover = await findFirstUserByRole(nextRole);
    if (!nextApprover) {
      throw new Error(`No active approver found for role ${nextRole}.`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: request.id },
        data: {
          status: RequestStatus.FORWARDED,
          currentApproverId: nextApprover.id,
          rejectionReason: null
        }
      });

      await tx.approvalAction.create({
        data: {
          requestId: request.id,
          actorId: session.user.id,
          role: actorRole,
          action: ApprovalActionType.FORWARDED,
          comment: comment || "Forwarded for final review"
        }
      });
    });

    await logAudit(session.user.id, "request", request.id, "request.forwarded", {
      nextRole,
      comment
    });

    await notify({
      type: NotificationType.REQUEST_FORWARDED,
      recipients: getForwardNotificationRecipients({
        actorRoles: session.user.roles,
        requestType: request.type,
        nextApproverEmail: nextApprover.email
      }),
      subject: `Request forwarded: ${request.requestId}`,
      body: `${REQUEST_TYPE_LABELS[request.type]} for ${getRequesterLabel(request)} has been forwarded for the next review step.`,
      metadata: { requestId: request.id }
    });

    revalidatePath("/requests");
    revalidatePath(`/requests/${request.id}`);
    redirect(withToast(`/requests/${request.id}`, "Request forwarded successfully."));
    return;
  }

  if (action === "reject") {
    await prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: request.id },
        data: {
          status: RequestStatus.REJECTED,
          currentApproverId: null,
          rejectionReason: comment
        }
      });

      await tx.approvalAction.create({
        data: {
          requestId: request.id,
          actorId: session.user.id,
          role: actorRole,
          action: ApprovalActionType.REJECTED,
          comment
        }
      });
    });

    await logAudit(session.user.id, "request", request.id, "request.rejected", {
      comment
    });

    const brianEmails = await getEmailsByRole(Role.BRIAN);
    const recipients = getRejectionNotificationRecipients({
      actorRoles: session.user.roles,
      requestType: request.type,
      requesterEmail: getRequestContactEmail(request),
      brianEmails
    });

    await notify({
      type: NotificationType.REQUEST_REJECTED,
      recipients,
      subject: `Request rejected: ${request.requestId}`,
      body: `${REQUEST_TYPE_LABELS[request.type]} for ${getRequesterLabel(request)} was rejected.\nReason: ${comment}`,
      metadata: { requestId: request.id }
    });

    revalidatePath("/requests");
    revalidatePath(`/requests/${request.id}`);
    redirect(withToast(`/requests/${request.id}`, "Request rejected successfully."));
    return;
  }

  if (action !== "approve") {
    throw new Error("Unsupported action.");
  }

  const outcome = getApprovalOutcome(request.type);
  let nextApproverId: string | null = null;

  if (outcome.nextApproverRole) {
    const nextApprover = await findFirstUserByRole(outcome.nextApproverRole);
    nextApproverId = nextApprover?.id ?? null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { id: request.id },
      data: {
        status: outcome.status,
        paymentStatus: outcome.paymentStatus,
        currentApproverId: nextApproverId,
        rejectionReason: null,
        approvedAt: new Date()
      }
    });

    await tx.approvalAction.create({
      data: {
        requestId: request.id,
        actorId: session.user.id,
        role: actorRole,
        action: outcome.action,
        comment: comment || "Approved"
      }
    });
  });

  await logAudit(session.user.id, "request", request.id, "request.approved", {
    comment
  });

  const brianEmails = await getEmailsByRole(Role.BRIAN);
  const notifyRecipients = getFinalApprovalNotificationRecipients({
    actorRoles: session.user.roles,
    requestType: request.type,
    requesterEmail: getRequestContactEmail(request),
    brianEmails
  });

  await notify({
    type: NotificationType.FINAL_APPROVAL,
    recipients: notifyRecipients,
    subject: `Request approved: ${request.requestId}`,
    body: `${REQUEST_TYPE_LABELS[request.type]} for ${getRequesterLabel(request)} has been approved.${request.type !== RequestType.LEAVE && outcome.paymentStatus === PaymentStatus.PENDING ? "\nBrian can now process payment." : ""}`,
    metadata: { requestId: request.id }
  });

  revalidatePath("/requests");
  revalidatePath(`/requests/${request.id}`);
  redirect(withToast(`/requests/${request.id}`, "Request approved successfully."));
}

export async function upsertUserAction(formData: FormData) {
  const session = await requirePageRoles([Role.BRIAN, Role.JAEL]);
  const userId = String(formData.get("userId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const isActive = String(formData.get("isActive") ?? "true") === "true";
  const roles = parseRoleList(formData.getAll("roles"));

  if (!email) {
    throw new Error("Email is required.");
  }

  if (roles.length === 0) {
    throw new Error("Select at least one role.");
  }

  const user = await prisma.$transaction(async (tx) => {
    const savedUser = userId
      ? await tx.user.update({
          where: { id: userId },
          data: {
            email,
            name: name || null,
            isActive
          }
        })
      : await tx.user.create({
          data: {
            email,
            name: name || null,
            isActive
          }
        });

    await tx.roleAssignment.deleteMany({
      where: {
        userId: savedUser.id
      }
    });

    await tx.roleAssignment.createMany({
      data: roles.map((role) => ({
        userId: savedUser.id,
        role
      })),
      skipDuplicates: true
    });

    return savedUser;
  });

  await logAudit(session.user.id, "user", user.id, userId ? "user.updated" : "user.created", {
    email,
    roles,
    isActive
  });

  revalidateTag("approved-users");
  revalidatePath("/users");
  revalidatePath("/dashboard");
  redirect(withToast("/users", userId ? "User updated successfully." : "User created successfully."));
}

export async function createVendorAction(formData: FormData) {
  const session = await requirePageRoles([Role.BRIAN]);
  const payload = vendorSchema.parse({
    name: formData.get("name"),
    contactPerson: formData.get("contactPerson"),
    phoneNumber: formData.get("phoneNumber"),
    email: formData.get("email"),
    address: formData.get("address"),
    suppliedItems: formData.get("suppliedItems"),
    notes: formData.get("notes")
  });

  const vendor = await prisma.vendor.create({
    data: {
      vendorId: makeReadableId("VEN"),
      name: payload.name,
      contactPerson: payload.contactPerson || null,
      phoneNumber: payload.phoneNumber || null,
      email: payload.email || null,
      address: payload.address || null,
      suppliedItems: payload.suppliedItems || null,
      notes: payload.notes || null
    }
  });

  await logAudit(session.user.id, "vendor", vendor.id, "vendor.created");
  revalidatePath("/vendors");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  redirect(withToast("/vendors", "Vendor created successfully."));
}

export async function updateVendorAction(formData: FormData) {
  const session = await requirePageRoles([Role.BRIAN]);
  const vendorId = String(formData.get("vendorId") ?? "");
  const payload = vendorSchema.parse({
    name: formData.get("name"),
    contactPerson: formData.get("contactPerson"),
    phoneNumber: formData.get("phoneNumber"),
    email: formData.get("email"),
    address: formData.get("address"),
    suppliedItems: formData.get("suppliedItems"),
    notes: formData.get("notes")
  });

  await prisma.vendor.update({
    where: {
      id: vendorId
    },
    data: {
      name: payload.name,
      contactPerson: payload.contactPerson || null,
      phoneNumber: payload.phoneNumber || null,
      email: payload.email || null,
      address: payload.address || null,
      suppliedItems: payload.suppliedItems || null,
      notes: payload.notes || null
    }
  });

  await logAudit(session.user.id, "vendor", vendorId, "vendor.updated");
  revalidatePath("/vendors");
  revalidatePath("/inventory");
  redirect(withToast("/vendors", "Vendor updated successfully."));
}

export async function createInventoryItemAction(formData: FormData) {
  const session = await requirePageRoles([Role.BRIAN]);
  const payload = inventoryItemSchema.parse({
    name: formData.get("name"),
    category: formData.get("category"),
    description: formData.get("description"),
    quantityInStock: formData.get("quantityInStock"),
    minimumStockThreshold: formData.get("minimumStockThreshold"),
    unitCost: formData.get("unitCost"),
    vendorId: formData.get("vendorId"),
    location: formData.get("location")
  });

  const item = await prisma.inventoryItem.create({
    data: {
      itemId: makeReadableId("INV"),
      name: payload.name,
      category: payload.category,
      description: payload.description || null,
      quantityInStock: payload.quantityInStock,
      minimumStockThreshold: payload.minimumStockThreshold,
      unitCost: payload.unitCost ?? undefined,
      vendorId: payload.vendorId || null,
      location: payload.location || null
    }
  });

  await logAudit(session.user.id, "inventory_item", item.id, "inventory_item.created");
  await maybeSendLowStockAlert(item.id);
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  redirect(withToast("/inventory", "Inventory item created successfully."));
}

export async function createDamageReportAction(formData: FormData) {
  const session = await requirePageRoles([Role.BRIAN, Role.EDMOND, Role.DICKSON]);

  const payload = damageReportSchema.parse({
    itemName: formData.get("itemName"),
    reportType: formData.get("reportType"),
    description: formData.get("description")
  });

  const photo = formData.get("photo");

  const report = await prisma.$transaction(async (tx) => {
    const createdReport = await tx.damageReport.create({
      data: {
        reportId: makeReadableId("REP"),
        itemName: payload.itemName,
        reportType: payload.reportType,
        reportedById: session.user.id,
        description: payload.description,
        dateReported: new Date()
      }
    });

    if (photo instanceof File && photo.size > 0) {
      const storedFile = await saveUploadedFile(photo, AttachmentEntityType.DAMAGE_REPORT, createdReport.id);
      if (storedFile) {
        await tx.attachment.create({
          data: {
            entityType: AttachmentEntityType.DAMAGE_REPORT,
            entityId: createdReport.id,
            damageReportId: createdReport.id,
            uploadedById: session.user.id,
            ...storedFile
          }
        });
      }
    }

    return createdReport;
  });

  await logAudit(session.user.id, "damage_report", report.id, "damage_report.created");
  const brianEmails = await getEmailsByRole(Role.BRIAN);
  await notify({
    type: NotificationType.DAMAGE_REPORTED,
    recipients: brianEmails,
    subject: `New ${payload.reportType.toLowerCase()} item report`,
    body: `A new ${payload.reportType.toLowerCase()} item report has been submitted.`,
    metadata: { reportId: report.id }
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect(withToast("/reports", "Damage report created successfully."));
}

export async function updateDamageReportAction(formData: FormData) {
  const session = await requirePageRoles([Role.BRIAN]);
  const reportId = String(formData.get("reportId") ?? "");
  const status = String(formData.get("status") ?? "") as ReportStatus;
  const resolutionNotes = String(formData.get("resolutionNotes") ?? "").trim();

  if (!Object.values(ReportStatus).includes(status)) {
    throw new Error("Invalid report status.");
  }

  await prisma.damageReport.update({
    where: {
      id: reportId
    },
    data: {
      status,
      resolutionNotes: resolutionNotes || null
    }
  });

  await logAudit(session.user.id, "damage_report", reportId, "damage_report.updated", {
    status,
    resolutionNotes
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect(withToast("/reports", "Damage report updated successfully."));
}

export async function createRentalAction(formData: FormData) {
  const session = await requirePageRoles([Role.EDMOND]);

  const payload = rentalSchema.parse({
    itemId: formData.get("itemId"),
    renterName: formData.get("renterName"),
    renterPhone: formData.get("renterPhone"),
    renterEmail: formData.get("renterEmail"),
    quantityRented: formData.get("quantityRented"),
    rentalStartDate: formData.get("rentalStartDate"),
    expectedReturnDate: formData.get("expectedReturnDate"),
    rentalFee: formData.get("rentalFee"),
    depositAmount: formData.get("depositAmount"),
    paymentStatus: formData.get("paymentStatus"),
    notes: formData.get("notes")
  });
  const rentalStartDate = toDateOrThrow(payload.rentalStartDate, "rental start date");
  const expectedReturnDate = toDateOrThrow(payload.expectedReturnDate, "expected return date");

  if (expectedReturnDate < rentalStartDate) {
    throw new Error("Expected return date cannot be before the rental start date.");
  }

  const agreement = formData.get("agreement");
  const item = await prisma.inventoryItem.findUnique({
    where: { id: payload.itemId }
  });

  if (!item) {
    throw new Error("Inventory item not found.");
  }

  if (item.quantityInStock < payload.quantityRented) {
    throw new Error("Not enough stock available for this rental.");
  }

  const rental = await prisma.$transaction(async (tx) => {
    const createdRental = await tx.rental.create({
      data: {
        rentalId: makeReadableId("RNT"),
        createdById: session.user.id,
        itemId: payload.itemId,
        renterName: payload.renterName,
        renterPhone: payload.renterPhone,
        renterEmail: payload.renterEmail || null,
        quantityRented: payload.quantityRented,
        rentalStartDate,
        expectedReturnDate,
        rentalFee: payload.rentalFee ?? undefined,
        depositAmount: payload.depositAmount ?? undefined,
        paymentStatus: payload.paymentStatus,
        notes: payload.notes || null
      }
    });

    await tx.inventoryItem.update({
      where: { id: payload.itemId },
      data: {
        quantityInStock: {
          decrement: payload.quantityRented
        }
      }
    });

    if (agreement instanceof File && agreement.size > 0) {
      const storedFile = await saveUploadedFile(agreement, AttachmentEntityType.RENTAL, createdRental.id);
      if (storedFile) {
        await tx.attachment.create({
          data: {
            entityType: AttachmentEntityType.RENTAL,
            entityId: createdRental.id,
            rentalId: createdRental.id,
            uploadedById: session.user.id,
            ...storedFile
          }
        });
      }
    }

    return createdRental;
  });

  await logAudit(session.user.id, "rental", rental.id, "rental.created");
  await maybeSendLowStockAlert(item.id);
  revalidatePath("/rentals");
  revalidatePath("/dashboard");
  redirect(withToast("/rentals", "Rental created successfully."));
}

export async function markRentalReturnedAction(formData: FormData) {
  const session = await requirePageRoles([Role.EDMOND]);

  const payload = rentalReturnSchema.parse({
    rentalId: formData.get("rentalId"),
    returnStatus: formData.get("returnStatus"),
    actualReturnDate: formData.get("actualReturnDate"),
    notes: formData.get("notes")
  });
  const actualReturnDate = toDateOrThrow(payload.actualReturnDate, "actual return date");

  const rental = await prisma.rental.findUnique({
    where: { id: payload.rentalId },
    include: {
      item: true
    }
  });

  if (!rental) {
    throw new Error("Rental not found.");
  }

  if (rental.returnStatus !== ReturnStatus.NOT_RETURNED) {
    throw new Error("This rental has already been processed.");
  }

  const increaseStock = payload.returnStatus !== ReturnStatus.MISSING;
  await prisma.$transaction(async (tx) => {
    await tx.rental.update({
      where: { id: rental.id },
      data: {
        returnStatus: payload.returnStatus,
        actualReturnDate,
        notes: payload.notes || rental.notes
      }
    });

    await tx.inventoryItem.update({
      where: { id: rental.itemId },
      data: {
        quantityInStock: increaseStock
          ? {
              increment: rental.quantityRented
            }
          : undefined,
        condition:
          payload.returnStatus === ReturnStatus.RETURNED_DAMAGED
            ? InventoryCondition.DAMAGED
            : payload.returnStatus === ReturnStatus.MISSING
              ? InventoryCondition.MISSING
              : rental.item.condition
      }
    });
  });

  await logAudit(session.user.id, "rental", rental.id, "rental.returned", {
    returnStatus: payload.returnStatus
  });

  const brianEmails = await getEmailsByRole(Role.BRIAN);
  if (payload.returnStatus === ReturnStatus.RETURNED_DAMAGED) {
    await notify({
      type: NotificationType.RENTAL_DAMAGE,
      recipients: brianEmails,
      subject: `Rental returned damaged: ${rental.rentalId}`,
      body: `${rental.rentalId} was returned damaged.`,
      metadata: { rentalId: rental.id }
    });
  }

  if (payload.returnStatus === ReturnStatus.MISSING) {
    await notify({
      type: NotificationType.RENTAL_MISSING,
      recipients: brianEmails,
      subject: `Rental item missing: ${rental.rentalId}`,
      body: `${rental.rentalId} has been marked missing.`,
      metadata: { rentalId: rental.id }
    });
  }

  revalidatePath("/rentals");
  revalidatePath("/dashboard");
  redirect(withToast("/rentals", "Rental return updated successfully."));
}

export async function triggerAlertsAction() {
  const session = await requirePageRoles([Role.BRIAN]);

  const summary = await runScheduledAlerts();

  await logAudit(session.user.id, "system", "alerts", "alerts.triggered", {
    overdueCount: summary.overdueCount,
    lowStockCount: summary.lowStockCount
  });

  revalidatePath("/dashboard");
}

export async function sendTestEmailAction(formData: FormData) {
  const session = await requirePageRoles([Role.BRIAN]);
  const requestedEmail = String(formData.get("testEmail") ?? "").trim();
  const recipient = requestedEmail || session.user.email;

  try {
    await sendEmail({
      to: recipient,
      subject: "OFWA Operations test email",
      text: `This is a test email from OFWA Operations.\n\nSent at: ${new Date().toISOString()}\nRecipient: ${recipient}`,
      strict: true
    });

    await logAudit(session.user.id, "system", "email", "email.test_sent", {
      recipient
    });

    redirect(withToast("/dashboard", "Test email sent successfully."));
  } catch (error) {
    await logAudit(session.user.id, "system", "email", "email.test_failed", {
      recipient,
      error: error instanceof Error ? error.message : "Unknown error"
    });

    redirect(withToast("/dashboard", "Test email failed. Check SMTP/domain settings.", "error"));
  }
}

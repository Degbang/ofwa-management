import test from "node:test";
import assert from "node:assert/strict";
import { PaymentStatus, RequestType, Role } from "@prisma/client";
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
  getSubmissionStatus,
  isPhaseOneInternalRequestType
} from "@/lib/request-flow";

test("Phase 1 internal request types are limited to cash and leave", () => {
  assert.equal(isPhaseOneInternalRequestType(RequestType.CASH_DISBURSEMENT), true);
  assert.equal(isPhaseOneInternalRequestType(RequestType.LEAVE), true);
  assert.equal(isPhaseOneInternalRequestType(RequestType.HUB_FUND), false);
  assert.equal(isPhaseOneInternalRequestType(RequestType.REIMBURSEMENT), false);
  assert.equal(isPhaseOneInternalRequestType(RequestType.GENERAL), false);
});

test("initial approvers and submission statuses follow the OFWA workflow", () => {
  assert.equal(getInitialApproverRole(RequestType.LEAVE), Role.JAEL);
  assert.equal(getInitialApproverRole(RequestType.CASH_DISBURSEMENT), Role.BRIAN);
  assert.equal(getInitialApproverRole(RequestType.HUB_FUND), Role.DICKSON);

  assert.equal(getSubmissionStatus(RequestType.LEAVE), "UNDER_REVIEW");
  assert.equal(getSubmissionStatus(RequestType.CASH_DISBURSEMENT), "SUBMITTED");
  assert.equal(getSubmissionStatus(RequestType.HUB_FUND), "SUBMITTED");
});

test("forwarding rules match cash and hub approval paths", () => {
  assert.equal(getNextRoleAfterForwardForActor(RequestType.CASH_DISBURSEMENT, [Role.BRIAN]), Role.JAEL);
  assert.equal(getNextRoleAfterForwardForActor(RequestType.HUB_FUND, [Role.DICKSON]), Role.BRIAN);
  assert.equal(getNextRoleAfterForwardForActor(RequestType.HUB_FUND, [Role.BRIAN]), Role.JAEL);
  assert.equal(getNextRoleAfterForwardForActor(RequestType.LEAVE, [Role.JAEL]), null);

  assert.equal(canForwardRequestForActor(RequestType.CASH_DISBURSEMENT, [Role.BRIAN]), true);
  assert.equal(canForwardRequestForActor(RequestType.HUB_FUND, [Role.DICKSON]), true);
  assert.equal(canForwardRequestForActor(RequestType.HUB_FUND, [Role.BRIAN]), true);
  assert.equal(canForwardRequestForActor(RequestType.LEAVE, [Role.JAEL]), false);
});

test("payment state and final approval outcome are correct", () => {
  assert.equal(getPaymentStatus(RequestType.LEAVE), PaymentStatus.NOT_APPLICABLE);
  assert.equal(getPaymentStatus(RequestType.CASH_DISBURSEMENT), PaymentStatus.PENDING);
  assert.equal(getPaymentStatus(RequestType.HUB_FUND), PaymentStatus.PENDING);

  const leaveOutcome = getApprovalOutcome(RequestType.LEAVE);
  assert.equal(leaveOutcome.nextApproverRole, null);
  assert.equal(leaveOutcome.paymentStatus, PaymentStatus.NOT_APPLICABLE);

  const cashOutcome = getApprovalOutcome(RequestType.CASH_DISBURSEMENT);
  assert.equal(cashOutcome.nextApproverRole, Role.BRIAN);
  assert.equal(cashOutcome.paymentStatus, PaymentStatus.PENDING);

  const hubOutcome = getApprovalOutcome(RequestType.HUB_FUND);
  assert.equal(hubOutcome.nextApproverRole, Role.BRIAN);
  assert.equal(hubOutcome.paymentStatus, PaymentStatus.PENDING);
});

test("notification recipient rules match rejection, final approval, forwarding, and payment requirements", () => {
  assert.deepEqual(
    getForwardNotificationRecipients({
      actorRoles: [Role.BRIAN],
      requestType: RequestType.CASH_DISBURSEMENT,
      nextApproverEmail: "jael@ofwa.org"
    }),
    ["jael@ofwa.org"]
  );

  assert.deepEqual(
    getRejectionNotificationRecipients({
      actorRoles: [Role.DICKSON],
      requestType: RequestType.HUB_FUND,
      requesterEmail: "requester@example.org",
      brianEmails: ["brian@ofwa.org"]
    }),
    ["requester@example.org"]
  );

  assert.deepEqual(
    getRejectionNotificationRecipients({
      actorRoles: [Role.BRIAN],
      requestType: RequestType.CASH_DISBURSEMENT,
      requesterEmail: "requester@example.org",
      brianEmails: ["brian@ofwa.org"]
    }),
    ["requester@example.org"]
  );

  assert.deepEqual(
    getRejectionNotificationRecipients({
      actorRoles: [Role.JAEL],
      requestType: RequestType.LEAVE,
      requesterEmail: "requester@example.org",
      brianEmails: ["brian@ofwa.org"]
    }),
    ["requester@example.org"]
  );

  assert.deepEqual(
    getRejectionNotificationRecipients({
      actorRoles: [Role.JAEL],
      requestType: RequestType.HUB_FUND,
      requesterEmail: "requester@example.org",
      brianEmails: ["brian@ofwa.org"]
    }),
    ["requester@example.org", "brian@ofwa.org"]
  );

  assert.deepEqual(
    getFinalApprovalNotificationRecipients({
      actorRoles: [Role.JAEL],
      requestType: RequestType.LEAVE,
      requesterEmail: "requester@example.org",
      brianEmails: ["brian@ofwa.org"]
    }),
    ["requester@example.org"]
  );

  assert.deepEqual(
    getFinalApprovalNotificationRecipients({
      actorRoles: [Role.JAEL],
      requestType: RequestType.CASH_DISBURSEMENT,
      requesterEmail: "requester@example.org",
      brianEmails: ["brian@ofwa.org"]
    }),
    ["requester@example.org", "brian@ofwa.org"]
  );

  assert.deepEqual(
    getMarkedPaidNotificationRecipients({
      actorRoles: [Role.BRIAN],
      requestType: RequestType.CASH_DISBURSEMENT,
      requesterEmail: "requester@example.org"
    }),
    ["requester@example.org"]
  );
});

test("hub fund totals are calculated from the budget fields", () => {
  assert.equal(
    calculateHubFundTotal({
      foodBudget: 100,
      waterBudget: 20,
      venueBudget: 40,
      facilitatorsBudget: 50,
      dataBudget: 10,
      otherCostsBudget: 5
    }),
    225
  );

  assert.equal(
    calculateHubFundTotal({
      foodBudget: null,
      waterBudget: 0,
      venueBudget: null,
      facilitatorsBudget: 30,
      dataBudget: undefined,
      otherCostsBudget: 0
    }),
    30
  );
});

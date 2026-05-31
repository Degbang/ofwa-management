import Link from "next/link";
import { PaymentStatus, RequestStatus, RequestType, Role } from "@prisma/client";
import { StatusBadge } from "@/components/status-badge";
import { REQUEST_TYPE_LABELS, ROLE_LABELS } from "@/lib/constants";
import { reviewRequestAction } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { canReviewRequest, hasRole, isDeveloperViewerEmail } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

const REQUEST_FIELD_LABELS: Record<string, string> = {
  amount: "Amount",
  dataBudget: "Data / internet budget",
  eventDate: "Event date",
  eventName: "Event name",
  facilitatorsBudget: "Facilitators budget",
  foodBudget: "Food budget",
  hubName: "Hub / Club",
  mobileMoneyName: "Mobile Money name",
  mobileMoneyNumber: "Mobile Money number",
  notes: "Notes",
  otherCostsBudget: "Other costs budget",
  otherCostsDescription: "Other costs description",
  participants: "Number of participants",
  paymentMethod: "Payment method",
  requesterEmail: "Requester email",
  requesterName: "Requester name",
  requesterPhone: "Requester phone number",
  totalBudget: "Total calculated budget",
  venueBudget: "Venue budget",
  waterBudget: "Water budget"
};

const HIDDEN_REQUEST_FIELDS = new Set([
  "description",
  "requestType",
  "title"
]);

function formatRequestFieldValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function canViewRequestWithEmail(
  email: string,
  userId: string,
  roles: Role[],
  request: {
    requesterId: string | null;
    currentApproverId: string | null;
    type: RequestType;
    status: RequestStatus;
    paymentStatus: PaymentStatus;
  }
) {
  if (isDeveloperViewerEmail(email)) {
    return true;
  }

  if (request.requesterId === userId) {
    return true;
  }

  if (request.currentApproverId === userId) {
    return true;
  }

  if (
    request.status === RequestStatus.APPROVED &&
    request.paymentStatus === PaymentStatus.PENDING &&
    hasRole(roles, [Role.BRIAN])
  ) {
    return true;
  }

  return false;
}

export default async function RequestDetailPage({ params }: { params: { requestId: string } }) {
  const session = await requireSession();
  const request = await prisma.request.findUnique({
    where: {
      id: params.requestId
    },
    include: {
      requester: true,
      currentApprover: true,
      approvals: {
        include: {
          actor: true
        },
        orderBy: {
          createdAt: "asc"
        }
      },
      attachments: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  if (!request || !canViewRequestWithEmail(session.user.email, session.user.id, session.user.roles, request)) {
    return (
      <div className="page">
        <div className="table-card">
          <h1>Request not available</h1>
          <p className="muted">You do not have access to this request.</p>
        </div>
      </div>
    );
  }

  const requestPayload = request.payload as Record<string, string | number | null | undefined>;
  const requestFields = Object.entries(requestPayload)
    .filter(([key]) => !HIDDEN_REQUEST_FIELDS.has(key))
    .map(([key, value]) => ({
      key,
      label:
        REQUEST_FIELD_LABELS[key] ??
        key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (letter) => letter.toUpperCase()),
      value: formatRequestFieldValue(value)
    }));
  const isCurrentApprover = request.currentApproverId === session.user.id;
  const canMarkPaid =
    session.user.roles.includes(Role.BRIAN) &&
    request.paymentStatus === PaymentStatus.PENDING &&
    request.status === RequestStatus.APPROVED;
  const reviewerCanAct = isCurrentApprover && canReviewRequest(session.user.roles, request.type, request.status);
  const showForward = reviewerCanAct && hasRole(session.user.roles, [Role.BRIAN, Role.DICKSON]) && request.type !== RequestType.LEAVE;
  const showApprove = reviewerCanAct && hasRole(session.user.roles, [Role.JAEL]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Request</p>
          <h1>{request.title}</h1>
          <p>{REQUEST_TYPE_LABELS[request.type]}</p>
        </div>
        <Link className="button button-secondary" href="/dashboard">
          Back to dashboard
        </Link>
      </div>

      <section className="grid grid-3">
        <div className="card fact-card">
          <p className="muted">Requester</p>
          <strong>{request.requester?.name ?? request.externalName ?? request.requester?.email ?? request.externalEmail}</strong>
          <p className="muted">{request.requester?.email ?? request.externalEmail ?? "-"}</p>
          {request.externalPhone ? <p className="muted">{request.externalPhone}</p> : null}
        </div>
        <div className="card fact-card">
          <p className="muted">Status</p>
          <StatusBadge>{request.status.replaceAll("_", " ")}</StatusBadge>
          <p className="muted">Payment: {request.paymentStatus.replaceAll("_", " ")}</p>
        </div>
        <div className="card fact-card">
          <p className="muted">Current approver</p>
          <strong>{request.currentApprover?.name ?? request.currentApprover?.email ?? "None"}</strong>
          {request.rejectionReason ? <p className="muted">Rejection reason: {request.rejectionReason}</p> : null}
        </div>
      </section>

      <section className="table-card stack">
        <div className="section-header">
          <div>
            <h2>{request.title}</h2>
            <p>{request.description}</p>
          </div>
        </div>

        <div className="two-column">
          <div className="card fact-card">
            <p className="muted">Amount</p>
            <strong>{formatCurrency(request.amount?.toString())}</strong>
          </div>
          <div className="card fact-card">
            <p className="muted">Dates</p>
            <p>Created: {formatDateTime(request.createdAt)}</p>
            <p>Updated: {formatDateTime(request.updatedAt)}</p>
          </div>
        </div>

        <div>
          <h3>Request details</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {requestFields.length === 0 ? (
                <tr>
                  <td className="muted" colSpan={2}>
                    No extra request details were submitted.
                  </td>
                </tr>
              ) : (
                requestFields.map((field) => (
                  <tr key={field.key}>
                    <td>{field.label}</td>
                    <td>{field.value}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div>
          <h3>Attachments</h3>
          {request.attachments.length === 0 ? (
            <div className="empty-state">No attachments uploaded.</div>
          ) : (
            <div className="stack">
              {request.attachments.map((attachment) => (
                <Link href={`/api/uploads/${attachment.id}`} key={attachment.id}>
                  {attachment.originalName}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {(showForward || showApprove || reviewerCanAct || canMarkPaid) && (
        <section className="table-card">
          <div className="section-header">
            <div>
              <h2>Action</h2>
              <p className="muted">Forward, approve, reject, or mark payment depending on your role and this request status.</p>
            </div>
          </div>
          <form action={reviewRequestAction} className="form-grid form-grid-2">
            <input name="requestId" type="hidden" value={request.id} />
            <label className="field-full">
              Comment / reason
              <textarea name="comment" placeholder="Required for rejection. Optional for approvals and forwarding." />
            </label>
            <div className="button-row field-full">
              {showForward && (
                <button className="button button-secondary" name="action" type="submit" value="forward">
                  Forward
                </button>
              )}
              {showApprove && (
                <button className="button button-primary" name="action" type="submit" value="approve">
                  Approve
                </button>
              )}
              {reviewerCanAct && (
                <button className="button button-danger" name="action" type="submit" value="reject">
                  Reject
                </button>
              )}
              {canMarkPaid && (
                <button className="button button-primary" name="action" type="submit" value="markPaid">
                  Mark payment made
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      <section className="table-card">
        <div className="section-header">
          <div>
            <h2>Approval history</h2>
            <p className="muted">Full approval trail for this request.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Actor</th>
                <th>Role</th>
                <th>Action</th>
                <th>Comment / reason</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {request.approvals.map((approval) => (
                <tr key={approval.id}>
                  <td>{approval.actor.name ?? approval.actor.email}</td>
                  <td>{ROLE_LABELS[approval.role]}</td>
                  <td>{approval.action.replaceAll("_", " ")}</td>
                  <td>{approval.comment || "-"}</td>
                  <td>{formatDateTime(approval.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";
import { RequestType } from "@prisma/client";
import { HUB_OPTIONS, REQUEST_TYPE_LABELS } from "@/lib/constants";

export function RequestTypeSelector({
  renderHubFundLink = true
}: {
  renderHubFundLink?: boolean;
}) {
  const [selectedType, setSelectedType] = useState<RequestType>(RequestType.CASH_DISBURSEMENT);

  return (
    <div className="request-selector">
      <div className="request-option-card">
        <div className="selector-head">
          <div>
            <p className="eyebrow">Request Type</p>
            <h3>Choose what you need</h3>
          </div>
          <label className="selector-control">
            <span className="visually-hidden">Request type</span>
            <select
              onChange={(event) => setSelectedType(event.target.value as RequestType)}
              value={selectedType}
            >
              <option value={RequestType.CASH_DISBURSEMENT}>{REQUEST_TYPE_LABELS.CASH_DISBURSEMENT}</option>
              <option value={RequestType.LEAVE}>{REQUEST_TYPE_LABELS.LEAVE}</option>
            </select>
          </label>
        </div>
        {renderHubFundLink ? (
          <p className="request-type-note">
            Hub Fund Requests are submitted through the public volunteer form.
          </p>
        ) : null}
      </div>

      {selectedType === RequestType.CASH_DISBURSEMENT ? <CashDisbursementFields /> : null}
      {selectedType === RequestType.LEAVE ? <LeaveFields /> : null}
    </div>
  );
}

export function CashDisbursementFields() {
  return (
    <div className="request-option-card request-form-card">
      <input name="requestType" type="hidden" value="CASH_DISBURSEMENT" />
      <div className="form-block-header">
        <p className="eyebrow">Cash Request</p>
        <h3>Disbursement submission</h3>
      </div>
      <div className="request-grid">
        <label>
          Amount requested
          <input min="0" name="amount" required step="0.01" type="number" />
        </label>
        <label>
          Mobile Money number
          <input name="mobileMoneyNumber" required />
        </label>
        <label>
          Mobile Money name
          <input name="mobileMoneyName" required />
        </label>
        <label className="field-span-3">
          Reason
          <textarea name="description" required />
        </label>
        <label>
          Attachment
          <input accept=".pdf,.jpg,.jpeg,.png,.docx" name="attachment" type="file" />
        </label>
        <label className="field-span-2">
          Other notes
          <textarea name="notes" />
        </label>
      </div>
      <div className="form-actions">
        <button className="button button-primary" type="submit">
          Submit cash request
        </button>
      </div>
    </div>
  );
}

export function HubFundFields() {
  return (
    <div className="request-option-card request-form-card">
      <input name="requestType" type="hidden" value="HUB_FUND" />
      <div className="form-block-header">
        <p className="eyebrow">Hub Fund</p>
        <h3>Event and budget request</h3>
      </div>
      <div className="request-grid">
        <label>
          Your name
          <input name="requesterName" required />
        </label>
        <label>
          Your email
          <input name="requesterEmail" required type="email" />
        </label>
        <label>
          Your phone number
          <input name="requesterPhone" required />
        </label>
        <label>
          Hub / Club
          <select name="hubName" required>
            {HUB_OPTIONS.map((hub) => (
              <option key={hub} value={hub}>
                {hub}
              </option>
            ))}
          </select>
        </label>
        <label>
          Event name
          <input name="eventName" required />
        </label>
        <label>
          Event date
          <input name="eventDate" required type="date" />
        </label>
        <label>
          Number of participants
          <input min="1" name="participants" required type="number" />
        </label>
        <label>
          Food budget
          <input min="0" name="foodBudget" step="0.01" type="number" />
        </label>
        <label>
          Water budget
          <input min="0" name="waterBudget" step="0.01" type="number" />
        </label>
        <label>
          Venue budget
          <input min="0" name="venueBudget" step="0.01" type="number" />
        </label>
        <label>
          Facilitators budget
          <input min="0" name="facilitatorsBudget" step="0.01" type="number" />
        </label>
        <label>
          Data / internet budget
          <input min="0" name="dataBudget" step="0.01" type="number" />
        </label>
        <label>
          Other costs budget
          <input min="0" name="otherCostsBudget" step="0.01" type="number" />
        </label>
        <label className="field-span-2">
          Other costs description
          <textarea name="otherCostsDescription" />
        </label>
        <label>
          Mobile Money number
          <input name="mobileMoneyNumber" required />
        </label>
        <label>
          Mobile Money name
          <input name="mobileMoneyName" required />
        </label>
        <label>
          Attachment
          <input accept=".pdf,.jpg,.jpeg,.png,.docx" name="attachment" type="file" />
        </label>
        <label className="field-span-2">
          Other concerns
          <textarea name="notes" />
        </label>
      </div>
      <div className="form-actions">
        <button className="button button-primary" type="submit">
          Submit hub fund request
        </button>
      </div>
    </div>
  );
}

export function ReimbursementFields() {
  return (
    <div className="request-option-card request-form-card">
      <input name="requestType" type="hidden" value="REIMBURSEMENT" />
      <div className="form-block-header">
        <p className="eyebrow">Reimbursement</p>
        <h3>Recover approved expenses</h3>
      </div>
      <div className="request-grid">
        <label className="field-span-2">
          Request title
          <input name="title" required />
        </label>
        <label>
          Amount spent
          <input min="0" name="amount" required step="0.01" type="number" />
        </label>
        <label className="field-span-3">
          Description / reason
          <textarea name="description" required />
        </label>
        <label>
          Payment method
          <input name="paymentMethod" required />
        </label>
        <label>
          Mobile Money number
          <input name="mobileMoneyNumber" required />
        </label>
        <label>
          Mobile Money name
          <input name="mobileMoneyName" required />
        </label>
        <label>
          Receipt upload
          <input accept=".pdf,.jpg,.jpeg,.png,.docx" name="attachment" required type="file" />
        </label>
        <label className="field-span-2">
          Other notes
          <textarea name="notes" />
        </label>
      </div>
      <div className="form-actions">
        <button className="button button-primary" type="submit">
          Submit reimbursement
        </button>
      </div>
    </div>
  );
}

export function LeaveFields() {
  return (
    <div className="request-option-card request-form-card">
      <input name="requestType" type="hidden" value="LEAVE" />
      <div className="form-block-header">
        <p className="eyebrow">Leave</p>
        <h3>Time-off request</h3>
      </div>
      <div className="request-grid">
        <label className="field-span-3">
          Leave reason
          <textarea name="description" required />
        </label>
        <label>
          Leave start date
          <input name="leaveStartDate" required type="date" />
        </label>
        <label>
          Leave end date
          <input name="leaveEndDate" required type="date" />
        </label>
        <label>
          Attachment
          <input accept=".pdf,.jpg,.jpeg,.png,.docx" name="attachment" type="file" />
        </label>
        <label className="field-span-3">
          Other notes
          <textarea name="notes" />
        </label>
      </div>
      <div className="form-actions">
        <button className="button button-primary" type="submit">
          Submit leave request
        </button>
      </div>
    </div>
  );
}

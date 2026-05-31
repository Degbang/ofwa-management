import { createRequestAction } from "@/lib/actions";
import { RequestTypeSelector } from "@/components/requests/request-forms";
import Link from "next/link";

export default function NewRequestPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Request Dashboard</p>
          <h1>Submit a new request</h1>
          <p>Choose leave or cash disbursement. Once submitted, requests become read-only.</p>
        </div>
        <Link className="button button-secondary" href="/hub-fund">
          Public Hub Fund Form
        </Link>
      </div>

      <section className="hero-panel">
        <div>
          <p className="eyebrow">Internal Requests</p>
          <h2>Staff request centre</h2>
          <p className="muted">
            Cash disbursement and leave requests stay behind staff login. Hub Fund stays public for volunteers and external contributors.
          </p>
        </div>
      </section>

      <section className="form-shell">
        <form action={createRequestAction}>
          <RequestTypeSelector />
        </form>
      </section>
    </div>
  );
}

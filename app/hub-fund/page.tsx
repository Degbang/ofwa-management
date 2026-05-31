import Image from "next/image";
import { createPublicHubFundRequestAction } from "@/lib/actions";
import { HubFundFields } from "@/components/requests/request-forms";

export default function PublicHubFundPage() {
  return (
    <div className="page">
      <section className="hub-public-hero">
        <div className="hub-public-copy">
          <div className="hub-public-brand">
            <Image alt="OFWA logo" className="brand-logo brand-logo-public" height={116} priority src="/ofwa-logo.png" width={116} />
            <div>
              <p className="eyebrow">OFWA</p>
              <h1>Hub Fund Request</h1>
              <p className="muted">Submit the event details and budget lines for hub or club support.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="form-shell form-shell-public">
        <div className="form-block-header">
          <p className="eyebrow">Submission Form</p>
          <h2>Share the event and budget details</h2>
          <p className="muted">All required fields should be completed before submitting.</p>
        </div>
        <form action={createPublicHubFundRequestAction}>
          <HubFundFields />
        </form>
      </section>
    </div>
  );
}

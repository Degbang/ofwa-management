import Link from "next/link";
import { RequestType, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requirePageRoles } from "@/lib/session";

type HubRequestPayload = {
  eventDate?: string;
  eventName?: string;
  hubName?: string;
  requesterName?: string;
};

export default async function HubRequestsPage() {
  await requirePageRoles([Role.EDMOND]);

  const hubRequests = await prisma.request.findMany({
    where: {
      type: RequestType.HUB_FUND
    },
    select: {
      id: true,
      requestId: true,
      submittedAt: true,
      externalName: true,
      payload: true
    },
    orderBy: {
      submittedAt: "desc"
    }
  });

  return (
    <div className="page">
      <section className="table-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Media Planning</p>
            <h2>Hub request schedule</h2>
            <p className="muted">Upcoming hub events and requesters for photography planning.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Event name</th>
                <th>Hub</th>
                <th>Requester</th>
                <th>Request</th>
              </tr>
            </thead>
            <tbody>
              {hubRequests.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">No hub requests submitted yet.</div>
                  </td>
                </tr>
              ) : (
                hubRequests.map((request) => {
                  const payload = request.payload as HubRequestPayload;
                  return (
                    <tr key={request.id}>
                      <td>{formatDate(payload.eventDate ?? request.submittedAt)}</td>
                      <td>{payload.eventName ?? "-"}</td>
                      <td>{payload.hubName ?? "-"}</td>
                      <td>{payload.requesterName ?? request.externalName ?? "-"}</td>
                      <td>
                        <Link href={`/requests/${request.id}`}>{request.requestId}</Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

import { NextResponse } from "next/server";
import { runScheduledAlerts } from "@/lib/services/alerts";

function isAuthorized(request: Request) {
  const secret = process.env.ALERT_CRON_SECRET;
  if (!secret) {
    return false;
  }

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const authHeader = request.headers.get("authorization");
  return querySecret === secret || authHeader === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScheduledAlerts();
  return NextResponse.json({
    ok: true,
    ...result
  });
}

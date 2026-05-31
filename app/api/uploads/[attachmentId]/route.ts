import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { attachmentId: string } }) {
  const [{ prisma }, { readStoredFile }] = await Promise.all([import("@/lib/db"), import("@/lib/services/storage")]);
  const user = await requireApiSession();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const attachment = await prisma.attachment.findUnique({
    where: {
      id: params.attachmentId
    },
    include: {
      request: true,
      damageReport: true,
      rental: true
    }
  });

  if (!attachment) {
    return new NextResponse("Not found", { status: 404 });
  }

  let allowed = false;

  if (attachment.request) {
    allowed =
      attachment.request.requesterId === user.id ||
      user.roles.some((role) => role === Role.BRIAN || role === Role.JAEL || role === Role.DICKSON);
  }

  if (attachment.damageReport || attachment.rental) {
    allowed = user.roles.some((role) => role === Role.BRIAN || role === Role.EDMOND);
  }

  if (!allowed) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const fileBuffer = await readStoredFile(attachment.storagePath);
  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `inline; filename="${attachment.originalName}"`
    }
  });
}

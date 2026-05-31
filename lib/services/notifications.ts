import { NotificationType, Prisma, Role } from "@prisma/client";
import { getConfiguredEmailsByRole } from "@/lib/configured-users";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/services/email";

type NotifyInput = {
  type: NotificationType;
  recipients: string[];
  subject: string;
  body: string;
  metadata?: Prisma.InputJsonValue;
};

export async function notify({ type, recipients, subject, body, metadata }: NotifyInput) {
  const uniqueRecipients = [...new Set(recipients.filter(Boolean))];
  if (uniqueRecipients.length === 0) {
    return;
  }

  await sendEmail({
    to: uniqueRecipients,
    subject,
    text: body
  });

  await prisma.notificationLog.createMany({
    data: uniqueRecipients.map((recipient) => ({
      type,
      recipient,
      subject,
      body,
      metadata
    }))
  });
}

export async function getEmailsByRole(role: Role) {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      roleAssignments: {
        some: {
          role
        }
      }
    },
    select: {
      email: true
    }
  });

  return [...new Set([...users.map((user) => user.email), ...getConfiguredEmailsByRole(role)])];
}

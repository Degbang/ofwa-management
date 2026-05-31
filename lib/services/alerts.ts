import { NotificationType, Role, ReturnStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getEmailsByRole, notify } from "@/lib/services/notifications";

export async function runScheduledAlerts() {
  const overdueRentals = await prisma.rental.findMany({
    where: {
      returnStatus: ReturnStatus.NOT_RETURNED,
      expectedReturnDate: {
        lt: new Date()
      }
    }
  });

  const lowStockItems = (await prisma.inventoryItem.findMany()).filter(
    (item) => item.quantityInStock <= item.minimumStockThreshold
  );

  const [edmondEmails, brianEmails] = await Promise.all([getEmailsByRole(Role.EDMOND), getEmailsByRole(Role.BRIAN)]);

  for (const rental of overdueRentals) {
    await notify({
      type: NotificationType.RENTAL_OVERDUE,
      recipients: edmondEmails,
      subject: `Overdue rental: ${rental.rentalId}`,
      body: `${rental.rentalId} is overdue and needs follow-up.`,
      metadata: {
        rentalId: rental.id
      }
    });
  }

  for (const item of lowStockItems) {
    await notify({
      type: NotificationType.LOW_STOCK,
      recipients: brianEmails,
      subject: `Low stock: ${item.name}`,
      body: `${item.name} is at ${item.quantityInStock} item(s), which is at or below the threshold of ${item.minimumStockThreshold}.`,
      metadata: {
        inventoryItemId: item.id
      }
    });
  }

  return {
    overdueCount: overdueRentals.length,
    lowStockCount: lowStockItems.length
  };
}

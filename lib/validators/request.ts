import { RequestType } from "@prisma/client";
import { z } from "zod";
import { HUB_OPTIONS } from "@/lib/constants";
import { moneySchema, optionalMoneySchema } from "@/lib/validators/common";

const cashDisbursementSchema = z.object({
  requestType: z.literal(RequestType.CASH_DISBURSEMENT),
  description: z.string().trim().min(3).max(3000),
  amount: moneySchema,
  mobileMoneyNumber: z.string().trim().min(5).max(30),
  mobileMoneyName: z.string().trim().min(2).max(120),
  notes: z.string().trim().optional()
});

const leaveRequestSchema = z.object({
  requestType: z.literal(RequestType.LEAVE),
  title: z.literal("Leave Request"),
  description: z.string().trim().min(3).max(3000),
  leaveStartDate: z.string().trim().min(1),
  leaveEndDate: z.string().trim().min(1),
  notes: z.string().trim().optional()
});

const hubFundSchema = z.object({
  requestType: z.literal(RequestType.HUB_FUND),
  requesterName: z.string().trim().min(2).max(120),
  requesterEmail: z.string().trim().email(),
  requesterPhone: z.string().trim().min(5).max(40),
  hubName: z.enum(HUB_OPTIONS),
  eventName: z.string().trim().min(2).max(120),
  eventDate: z.string().trim().min(1),
  participants: z.coerce.number().int().min(1).max(10000),
  foodBudget: optionalMoneySchema,
  waterBudget: optionalMoneySchema,
  venueBudget: optionalMoneySchema,
  facilitatorsBudget: optionalMoneySchema,
  dataBudget: optionalMoneySchema,
  otherCostsDescription: z.string().trim().optional(),
  otherCostsBudget: optionalMoneySchema,
  mobileMoneyNumber: z.string().trim().min(5).max(30),
  mobileMoneyName: z.string().trim().min(2).max(120),
  notes: z.string().trim().optional()
});

export const requestSchema = z.discriminatedUnion("requestType", [
  cashDisbursementSchema,
  leaveRequestSchema,
  hubFundSchema
]);

export function parseRequestFormData(formData: FormData) {
  const requestType = String(formData.get("requestType") ?? "");

  if (requestType === RequestType.LEAVE) {
    return leaveRequestSchema.parse({
      requestType,
      title: "Leave Request",
      description: formData.get("description"),
      leaveStartDate: formData.get("leaveStartDate"),
      leaveEndDate: formData.get("leaveEndDate"),
      notes: formData.get("notes")
    });
  }

  if (requestType === RequestType.HUB_FUND) {
    return hubFundSchema.parse({
      requestType,
      requesterName: formData.get("requesterName"),
      requesterEmail: formData.get("requesterEmail"),
      requesterPhone: formData.get("requesterPhone"),
      hubName: formData.get("hubName"),
      eventName: formData.get("eventName"),
      eventDate: formData.get("eventDate"),
      participants: formData.get("participants"),
      foodBudget: formData.get("foodBudget"),
      waterBudget: formData.get("waterBudget"),
      venueBudget: formData.get("venueBudget"),
      facilitatorsBudget: formData.get("facilitatorsBudget"),
      dataBudget: formData.get("dataBudget"),
      otherCostsDescription: formData.get("otherCostsDescription"),
      otherCostsBudget: formData.get("otherCostsBudget"),
      mobileMoneyNumber: formData.get("mobileMoneyNumber"),
      mobileMoneyName: formData.get("mobileMoneyName"),
      notes: formData.get("notes")
    });
  }

  if (requestType === RequestType.CASH_DISBURSEMENT) {
    return cashDisbursementSchema.parse({
      requestType,
      description: formData.get("description"),
      amount: formData.get("amount"),
      mobileMoneyNumber: formData.get("mobileMoneyNumber"),
      mobileMoneyName: formData.get("mobileMoneyName"),
      notes: formData.get("notes")
    });
  }

  throw new Error("Unsupported request type.");
}

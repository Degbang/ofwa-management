import { ReportStatus, ReportType } from "@prisma/client";
import { z } from "zod";
import { optionalMoneySchema } from "@/lib/validators/common";

export const vendorSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contactPerson: z.string().trim().optional(),
  phoneNumber: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  address: z.string().trim().optional(),
  suppliedItems: z.string().trim().optional(),
  notes: z.string().trim().optional()
});

export const inventoryItemSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(120),
  description: z.string().trim().optional(),
  quantityInStock: z.coerce.number().int().min(0),
  minimumStockThreshold: z.coerce.number().int().min(0),
  unitCost: optionalMoneySchema,
  vendorId: z.string().trim().optional(),
  location: z.string().trim().optional()
});

export const damageReportSchema = z.object({
  itemName: z.string().trim().min(2).max(160),
  reportType: z.nativeEnum(ReportType),
  description: z.string().trim().min(5).max(2000),
  status: z.nativeEnum(ReportStatus).default(ReportStatus.REPORTED),
  resolutionNotes: z.string().trim().optional()
});

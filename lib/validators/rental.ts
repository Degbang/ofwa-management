import { ReturnStatus } from "@prisma/client";
import { z } from "zod";
import { optionalMoneySchema } from "@/lib/validators/common";

export const rentalSchema = z.object({
  itemId: z.string().trim().min(1),
  renterName: z.string().trim().min(2).max(120),
  renterPhone: z.string().trim().min(5).max(30),
  renterEmail: z.string().trim().email().optional().or(z.literal("")),
  quantityRented: z.coerce.number().int().min(1),
  rentalStartDate: z.string().trim().min(1),
  expectedReturnDate: z.string().trim().min(1),
  rentalFee: optionalMoneySchema,
  depositAmount: optionalMoneySchema,
  paymentStatus: z.string().trim().min(2).max(60),
  notes: z.string().trim().optional()
});

export const rentalReturnSchema = z.object({
  rentalId: z.string().trim().min(1),
  returnStatus: z.nativeEnum(ReturnStatus),
  actualReturnDate: z.string().trim().min(1),
  notes: z.string().trim().optional()
});

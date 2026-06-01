import path from "node:path";
import { z } from "zod";
import { ALLOWED_UPLOAD_EXTENSIONS, ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_SIZE_BYTES } from "@/lib/constants";

export const moneySchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => Number(value))
  .refine((value) => Number.isFinite(value) && value >= 0, "Enter a valid amount");

export const optionalMoneySchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? Number(value) : null))
  .refine((value) => value === null || (Number.isFinite(value) && value >= 0), "Enter a valid amount");

export function validateUpload(file: File, isRequired: boolean) {
  if (!file || file.size === 0) {
    if (isRequired) {
      throw new Error("A file is required.");
    }

    return;
  }

  const extension = path.extname(file.name).toLowerCase();
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type) || !ALLOWED_UPLOAD_EXTENSIONS.includes(extension)) {
    throw new Error("Only PDF, JPG, PNG, and DOCX files are allowed.");
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    const limitInKb = Math.round(MAX_UPLOAD_SIZE_BYTES / 1024);
    throw new Error(`File is too large. Maximum allowed size is ${limitInKb} KB.`);
  }
}

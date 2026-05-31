import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AttachmentEntityType } from "@prisma/client";
import { validateUpload } from "@/lib/validators/common";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "private");

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function saveUploadedFile(
  file: File,
  entityType: AttachmentEntityType,
  entityId: string,
  isRequired = false
) {
  validateUpload(file, isRequired);

  if (!file || file.size === 0) {
    return null;
  }

  const folder = path.join(STORAGE_ROOT, entityType.toLowerCase(), entityId);
  await mkdir(folder, { recursive: true });

  const storedName = `${randomUUID()}-${sanitizeFilename(file.name)}`;
  const storagePath = path.join(folder, storedName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(storagePath, buffer);

  return {
    originalName: file.name,
    storedName,
    mimeType: file.type,
    sizeBytes: file.size,
    storagePath
  };
}

export async function readStoredFile(storagePath: string) {
  return readFile(storagePath);
}

import { randomUUID } from "node:crypto";
import { AttachmentEntityType } from "@prisma/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateUpload } from "@/lib/validators/common";

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "attachments";

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

  const storedName = `${randomUUID()}-${sanitizeFilename(file.name)}`;
  const storagePath = `${entityType.toLowerCase()}/${entityId}/${storedName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const supabase = createAdminClient();

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, buffer, {
    contentType: file.type,
    upsert: false
  });

  if (error) {
    throw new Error(`Failed to upload attachment: ${error.message}`);
  }

  return {
    originalName: file.name,
    storedName,
    mimeType: file.type,
    sizeBytes: file.size,
    storagePath
  };
}

export async function readStoredFile(storagePath: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath);

  if (error || !data) {
    throw new Error(`Failed to read attachment: ${error?.message ?? "Attachment not found."}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

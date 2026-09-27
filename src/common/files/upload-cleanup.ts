import { promises as fs } from 'fs';

export async function deleteUploadedFile(
  filePath?: string | null,
): Promise<void> {
  if (!filePath) return;
  await fs.unlink(filePath).catch(() => undefined);
}

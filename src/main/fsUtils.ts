import fs from 'fs';

/**
 * Moves a file safely across both same-drive and cross-drive (EXDEV) filesystems.
 * Verifies destination byte size before deleting the source file on cross-drive copy.
 */
export async function moveFileSafe(srcPath: string, destPath: string): Promise<void> {
  try {
    await fs.promises.rename(srcPath, destPath);
  } catch (err: any) {
    if (err?.code === 'EXDEV') {
      const srcStat = await fs.promises.stat(srcPath);
      await fs.promises.copyFile(srcPath, destPath);
      const destStat = await fs.promises.stat(destPath);
      if (destStat.size !== srcStat.size) {
        try {
          await fs.promises.unlink(destPath);
        } catch {
          // Ignore cleanup error
        }
        throw new Error('Kích thước file sau khi sao chép sang ổ đĩa khác không khớp.');
      }
      await fs.promises.unlink(srcPath);
      return;
    }
    throw err;
  }
}

import fs from 'fs';
import path from 'path';
import { DuplicatePolicy } from '../shared/types';

export function resolveDestPath(
  destFolder: string,
  filename: string,
  policy: DuplicatePolicy,
  allowOverwrite: boolean = false
): string | null {
  const targetPath = path.join(destFolder, filename);

  if (!fs.existsSync(targetPath)) {
    return targetPath;
  }

  if (policy === 'skip') {
    return null;
  }

  if (policy === 'overwrite' && allowOverwrite) {
    return targetPath;
  }

  // policy == 'rename' (or overwrite without allow_overwrite safety check)
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let counter = 1;

  let candidatePath = path.join(destFolder, `${base}_${counter}${ext}`);
  while (fs.existsSync(candidatePath)) {
    counter++;
    candidatePath = path.join(destFolder, `${base}_${counter}${ext}`);
  }

  return candidatePath;
}

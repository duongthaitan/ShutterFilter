import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { resolveDestPath } from '../src/main/conflictResolver';

describe('conflictResolver - resolveDestPath()', () => {
  const destDir = '/test/dest';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns original path if file does not exist at destination', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const result = resolveDestPath(destDir, 'photo.jpg', 'rename');
    expect(result).toBe(path.join(destDir, 'photo.jpg'));
  });

  it('returns null if policy is skip and file exists', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const result = resolveDestPath(destDir, 'photo.jpg', 'skip');
    expect(result).toBeNull();
  });

  it('returns original path if policy is overwrite and allow_overwrite is true', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const result = resolveDestPath(destDir, 'photo.jpg', 'overwrite', true);
    expect(result).toBe(path.join(destDir, 'photo.jpg'));
  });

  it('appends _1, _2 suffixes when policy is rename and collisions exist (AC-05a)', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      const pStr = p.toString();
      if (pStr.endsWith('photo.jpg')) return true;
      if (pStr.endsWith('photo_1.jpg')) return true;
      return false; // photo_2.jpg does not exist
    });

    const result = resolveDestPath(destDir, 'photo.jpg', 'rename');
    expect(result).toBe(path.join(destDir, 'photo_2.jpg'));
  });
});

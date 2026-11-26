import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { FilterConfig } from '../src/shared/types';
import {
  isRawExtension,
  toLocalFileUrl,
} from '../src/shared/imageExtensions';
import { isMatch, normalizeKeywords } from '../src/main/filterEngine';
import { getJpegDimensions, parseJpegLength } from '../src/main/exifReader';
import {
  scanAndPreview,
  detectExtensionsInFolder,
} from '../src/main/fileScanner';
import { executeFilter, cancelRun } from '../src/main/fileOperator';
import { moveFileSafe } from '../src/main/fsUtils';
import { deleteHistoryEntry, getHistoryEntry } from '../src/main/store';

describe('Upgrade Regression Suite', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Shared imageExtensions & URL encoding', () => {
    it('recognizes all 13 RAW camera extensions including .pef and .srw', () => {
      for (const ext of [
        '.arw',
        '.cr2',
        '.cr3',
        '.nef',
        '.dng',
        '.raf',
        '.orf',
        '.rw2',
        '.pef',
        '.srw',
        '.x3f',
        '.erf',
        '.mrw',
      ]) {
        expect(isRawExtension(ext)).toBe(true);
      }
      expect(isRawExtension('.jpg')).toBe(false);
      expect(isRawExtension('.mp4')).toBe(false);
    });

    it('properly encodes special URL characters (#, %, ?, spaces, Unicode) in file:// URLs', () => {
      const winUrl = toLocalFileUrl('D:\\Anh Cưới #1\\100% RAW\\IMG 01?.jpg');
      expect(winUrl).toBe(
        'file:///D:/Anh%20C%C6%B0%E1%BB%9Bi%20%231/100%25%20RAW/IMG%2001%3F.jpg'
      );

      const posixUrl = toLocalFileUrl('/Users/photo/Shoot #2/DSC 001.jpg');
      expect(posixUrl).toBe('file:///Users/photo/Shoot%20%232/DSC%20001.jpg');

      const uncUrl = toLocalFileUrl('\\\\NAS01\\Studio #1\\DSC001.jpg');
      expect(uncUrl).toBe('file://NAS01/Studio%20%231/DSC001.jpg');
    });
  });

  describe('filterEngine exact / prefix / normalizeKeywords', () => {
    const makeCfg = (overrides: Partial<FilterConfig>): FilterConfig => ({
      sourceFolder: '/src',
      destFolder: '/dst',
      recursive: true,
      keywords_include: ['DSC001'],
      keywords_exclude: [],
      match_type: 'exact',
      extensions: [],
      mode: 'copy',
      duplicate_policy: 'auto_rename',
      allow_overwrite: false,
      auto_subfolder: 'none',
      ...overrides,
    });

    it('supports exact match without accidentally matching longer numbers', () => {
      const cfg = makeCfg({ match_type: 'exact', keywords_include: ['DSC001'] });
      expect(isMatch('DSC001.JPG', cfg)).toBe(true);
      expect(isMatch('DSC001.ARW', cfg)).toBe(true);
      expect(isMatch('DSC0010.JPG', cfg)).toBe(false);
      expect(isMatch('MY_DSC001.JPG', cfg)).toBe(false);
    });

    it('supports prefix match identically to starts_with', () => {
      const cfg = makeCfg({ match_type: 'prefix', keywords_include: ['IMG_'] });
      expect(isMatch('IMG_0012.CR3', cfg)).toBe(true);
      expect(isMatch('COPY_IMG_0012.CR3', cfg)).toBe(false);
    });

    it('deduplicates and trims keywords case-insensitively while preserving order', () => {
      expect(normalizeKeywords(['  DSC001 ', '', 'dsc001', 'DSC002\r'])).toEqual([
        'DSC001',
        'DSC002',
      ]);
    });
  });

  describe('exifReader JPEG segment & progressive parser', () => {
    it('skips fake 0xFF 0xC0 bytes inside EXIF APP1 and reads real SOF0 dimensions', () => {
      // SOI (FF D8) + APP1 (FF E1, len=8) containing fake FF C0 + real SOF0 (FF C0, len=11, h=1280, w=1920) + EOI (FF D9)
      const buf = Buffer.from([
        0xff, 0xd8, // SOI
        0xff, 0xe1, 0x00, 0x0a, // APP1 length=10 (2 len + 8 payload)
        0xff, 0xc0, 0x00, 0x11, 0x08, 0xff, 0xff, 0xff, // fake SOF inside EXIF
        0xff, 0xc0, 0x00, 0x0b, 0x08, 0x05, 0x00, 0x07, 0x80, 0x01, 0x01, 0x11, 0x00, // real SOF0: h=1280 (0x0500), w=1920 (0x0780)
        0xff, 0xd9, // EOI
      ]);

      expect(getJpegDimensions(buf)).toEqual({ w: 1920, h: 1280 });
    });

    it('parses full multi-scan progressive JPEG without truncating before EOI', () => {
      // SOI + SOF2 + SOS #1 + entropy + SOS #2 + entropy + EOI
      const buf = Buffer.from([
        0xff, 0xd8, // SOI
        0xff, 0xc2, 0x00, 0x0b, 0x08, 0x04, 0x00, 0x06, 0x00, 0x01, 0x01, 0x11, 0x00, // SOF2 (1536x1024)
        0xff, 0xda, 0x00, 0x04, 0x01, 0x02, // SOS #1
        0x12, 0xff, 0x00, 0x34, // entropy with byte-stuffed 0xFF00
        0xff, 0xda, 0x00, 0x04, 0x01, 0x03, // SOS #2 (progressive scan 2)
        0x56, 0x78,
        0xff, 0xd9, // EOI
      ]);

      expect(parseJpegLength(buf, 0)).toBe(buf.length);
      expect(getJpegDimensions(buf)).toEqual({ w: 1536, h: 1024 });
    });
  });

  describe('fileScanner dest-inside-source exclusion, unmatched keywords & recursive detect', () => {
    it('excludes destination subfolder inside source and reports unmatchedKeywords accurately', async () => {
      const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sf-scan-'));
      try {
        const subDest = path.join(tmp, 'Da_Loc');
        const subRaw = path.join(tmp, 'RAW');
        await fs.promises.mkdir(subDest, { recursive: true });
        await fs.promises.mkdir(subRaw, { recursive: true });

        await fs.promises.writeFile(path.join(tmp, 'DSC001.JPG'), 'root jpg');
        await fs.promises.writeFile(path.join(subRaw, 'DSC001.PEF'), 'nested raw');
        // Already-filtered duplicate inside dest folder should be ignored
        await fs.promises.writeFile(path.join(subDest, 'DSC001.JPG'), 'already copied');

        const preview = await scanAndPreview({
          sourceFolder: tmp,
          destFolder: subDest,
          recursive: true,
          keywords_include: ['DSC001', 'MISSING_999'],
          keywords_exclude: [],
          match_type: 'exact',
          extensions: [],
          mode: 'copy',
          duplicate_policy: 'auto_rename',
          allow_overwrite: false,
          auto_subfolder: 'none',
        });

        expect(preview.totalCount).toBe(2);
        expect(preview.totalFolderImages).toBe(2);
        expect(preview.unmatchedKeywords).toEqual(['MISSING_999']);

        const nonRecursiveExts = await detectExtensionsInFolder(tmp, false, subDest);
        expect(nonRecursiveExts).toEqual([{ ext: 'jpg', count: 1, isRaw: false }]);

        const recursiveExts = await detectExtensionsInFolder(tmp, true, subDest);
        expect(recursiveExts).toEqual([
          { ext: 'jpg', count: 1, isRaw: false },
          { ext: 'pef', count: 1, isRaw: true },
        ]);
      } finally {
        await fs.promises.rm(tmp, { recursive: true, force: true });
      }
    });
  });

  describe('moveFileSafe EXDEV fallback & fileOperator safeguards', () => {
    it('falls back to copy+verify+unlink when rename throws EXDEV (cross-drive move)', async () => {
      const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sf-exdev-'));
      try {
        const src = path.join(tmp, 'origin.jpg');
        const dst = path.join(tmp, 'moved.jpg');
        await fs.promises.writeFile(src, 'cross-drive-image-payload');

        const exdevErr = Object.assign(new Error('EXDEV: cross-device link'), {
          code: 'EXDEV',
        });
        vi.spyOn(fs.promises, 'rename').mockRejectedValueOnce(exdevErr);

        await moveFileSafe(src, dst);

        expect(fs.existsSync(src)).toBe(false);
        expect(fs.existsSync(dst)).toBe(true);
        expect(await fs.promises.readFile(dst, 'utf-8')).toBe(
          'cross-drive-image-payload'
        );
      } finally {
        await fs.promises.rm(tmp, { recursive: true, force: true });
      }
    });

    it('rejects empty destFolder and supports by_extension subfolder + history cleanup', async () => {
      const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sf-op-'));
      try {
        const srcDir = path.join(tmp, 'src');
        await fs.promises.mkdir(srcDir, { recursive: true });
        await fs.promises.writeFile(path.join(srcDir, 'IMG01.JPG'), 'jpg-bytes');
        await fs.promises.writeFile(path.join(srcDir, 'IMG01.ARW'), 'arw-bytes');

        const baseCfg: FilterConfig = {
          sourceFolder: srcDir,
          destFolder: '   ',
          recursive: true,
          keywords_include: ['IMG01'],
          keywords_exclude: [],
          match_type: 'contains',
          extensions: [],
          mode: 'copy',
          duplicate_policy: 'auto_rename',
          allow_overwrite: false,
          auto_subfolder: 'by_extension',
        };

        await expect(executeFilter(baseCfg)).rejects.toThrow('Chưa chọn thư mục đích');

        const runRes = await executeFilter({
          ...baseCfg,
          destFolder: 'Output_Rel',
        });

        expect(runRes.processed).toBe(2);
        expect(runRes.cancelled).toBe(false);
        expect(runRes.destination_folder).toBe(path.join(srcDir, 'Output_Rel'));
        expect(fs.existsSync(path.join(srcDir, 'Output_Rel', 'JPG', 'IMG01.JPG'))).toBe(
          true
        );
        expect(fs.existsSync(path.join(srcDir, 'Output_Rel', 'ARW', 'IMG01.ARW'))).toBe(
          true
        );

        // Clean up test entry from history store
        expect(getHistoryEntry(runRes.run_id)).toBeDefined();
        expect(deleteHistoryEntry(runRes.run_id)).toBe(true);
        expect(getHistoryEntry(runRes.run_id)).toBeUndefined();
      } finally {
        await fs.promises.rm(tmp, { recursive: true, force: true });
      }
    });

    it('marks run as cancelled and does not overwrite progress with completed', async () => {
      const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sf-cancel-'));
      try {
        const srcDir = path.join(tmp, 'src');
        const dstDir = path.join(tmp, 'dst');
        await fs.promises.mkdir(srcDir, { recursive: true });
        await fs.promises.writeFile(path.join(srcDir, 'A1.JPG'), '1');
        await fs.promises.writeFile(path.join(srcDir, 'A2.JPG'), '2');

        const statuses: string[] = [];
        const res = await executeFilter(
          {
            sourceFolder: srcDir,
            destFolder: dstDir,
            recursive: false,
            keywords_include: ['A'],
            keywords_exclude: [],
            match_type: 'starts_with',
            extensions: [],
            mode: 'copy',
            duplicate_policy: 'auto_rename',
            allow_overwrite: false,
            auto_subfolder: 'none',
          },
          undefined,
          undefined,
          (progress) => {
            statuses.push(progress.status);
            if (progress.status === 'processing') {
              cancelRun(progress.runId);
            }
          }
        );

        expect(res.cancelled).toBe(true);
        expect(statuses).toContain('cancelled');
        expect(statuses).not.toContain('completed');
        deleteHistoryEntry(res.run_id);
      } finally {
        await fs.promises.rm(tmp, { recursive: true, force: true });
      }
    });
  });
});

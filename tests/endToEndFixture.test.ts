import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { FilterConfig, FileEntry } from '../src/shared/types';
import { scanAndPreview } from '../src/main/fileScanner';
import { executeFilter } from '../src/main/fileOperator';
import { undoRun, listHistory } from '../src/main/store';

describe('End-to-End Fixture Integration Test (PhotoSorter)', () => {
  let tmpDir: string;
  let sourceDir: string;
  let destDir: string;

  beforeAll(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'shutterfilter-test-'));
    sourceDir = path.join(tmpDir, 'source');
    destDir = path.join(tmpDir, 'dest');

    await fs.promises.mkdir(sourceDir, { recursive: true });
    await fs.promises.mkdir(destDir, { recursive: true });

    // Create realistic test photo fixture files
    await fs.promises.writeFile(path.join(sourceDir, 'DSC0001.JPG'), 'fake jpg photo content 1');
    await fs.promises.writeFile(path.join(sourceDir, 'DSC0002_WA.JPG'), 'fake whatsapp edit photo');
    await fs.promises.writeFile(path.join(sourceDir, 'A7R_PHOTO.ARW'), 'fake raw arw image');
    await fs.promises.writeFile(path.join(sourceDir, 'PORTRAIT.HEIC'), 'fake heic photo');
    await fs.promises.writeFile(path.join(sourceDir, 'REPORT.PDF'), 'non image pdf document');
  });

  afterAll(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it('1. Scans and previews source directory with keyword and format filters', async () => {
    const config: FilterConfig = {
      sourceFolder: sourceDir,
      destFolder: destDir,
      recursive: false,
      keywords_include: ['DSC', 'A7R'],
      keywords_exclude: ['WA'],
      match_type: 'contains',
      extensions: ['.jpg', '.arw', '.heic'],
      mode: 'copy',
      duplicate_policy: 'rename',
      allow_overwrite: false,
      auto_subfolder: 'none',
    };

    const preview = await scanAndPreview(config);

    // Expected matches:
    // - DSC0001.JPG (matches include DSC, extension .JPG)
    // - A7R_PHOTO.ARW (matches include A7R, extension .ARW)
    // Excluded:
    // - DSC0002_WA.JPG (matches include DSC, but has exclude WA)
    // - PORTRAIT.HEIC (no include keyword matched)
    // - REPORT.PDF (extension not supported)

    expect(preview.totalCount).toBe(2);
    const filenames = preview.files.map((f) => f.filename);
    expect(filenames).toContain('DSC0001.JPG');
    expect(filenames).toContain('A7R_PHOTO.ARW');
    expect(filenames).not.toContain('DSC0002_WA.JPG');
  });

  it('2. Executes Copy mode and copies files to destination', async () => {
    const config: FilterConfig = {
      sourceFolder: sourceDir,
      destFolder: destDir,
      recursive: false,
      keywords_include: ['DSC', 'A7R'],
      keywords_exclude: ['WA'],
      match_type: 'contains',
      extensions: ['.jpg', '.arw'],
      mode: 'copy',
      duplicate_policy: 'rename',
      allow_overwrite: false,
      auto_subfolder: 'none',
    };

    const preview = await scanAndPreview(config);
    const result = await executeFilter(config, preview.files, 'Test Copy Preset');

    expect(result.processed).toBe(2);
    expect(result.errors).toBe(0);

    // Verify files copied to destination
    expect(fs.existsSync(path.join(destDir, 'DSC0001.JPG'))).toBe(true);
    expect(fs.existsSync(path.join(destDir, 'A7R_PHOTO.ARW'))).toBe(true);

    // Verify original files remain in source (Copy mode)
    expect(fs.existsSync(path.join(sourceDir, 'DSC0001.JPG'))).toBe(true);
    expect(fs.existsSync(path.join(sourceDir, 'A7R_PHOTO.ARW'))).toBe(true);
  });

  it('3. Handles collision rename when copying duplicate files (AC-05a)', async () => {
    const config: FilterConfig = {
      sourceFolder: sourceDir,
      destFolder: destDir,
      recursive: false,
      keywords_include: ['DSC0001'],
      keywords_exclude: [],
      match_type: 'contains',
      extensions: ['.jpg'],
      mode: 'copy',
      duplicate_policy: 'rename',
      allow_overwrite: false,
      auto_subfolder: 'none',
    };

    const preview = await scanAndPreview(config);
    const result = await executeFilter(config, preview.files);

    expect(result.processed).toBe(1);
    // Since DSC0001.JPG already exists in dest, it should be renamed to DSC0001_1.JPG
    expect(fs.existsSync(path.join(destDir, 'DSC0001_1.JPG'))).toBe(true);
  });

  it('4. Performs Undo for the copy operation', async () => {
    const history = listHistory();
    const lastRun = history[0];

    expect(lastRun).toBeDefined();
    expect(lastRun.undone).toBe(false);

    const undoRes = await undoRun(lastRun.run_id);
    expect(undoRes.success).toBe(true);
    expect(undoRes.deletedCount).toBeGreaterThan(0);

    // File DSC0001_1.JPG created in run 3 should be deleted by undo
    expect(fs.existsSync(path.join(destDir, 'DSC0001_1.JPG'))).toBe(false);

    // Verify double undo is blocked (AC-11a)
    const doubleUndo = await undoRun(lastRun.run_id);
    expect(doubleUndo.success).toBe(false);
    expect(doubleUndo.errors[0]).toContain('trước đó');
  });
});

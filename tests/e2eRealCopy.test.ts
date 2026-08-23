import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { scanAndPreview } from '../src/main/fileScanner';
import { executeFilter } from '../src/main/fileOperator';
import { FilterConfig } from '../src/shared/types';

const TEST_DIR = path.join(__dirname, '__e2e_realcopy_test__');
const SOURCE_DIR = path.join(TEST_DIR, 'source');
const DEST_DIR = path.join(TEST_DIR, 'destination');

function setup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }

  fs.mkdirSync(SOURCE_DIR, { recursive: true });

  fs.writeFileSync(path.join(SOURCE_DIR, 'DTT08972.JPG'), 'fake-photo-data-08972');
  fs.writeFileSync(path.join(SOURCE_DIR, 'DTT08976.JPG'), 'fake-photo-data-08976');
  fs.writeFileSync(path.join(SOURCE_DIR, 'DTT09001.JPG'), 'fake-photo-data-09001');
  fs.writeFileSync(path.join(SOURCE_DIR, 'RANDOM_IMAGE.PNG'), 'fake-png-data');
  fs.writeFileSync(path.join(SOURCE_DIR, 'OTHER_FILE.ARW'), 'fake-raw-data');
}

function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

describe('E2E Real File Copy Suite', () => {
  it('scans, filters, and physically copies matched files to destination directory', async () => {
    setup();

    try {
      const config: FilterConfig = {
        sourceFolder: SOURCE_DIR,
        destFolder: DEST_DIR,
        recursive: true,
        keywords_include: ['DTT08972', 'DTT08976'],
        keywords_exclude: [],
        match_type: 'contains',
        extensions: ['.jpg'],
        mode: 'copy',
        duplicate_policy: 'auto_rename',
        allow_overwrite: false,
        auto_subfolder: 'none',
      };

      const previewResult = await scanAndPreview(config);
      expect(previewResult.totalCount).toBe(2);

      const filesToProcess = previewResult.matched_files || previewResult.files || [];
      expect(filesToProcess.length).toBe(2);

      const result = await executeFilter(config, filesToProcess);
      expect(result.processed).toBe(2);
      expect(result.errors).toBe(0);

      expect(fs.existsSync(DEST_DIR)).toBe(true);
      const destFiles = fs.readdirSync(DEST_DIR);
      expect(destFiles).toContain('DTT08972.JPG');
      expect(destFiles).toContain('DTT08976.JPG');

      // Verify source files intact
      expect(fs.existsSync(path.join(SOURCE_DIR, 'DTT08972.JPG'))).toBe(true);
      expect(fs.existsSync(path.join(SOURCE_DIR, 'DTT08976.JPG'))).toBe(true);
    } finally {
      cleanup();
    }
  });
});

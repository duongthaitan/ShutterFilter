import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { Preset, RunLog, UndoResult } from '../shared/types';

interface StorageData {
  presets: Preset[];
  history: RunLog[];
  schema_version: number;
}

const SCHEMA_VERSION = 1;

function getStoreFilePath(): string {
  const userDataPath = app ? app.getPath('userData') : process.cwd();
  return path.join(userDataPath, 'shutterfilter_data.json');
}

function loadData(): StorageData {
  const filePath = getStoreFilePath();
  if (!fs.existsSync(filePath)) {
    return { presets: [], history: [], schema_version: SCHEMA_VERSION };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      presets: parsed.presets || [],
      history: parsed.history || [],
      schema_version: parsed.schema_version || SCHEMA_VERSION,
    };
  } catch (err) {
    console.error('Failed to load store file, initializing fresh:', err);
    return { presets: [], history: [], schema_version: SCHEMA_VERSION };
  }
}

function saveData(data: StorageData): void {
  const filePath = getStoreFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save store file:', err);
  }
}

// Preset CRUD Operations
export function listPresets(): Preset[] {
  return loadData().presets;
}

export function savePreset(presetData: Omit<Preset, 'id' | 'created_at' | 'schema_version'> & { id?: string }): Preset {
  const data = loadData();
  let preset: Preset;

  if (presetData.id) {
    const idx = data.presets.findIndex((p) => p.id === presetData.id);
    if (idx !== -1) {
      preset = {
        ...data.presets[idx],
        ...presetData,
      };
      data.presets[idx] = preset;
    } else {
      preset = {
        ...presetData,
        id: presetData.id,
        created_at: new Date().toISOString(),
        schema_version: SCHEMA_VERSION,
      };
      data.presets.push(preset);
    }
  } else {
    preset = {
      ...presetData,
      id: `preset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
      schema_version: SCHEMA_VERSION,
    };
    data.presets.push(preset);
  }

  saveData(data);
  return preset;
}

export function deletePreset(id: string): boolean {
  const data = loadData();
  const initialLen = data.presets.length;
  data.presets = data.presets.filter((p) => p.id !== id);
  if (data.presets.length !== initialLen) {
    saveData(data);
    return true;
  }
  return false;
}

// History & RunLog Operations
export function listHistory(): RunLog[] {
  return loadData().history.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function getHistoryEntry(runId: string): RunLog | undefined {
  return loadData().history.find((h) => h.run_id === runId);
}

export function saveRunLog(log: RunLog): void {
  const data = loadData();
  data.history.unshift(log);
  saveData(data);
}

export async function undoRun(runId: string): Promise<UndoResult> {
  const data = loadData();
  const logIdx = data.history.findIndex((h) => h.run_id === runId);

  if (logIdx === -1) {
    return {
      success: false,
      runId,
      restoredCount: 0,
      deletedCount: 0,
      errorCount: 1,
      errors: ['Không tìm thấy lịch sử chạy này.'],
    };
  }

  const log = data.history[logIdx];

  // AC-11a: Prevent double undo
  if (log.undone) {
    return {
      success: false,
      runId,
      restoredCount: 0,
      deletedCount: 0,
      errorCount: 1,
      errors: ['Lần chạy này đã được Hoàn tác trước đó.'],
    };
  }

  let restoredCount = 0;
  let deletedCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // Reverse iterate through file map to maintain order
  const fileMapReversed = [...log.file_map].reverse();

  for (const entry of fileMapReversed) {
    if (entry.status !== 'success') continue;

    try {
      if (log.mode === 'copy') {
        // Copy mode: delete copied file at destination
        if (fs.existsSync(entry.destination)) {
          await fs.promises.unlink(entry.destination);
          deletedCount++;
        }
      } else if (log.mode === 'move') {
        // Move mode: move file back from destination to source
        if (fs.existsSync(entry.destination)) {
          // Ensure source parent directory exists
          const sourceDir = path.dirname(entry.source);
          if (!fs.existsSync(sourceDir)) {
            await fs.promises.mkdir(sourceDir, { recursive: true });
          }
          await fs.promises.rename(entry.destination, entry.source);
          restoredCount++;
        } else {
          errorCount++;
          errors.push(`File đích không còn tồn tại: ${entry.destination}`);
        }
      }
    } catch (err: any) {
      errorCount++;
      errors.push(`Lỗi hoàn tác cho ${entry.filename}: ${err.message}`);
    }
  }

  // Mark run as undone
  data.history[logIdx].undone = true;
  saveData(data);

  return {
    success: errorCount === 0,
    runId,
    restoredCount,
    deletedCount,
    errorCount,
    errors,
  };
}

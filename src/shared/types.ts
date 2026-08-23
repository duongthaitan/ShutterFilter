export type MatchType = 'contains' | 'starts_with' | 'exact' | 'prefix';
export type OperationMode = 'copy' | 'move';
export type DuplicatePolicy = 'skip' | 'rename' | 'overwrite' | 'auto_rename';
export type AutoSubfolderMode = 'none' | 'by_keyword' | 'by_date' | 'by_extension' | 'by_camera';

export const RAW_EXTENSIONS = [
  '.arw',
  '.cr2',
  '.cr3',
  '.nef',
  '.dng',
  '.raf',
  '.orf',
  '.rw2',
];

export const STANDARD_EXTENSIONS = ['.jpg', '.jpeg', '.heic'];

export const ALL_SUPPORTED_EXTENSIONS = [
  ...STANDARD_EXTENSIONS,
  ...RAW_EXTENSIONS,
];

export interface FilterConfig {
  sourceFolder: string;
  source_folder?: string;
  destFolder: string;
  destination_folder?: string;
  recursive: boolean;
  keywords_include: string[];
  keywords_exclude: string[];
  match_type: MatchType;
  extensions: string[];
  mode: OperationMode;
  duplicate_policy: DuplicatePolicy;
  allow_overwrite: boolean;
  auto_subfolder: AutoSubfolderMode;
  overwrite_safety_lock?: boolean;
}

export interface FileEntry {
  id: string;
  filename: string;
  name?: string;
  relativePath: string;
  sourcePath: string;
  path?: string;
  sizeBytes: number;
  size?: number;
  extension: string;
  dateTaken: string | null;
  mtime?: string;
  matchedKeyword?: string;
  selected: boolean;
}

export interface PreviewResult {
  files: FileEntry[];
  matched_files?: FileEntry[];
  totalCount: number;
  total_matched?: number;
  totalSizeBytes: number;
  total_size?: number;
  scan_duration_ms?: number;
}

export interface FileMapEntry {
  source: string;
  destination: string;
  filename: string;
  status: 'success' | 'skipped' | 'error';
  errorReason?: string;
}

export interface RunLog {
  run_id: string;
  timestamp: string;
  source_folder: string;
  destination_folder: string;
  preset_name?: string;
  mode: OperationMode;
  duplicate_policy: DuplicatePolicy;
  total_matched: number;
  processed: number;
  skipped_duplicate: number;
  errors: number;
  undone: boolean;
  file_map: FileMapEntry[];
  schema_version: number;
}

export interface Preset {
  id: string;
  name: string;
  keywords_include: string[];
  keywords_exclude: string[];
  match_type: MatchType;
  extensions: string[];
  mode: OperationMode;
  duplicate_policy: DuplicatePolicy;
  created_at: string;
  schema_version: number;
}

export interface ProgressUpdate {
  runId: string;
  processedCount: number;
  totalCount: number;
  currentFilename: string;
  status: 'processing' | 'completed' | 'cancelled' | 'error' | 'running';
  errorMsg?: string;
}

export interface RunResult {
  run_id: string;
  total_matched: number;
  processed: number;
  skipped: number;
  errors: number;
  file_map: FileMapEntry[];
  errorList: { filename: string; reason: string }[];
}

export interface UndoResult {
  success: boolean;
  runId: string;
  restoredCount: number;
  deletedCount: number;
  errorCount: number;
  errors: string[];
}

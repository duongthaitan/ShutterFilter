<p align="center">
  <img src="assets/icon.png" width="80" height="80" alt="ShutterFilter icon" />
</p>

<h1 align="center">ShutterFilter</h1>

<p align="center">
  <strong>by Tandev.foto</strong>
</p>

<p align="center">
  <a href="https://github.com/duongthaitan/ShutterFilter/releases"><img src="https://img.shields.io/badge/version-1.0.0-f59e0b?style=flat-square" alt="Version" /></a>
  <img src="https://img.shields.io/badge/electron-33-47848f?style=flat-square&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/react-18-61dafb?style=flat-square&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/tailwind-v4-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/typescript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/tests-17%20passed-10b981?style=flat-square" alt="Tests" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" />
</p>

<p align="center">
  Desktop tool for photographers and studios.<br/>
  Filters photos from a source folder by matching a list of filenames,<br/>
  then copies or moves the matched files to a destination.
</p>

---

### Dark Mode

![Dark Mode workspace](docs/images/dark_mode_ui.png)

### Light Mode

![Light Mode workspace](docs/images/light_mode_ui.png)

---

## The Problem

After a shoot, you have thousands of files in a folder — RAW and JPEG mixed together. Your client sends back a list of selected photo names. You need to find and extract those specific files from the pile.

Doing this manually is slow, tedious, and easy to mess up.

## The Solution

Paste the filename list into ShutterFilter, point it at the source and destination folders, run. Done.

---

## Usage

```
1.  Pick source folder        → where your original photos live
2.  Pick destination folder    → where filtered results go
3.  Paste photo names          → one per line (e.g. DTT00970, DTT00971)
4.  Choose mode                → Copy (safe, keeps originals) or Move
5.  Run                        → files land in destination
```

The app matches filenames in real time as you paste. Results appear in a paginated table before you commit to running anything.

![Filter matching and preview](docs/images/filter_preview.png)

---

## Features

| | |
|---|---|
| **Real-time matching** | Results update live as you type or paste filenames |
| **Auto extension detection** | Scans source folder, shows available formats (`.jpg`, `.cr3`, `.arw`, `.nef`, `.dng`...) |
| **Format filtering** | Extensions default to off — all formats included. Toggle specific ones to narrow results |
| **Video exclusion** | `.mp4`, `.mov`, `.avi`, `.mkv` always excluded |
| **Pagination** | 50 / 100 / 250 / 500 rows per page for large folders |
| **Run history** | Every operation logged with full file map |
| **Undo** | One-click restore to original locations |
| **Dark / Light theme** | Toggle in header, preference persists across sessions |
| **Portable .exe** | Single file (~116 MB), no installer, no dependencies |

---

## Supported Formats

```
RAW     .arw  .cr2  .cr3  .nef  .dng  .raf  .orf  .rw2
Bitmap  .jpg  .jpeg .png  .webp .tiff .bmp  .heic
```

---

## History & Undo

Every copy/move operation creates a transaction log. You can browse past runs, inspect which files went where, and undo any run to restore files back to their original location.

![History and undo](docs/images/history_undo.png)

---

## Development

```bash
# Install
npm install

# Dev mode — Electron window with hot reload
npm run dev

# Run test suite (17 tests, unit + E2E)
npm test

# Build single-file .exe
# Requires: Python 3, .NET Framework 4.0 (csc.exe)
npm run build:single
# → release/ShutterFilter_SingleFile.exe
```

## Architecture

```
src/
├── main/                        # Electron main process
│   ├── index.ts                 # Window, app lifecycle
│   ├── ipcHandlers.ts           # IPC bridge
│   ├── fileScanner.ts           # Directory walk, extension detection
│   ├── filterEngine.ts          # Filename matching
│   ├── fileOperator.ts          # Copy/move with progress reporting
│   ├── conflictResolver.ts      # Duplicate handling
│   └── store.ts                 # Run history (JSON persistence)
│
├── renderer/                    # React UI
│   ├── App.tsx                  # Root, state, theme toggle
│   ├── index.css                # Design tokens, theme variables
│   └── components/
│       ├── FolderPicker.tsx      # Source/destination selection
│       ├── FilterCriteria.tsx    # Keywords + extension toggles
│       ├── PreviewTable.tsx      # Paginated results with thumbnails
│       ├── ModeAndPolicy.tsx     # Copy/Move selector
│       ├── HistoryView.tsx       # Run log + undo
│       └── ExecutionModal.tsx    # Progress + completion
│
└── shared/
    ├── types.ts                 # Shared interfaces
    └── imageExtensions.ts       # Format whitelist
```

## Build Pipeline

```
npm run build:single
    │
    ├── tsc              — Type check
    ├── vite build       — Bundle renderer + main + preload
    ├── electron-builder — Package into win-unpacked/
    ├── build_single_exe.py
    │   ├── ZIP win-unpacked/ into payload
    │   ├── Compile C# launcher (csc.exe)
    │   └── Embed ZIP as .NET resource
    └── patch_exe_icon.js
        └── Patch PE icon + version info via resedit
```

---

<p align="center">
  <sub>Built by <strong>Tandev.foto</strong> — © 2026</sub>
</p>

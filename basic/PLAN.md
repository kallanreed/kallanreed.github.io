# BASIC Applet — Design Plan

A GW-BASIC/QBasic-flavored interpreter SPA designed for iPhone. Pinnable to home screen, DOS retro green-phosphor aesthetic, custom on-screen keyboard, and localStorage-backed file management.

---

## Goals

- Run GW-BASIC-flavored programs entirely client-side in the browser
- iPhone-friendly: pinnable PWA, custom keyboard (no system keyboard), legible terminal output
- DOS green-phosphor aesthetic
- Save/load multiple named programs via localStorage; import/export to/from device files
- Text/console output as MVP; graphics commands (PSET, LINE, CIRCLE) as a stretch goal

---

## Interpreter Strategy

**Decision: a small in-repo JavaScript interpreter tailored to this app.**

The goal is not perfect legacy compatibility. The goal is a clean, predictable, phone-friendly BASIC-like environment that runs entirely in the browser without shipping a third-party runtime.

### Runtime Model
- **Parser/executor** lives in a dedicated worker so runs do not block the UI thread
- **stdout** streams to the console UI as plain text
- **stdin** pauses execution, shows the input strip, and resumes when the user submits a line
- **state** is recreated for each run so STOP can terminate cleanly by killing the worker

### Build
- Build command: `npm run build`
- Output: `dist/bundle.iife.js` plus `dist/runtime-worker.js`

---

## Architecture

```
basic/
├── index.html              # SPA shell + PWA meta tags (hand-authored, not built)
├── manifest.json           # PWA manifest
├── dist/                   # built output — checked into git
│   ├── bundle.iife.js      # JS bundle (Vite)
│   └── runtime-worker.js   # worker-hosted interpreter runtime
├── src/
│   ├── main.js             # app entry point, wires all components
│   ├── runtime-worker.js   # BASIC-like interpreter running off the UI thread
│   ├── editor/
│   │   ├── editor.js       # code editor (contenteditable, line numbers, syntax highlight)
│   │   └── syntax.js       # keyword highlighting rules
│   ├── keyboard/
│   │   └── keyboard.js     # custom on-screen keyboard (suppresses iOS system keyboard)
│   ├── console/
│   │   └── console.js      # terminal output display + auto-scroll
│   ├── storage/
│   │   └── storage.js      # localStorage CRUD, import/export (.bas files)
│   └── ui/
│       └── filebrowser.js  # slide-in file list panel
├── content/
│   ├── style.css           # green-phosphor theme, modal layout
│   └── icon.png            # PWA icon (512×512)
├── package.json
├── vite.config.js
└── PLAN.md
```

---

## UI Layout (iPhone portrait)

The app is **modal**: Edit Mode and Run Mode are full-screen and mutually exclusive. No split panes.

### Edit Mode
```
┌─────────────────────────────────┐
│  [≡ Files]  UNTITLED.BAS [▶ RUN]│  ← toolbar
├─────────────────────────────────┤
│  10 PRINT "HELLO, WORLD"        │
│  20 INPUT "NAME? "; N$          │  ← editor (full height above keyboard,
│  30 PRINT "HI "; N$             │     scrollable, line numbers,
│  40 GOTO 10                     │     syntax highlight)
│  _                              │
│                                 │
│                                 │
├─────────────────────────────────┤
│  [PRINT][INPUT][FOR ][IF  ][→ ] │
│  [GOTO ][GOSUB][NEXT][THEN][← ] │  ← custom keyboard (fixed at bottom)
│  [ 1 ][ 2 ][ 3 ][ + ][ - ][ = ]│
│  [ 4 ][ 5 ][ 6 ][ * ][ / ][ ( ]│
│  [ 7 ][ 8 ][ 9 ][ 0 ][ " ][ ) ]│
│  [DEL ][    space    ][ ↵ ][:][,]│
└─────────────────────────────────┘
```

### Run Mode
```
┌─────────────────────────────────┐
│  [◀ EDIT]   RUNNING…   [■ STOP] │  ← toolbar (no keyboard)
├─────────────────────────────────┤
│  HELLO, WORLD                   │
│  NAME? kyle                     │  ← console (full screen, green phosphor,
│  HI KYLE                        │     monospace, auto-scrolls to bottom)
│  HELLO, WORLD                   │
│  NAME? _                        │
│                                 │
│                                 │
│                                 │
│                                 │
│                                 │
├─────────────────────────────────┤
│  [DEL ][    space    ][ ↵ ][:][,]│  ← minimal input row (INPUT stmt only)
└─────────────────────────────────┘
```

**Mode transitions**:
- **▶ RUN**: switches to Run Mode, clears console, starts interpreter
- **■ STOP**: terminates program, stays in Run Mode showing final output
- **◀ EDIT**: returns to Edit Mode (output is discarded)
- Run Mode shows only a minimal input row (no keyword keys) — it only activates when the program hits an `INPUT` statement; otherwise the keyboard area is hidden entirely.

---

## Custom Keyboard Design

Three key rows:
1. **Keyword strip** (swipeable/paginated): `PRINT`, `INPUT`, `FOR`, `NEXT`, `IF`, `THEN`, `ELSE`, `GOTO`, `GOSUB`, `RETURN`, `DIM`, `LET`, `REM`, `END`, `CLS`, `RUN`, `LIST`
2. **Digits + operators**: `0–9`, `+`, `-`, `*`, `/`, `=`, `<`, `>`, `(`, `)`, `,`, `;`, `:`, `"`, `$`
3. **Control row**: `DEL`, `Space`, `Return`, cursor left/right for navigation within a line

Tapping a keyword inserts the keyword text followed by a space. Cursor keys move within the current editor line.

Pressing Return in the editor auto-inserts the next line number, incremented by 10 (e.g., after `10 ...`, the next line starts with `20 `). `RENUM` is a stretch-goal command to renumber all lines and rewrite `GOTO`/`GOSUB` targets consistently.

---

## Execution Model

- User edits program in the editor pane (no line-number auto-insert; user types `10 PRINT "HI"` manually)
- Tap **RUN**: editor becomes read-only, console clears, interpreter runs
- `PRINT` output streams to console
- `INPUT` pauses execution, shows a prompt in console, accepts a line via the custom keyboard, resumes
- **STOP** button appears during execution; terminates the program
- Runtime errors display in the console with line number (e.g., `?SYNTAX ERROR IN 20`)

---

## File Management

- **Storage backend**: `localStorage`, one key per file, JSON format: `{ name, source, modified }`
- **File browser**: slide-in panel from the left, lists saved programs, tap to open
- **Actions**: New, Rename, Delete, Duplicate
- **Export**: Serializes source as a `.bas` plain-text file and triggers browser download
- **Import**: File picker (`<input type="file">`) accepting `.bas` or `.txt`, loads into editor as new file

---

## PWA / Pinnable

`index.html` includes:
```html
<link rel="manifest" href="manifest.json">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="BASIC">
```

`manifest.json`:
```json
{
  "name": "BASIC",
  "short_name": "BASIC",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#00ff41",
  "icons": [{ "src": "content/icon.png", "sizes": "512x512", "type": "image/png" }]
}
```

A Service Worker is optional for MVP but recommended for offline use.

---

## Build System

- **Bundler**: Vite (simpler config than webpack for a vanilla-JS project)
- Build command: `npm run build` → outputs to `dist/`
- Dev command: `npm run dev` → local dev server with HMR
- The `dist/` directory is committed to git so GitHub Pages serves it without a CI step
- `index.html` references `dist/bundle.js` and `dist/style.css`

---

## Aesthetic Notes

- Font: `Courier New` or a web-safe monospace; optionally load `Press Start 2P` for headers (keep it light)
- Colors: `#000000` background, `#00ff41` (Matrix green) text, `#003300` for dim/inactive elements
- Subtle CRT scanline effect via CSS repeating-gradient overlay (purely decorative, can be toggled off)
- Blinking block cursor in the editor and console
- Boot sequence easter egg: brief "BASIC v1.0\nReady.\n" on first load

---

## Stretch Goals

- Graphics mode: canvas-backed SCREEN, PSET, LINE, CIRCLE
- Sound: BEEP, PLAY statement via Web Audio API
- Expanded language support and compatibility polish
- Syntax error highlighting in the editor before RUN
- Program sharing via URL (base64-encoded program in hash)

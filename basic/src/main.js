// Main app entry point — wires all components and manages Edit/Run mode transitions.
import { Editor }      from './editor/editor.js';
import { Keyboard }    from './keyboard/keyboard.js';
import { Console }     from './console/console.js';
import { FileBrowser } from './ui/filebrowser.js';
import { saveFile, loadFile, ensureFile, listFiles, renameFile } from './storage/storage.js';

const DEFAULT_NAME   = 'UNTITLED';
const DEFAULT_SOURCE = '10 PRINT "HELLO, WORLD!"\n';
const FIBB_NAME      = 'FIBB';
const FIBB_SOURCE    = [
  '10 INPUT N',
  '20 A=0',
  '30 B=1',
  '40 FOR I=1 TO N',
  '50 PRINT A',
  '60 T=A+B',
  '70 A=B',
  '80 B=T',
  '90 NEXT I',
  ''
].join('\n');

class App {
  constructor() {
    this.currentFile   = DEFAULT_NAME;
    this.mode          = 'edit'; // 'edit' | 'run'
    this._running      = false;
    this._worker       = null;
    this._runKeyboardVisible = false;
    this._awaitingInput = false;

    this._buildDOM();
    this._initComponents();
    this._loadLastFile();
  }

  // ── DOM scaffold ──────────────────────────────────────────────────────────
  _buildDOM() {
    document.querySelector('#app').innerHTML = `
      <!-- Toolbar -->
      <div class="toolbar" id="toolbar">
        <button id="btn-files">☰ FILES</button>
        <span class="filename" id="filename">${DEFAULT_NAME}.BAS</span>
        <button class="primary" id="btn-run">▶ RUN</button>
      </div>

      <!-- Edit Mode -->
      <div class="mode-panel active" id="edit-mode">
        <div id="editor-container" style="flex:1;overflow:hidden;display:flex;flex-direction:column;"></div>
      </div>

      <!-- Run Mode -->
      <div class="mode-panel" id="run-mode">
        <div id="console-container" style="flex:1;overflow:hidden;display:flex;flex-direction:column;"></div>
      </div>

      <!-- Shared keyboard -->
      <div id="keyboard-container"></div>

      <!-- File browser (portal) -->
      <div id="filebrowser-container"></div>
    `;
  }

  // ── Component wiring ──────────────────────────────────────────────────────
  _initComponents() {
    ensureFile(FIBB_NAME, FIBB_SOURCE);

    this.editor   = new Editor(document.querySelector('#editor-container'));
    this.console  = new Console(document.querySelector('#console-container'));
    this.keyboard = new Keyboard(document.querySelector('#keyboard-container'), key => this._onKey(key));
    this.browser  = new FileBrowser(document.querySelector('#filebrowser-container'), (name, src) => {
      this.currentFile = name;
      this.editor.setSource(src);
      this._updateFilename();
    });

    this._bindEditToolbar();
  }

  // ── Key routing ───────────────────────────────────────────────────────────
  _onKey(text) {
    if (this.mode === 'run') {
      this.console.handleKey(text);
    } else {
      this.editor.insertText(text);
    }
  }

  // ── File management ───────────────────────────────────────────────────────
  _loadLastFile() {
    // Try to restore last edited file from localStorage
    const last = localStorage.getItem('basic_last_file');
    const src  = last ? loadFile(last) : null;
    if (last && src !== null) {
      this.currentFile = last;
      this.editor.setSource(src);
    } else {
      this.editor.setSource(DEFAULT_SOURCE);
    }
    this._updateFilename();
  }

  _saveCurrentFile() {
    const src = this.editor.getSource();
    saveFile(this.currentFile, src);
    localStorage.setItem('basic_last_file', this.currentFile);
  }

  _updateFilename() {
    const name = this.currentFile.endsWith('.BAS')
      ? this.currentFile : this.currentFile + '.BAS';
    const filenameEl = document.querySelector('#filename');
    filenameEl.textContent = name;
    if (this.mode === 'edit') {
      filenameEl.classList.add('renameable');
      filenameEl.title = 'Tap to rename';
    } else {
      filenameEl.classList.remove('renameable');
      filenameEl.removeAttribute('title');
    }
    localStorage.setItem('basic_last_file', this.currentFile);
  }

  // ── Mode transitions ──────────────────────────────────────────────────────
  _enterEditMode() {
    this.mode = 'edit';
    this._running = false;
    this._awaitingInput = false;
    document.querySelector('#edit-mode').classList.add('active');
    document.querySelector('#run-mode').classList.remove('active');

    const tb = document.querySelector('#toolbar');
    tb.innerHTML = `
      <button id="btn-files">☰ FILES</button>
      <span class="filename" id="filename"></span>
      <button class="primary" id="btn-run">▶ RUN</button>
    `;
    this._updateFilename();
    this._bindEditToolbar();

    this._syncKeyboardVisibility();
  }

  _enterRunMode() {
    this.mode = 'run';
    this._awaitingInput = false;
    this._runKeyboardVisible = false;
    document.querySelector('#edit-mode').classList.remove('active');
    document.querySelector('#run-mode').classList.add('active');

    const tb = document.querySelector('#toolbar');
    tb.innerHTML = `
      <button id="btn-edit">◀ EDIT</button>
      <span class="filename" id="filename" style="color:var(--green-dim)">RUNNING…</span>
      <button id="btn-kbd">SHOW KBD</button>
      <button class="danger" id="btn-stop">■ STOP</button>
    `;
    document.querySelector('#btn-edit').addEventListener('click', () => {
      this._stopRun();
      this._enterEditMode();
    });
    document.querySelector('#btn-stop').addEventListener('click', () => {
      this._stopRun();
      document.querySelector('#filename').textContent = 'STOPPED';
    });
    document.querySelector('#btn-kbd').addEventListener('click', () => {
      this._runKeyboardVisible = !this._runKeyboardVisible;
      this._syncKeyboardVisibility();
    });
    this._syncKeyboardVisibility();
  }

  // ── Interpreter ───────────────────────────────────────────────────────────
  async _startRun() {
    this._saveCurrentFile();
    this._enterRunMode();
    this.console.clear();

    const rawSource = this.editor.getSource();
    if (!rawSource.trim()) {
      this.console.write('No program to run.\n');
      return;
    }
    // Normalize smart/curly quotes to straight ASCII quotes (iOS auto-correct)
    const source = rawSource
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

    // Fresh worker for every run — isolates C global state, allows clean STOP
    if (this._worker) this._worker.terminate();
    this._worker = new Worker('./dist/bas-worker.js');
    this._running = true;

    this._worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'output') {
        this.console.write(msg.text);
      } else if (msg.type === 'error') {
        if (msg.text.includes('stdio streams had content in them that was not flushed')) {
          return;
        }
        this.console.writeError(msg.text);
      } else if (msg.type === 'input-needed') {
        this._awaitingInput = true;
        this._runKeyboardVisible = true;
        this.console.showInput('? ', line => {
          if (this._worker) this._worker.postMessage({ type: 'input', line });
        });
        this._syncKeyboardVisibility();
      } else if (msg.type === 'done') {
        this._running = false;
        this._awaitingInput = false;
        this._runKeyboardVisible = false;
        this._worker = null;
        const exitCode = msg.exitCode || 0;
        this.console.write(exitCode === 0 ? '\nOk\n' : `\nExited (${exitCode})\n`);
        const fn = document.querySelector('#filename');
        if (fn) fn.textContent = exitCode === 0 ? 'DONE' : 'STOPPED';
        this._syncKeyboardVisibility();
      }
    };

    this._worker.onerror = (e) => {
      this.console.writeError(`\nWorker error: ${e.message}\n`);
      this._running = false;
      this._awaitingInput = false;
      this._runKeyboardVisible = false;
      this._worker = null;
      this._syncKeyboardVisibility();
    };

    this._worker.postMessage({ type: 'run', source });
  }

  _stopRun() {
    this._running = false;
    this._awaitingInput = false;
    this._runKeyboardVisible = false;
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
    this._syncKeyboardVisibility();
  }

  _syncKeyboardVisibility() {
    const el = document.querySelector('#keyboard-container');
    if (!el) return;
    const show = this.mode === 'edit' || this._runKeyboardVisible;
    el.style.display = show ? '' : 'none';
    el.classList.toggle('run-keyboard', this.mode === 'run');

    const btn = document.querySelector('#btn-kbd');
    if (btn) {
      btn.textContent = this._runKeyboardVisible ? 'HIDE KBD' : 'SHOW KBD';
    }
  }

  _bindEditToolbar() {
    document.querySelector('#btn-files').addEventListener('click', () => this.browser.show());
    document.querySelector('#btn-run').addEventListener('click',   () => this._startRun());
    document.querySelector('#filename').addEventListener('click',  () => this._promptRenameCurrentFile());
  }

  _promptRenameCurrentFile() {
    if (this.mode !== 'edit') return;

    const nextName = prompt('Rename program:', this.currentFile);
    if (nextName === null) return;

    const trimmed = nextName.trim().toUpperCase();
    if (!trimmed || trimmed === this.currentFile) return;
    if (listFiles().some(file => file.name === trimmed)) {
      alert(`A program named ${trimmed} already exists.`);
      return;
    }
    if (!renameFile(this.currentFile, trimmed)) {
      alert('Rename failed.');
      return;
    }

    this.currentFile = trimmed;
    this._updateFilename();
  }
}

// Boot
window.addEventListener('DOMContentLoaded', () => {
  // Brief boot message in the page title
  document.title = 'BASIC';
  new App();
});

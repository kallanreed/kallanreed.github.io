// Main app entry point — wires all components and manages Edit/Run mode transitions.
import { Editor }      from './editor/editor.js';
import { Keyboard }    from './keyboard/keyboard.js';
import { Console }     from './console/console.js';
import { FileBrowser } from './ui/filebrowser.js';
import { saveFile, loadFile } from './storage/storage.js';

const DEFAULT_NAME   = 'UNTITLED';
const DEFAULT_SOURCE = '10 PRINT "HELLO, WORLD!"\n20 GOTO 10\n';

class App {
  constructor() {
    this.currentFile   = DEFAULT_NAME;
    this.mode          = 'edit'; // 'edit' | 'run'
    this._basModule    = null;
    this._running      = false;

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
        <div id="keyboard-container"></div>
      </div>

      <!-- Run Mode -->
      <div class="mode-panel" id="run-mode">
        <div id="console-container" style="flex:1;overflow:hidden;display:flex;flex-direction:column;"></div>
      </div>

      <!-- File browser (portal) -->
      <div id="filebrowser-container"></div>
    `;
  }

  // ── Component wiring ──────────────────────────────────────────────────────
  _initComponents() {
    this.editor   = new Editor(document.querySelector('#editor-container'));
    this.console  = new Console(document.querySelector('#console-container'));
    this.keyboard = new Keyboard(document.querySelector('#keyboard-container'), key => this._onKey(key));
    this.browser  = new FileBrowser(document.querySelector('#filebrowser-container'), (name, src) => {
      this.currentFile = name;
      this.editor.setSource(src);
      this._updateFilename();
    });

    document.querySelector('#btn-files').addEventListener('click', () => this.browser.show());
    document.querySelector('#btn-run').addEventListener('click',   () => this._startRun());
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
    document.querySelector('#filename').textContent = name;
    localStorage.setItem('basic_last_file', this.currentFile);
  }

  // ── Mode transitions ──────────────────────────────────────────────────────
  _enterEditMode() {
    this.mode = 'edit';
    this._running = false;
    document.querySelector('#edit-mode').classList.add('active');
    document.querySelector('#run-mode').classList.remove('active');

    const tb = document.querySelector('#toolbar');
    tb.innerHTML = `
      <button id="btn-files">☰ FILES</button>
      <span class="filename" id="filename"></span>
      <button class="primary" id="btn-run">▶ RUN</button>
    `;
    this._updateFilename();
    document.querySelector('#btn-files').addEventListener('click', () => this.browser.show());
    document.querySelector('#btn-run').addEventListener('click',   () => this._startRun());

    // Show full keyboard again
    document.querySelector('#keyboard-container').style.display = '';
  }

  _enterRunMode() {
    this.mode = 'run';
    document.querySelector('#edit-mode').classList.remove('active');
    document.querySelector('#run-mode').classList.add('active');

    // Hide the keyword keyboard in run mode (only input strip matters)
    document.querySelector('#keyboard-container').style.display = 'none';

    const tb = document.querySelector('#toolbar');
    tb.innerHTML = `
      <button id="btn-edit">◀ EDIT</button>
      <span class="filename" id="filename" style="color:var(--green-dim)">RUNNING…</span>
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
  }

  // ── Interpreter ───────────────────────────────────────────────────────────
  async _startRun() {
    this._saveCurrentFile();
    this._enterRunMode();
    this.console.clear();

    const source = this.editor.getSource();
    if (!source.trim()) {
      this.console.write('No program to run.\n');
      return;
    }

    try {
      await this._runBas(source);
    } catch (err) {
      this.console.writeError(`\nInternal error: ${err.message}\n`);
    }

    if (this._running) {
      // Program ended normally
      this.console.write('\nOk\n');
      document.querySelector('#filename') &&
        (document.querySelector('#filename').textContent = 'DONE');
      this._running = false;
    }
  }

  _stopRun() {
    this._running = false;
    // Signal BAS_IO to abort any pending input
    if (window.BAS_IO && window.BAS_IO._inputResolve) {
      window.BAS_IO._inputResolve('');
      window.BAS_IO._inputResolve = null;
    }
  }

  async _runBas(source) {
    // Load the Emscripten module lazily on first run
    if (!this._basModule) {
      if (typeof createBasModule === 'undefined') {
        this.console.writeError('WASM interpreter not loaded.\n');
        return;
      }
      this._basModule = await createBasModule(); // eslint-disable-line no-undef
    }

    // Wire BAS_IO callbacks
    const io = window.BAS_IO;
    io.onOutput = text => {
      if (!this._running) return;
      this.console.write(text);
    };
    io.onError = text => {
      this.console.writeError(text);
    };
    io.onInputNeeded = () => {
      // Show the input strip in Run Mode and route keyboard to console
      this.console.showInput('? ', line => {
        io.provideInput(line);
      });
      // Show minimal keyboard row for text entry
      document.querySelector('#keyboard-container').style.display = '';
    };

    // Write the program to the WASM virtual filesystem and run it
    const Module = this._basModule;
    const enc    = new TextEncoder();
    const bytes  = enc.encode(source);
    Module.FS.writeFile('/program.bas', bytes);

    this._running = true;
    // bas main() expects argv[1] = filename
    Module.callMain(['/program.bas']);
  }
}

// Boot
window.addEventListener('DOMContentLoaded', () => {
  // Brief boot message in the page title
  document.title = 'BASIC';
  new App();
});

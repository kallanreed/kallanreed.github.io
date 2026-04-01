// File browser slide-in panel

import { listFiles, loadFile, saveFile, deleteFile, renameFile, exportFile, importFile } from '../storage/storage.js';

export class FileBrowser {
  constructor(container, onOpen) {
    this.container = container;
    this.onOpen = onOpen; // function(name, source)
    this._render();
  }

  _render() {
    this.container.innerHTML = `
      <div class="file-overlay" id="file-overlay">
        <div class="file-panel">
          <div class="file-panel-header">
            <h2>FILES</h2>
            <button id="file-close" class="file-close-btn" aria-label="Close files">✕</button>
          </div>
          <div class="file-panel-actions">
            <button id="file-new">NEW</button>
            <button id="file-import">IMPORT</button>
          </div>
          <div class="file-list" id="file-list"></div>
        </div>
      </div>
    `;

    this.overlay = this.container.querySelector('#file-overlay');
    this.listEl  = this.container.querySelector('#file-list');

    this.container.querySelector('#file-close').addEventListener('click', () => this.hide());
    this.overlay.addEventListener('click', e => {
      if (e.target === this.overlay) this.hide();
    });

    this.container.querySelector('#file-new').addEventListener('click', () => {
      const name = prompt('Program name:');
      if (!name) return;
      const upper = name.toUpperCase();
      saveFile(upper, '');
      this.onOpen(upper, '');
      this.hide();
    });

    this.container.querySelector('#file-import').addEventListener('click', () => {
      importFile((name) => {
        const src = loadFile(name);
        this.onOpen(name, src || '');
        this.hide();
      });
    });
  }

  show() {
    this._refreshList();
    this.overlay.classList.add('open');
  }

  hide() {
    this.overlay.classList.remove('open');
  }

  _refreshList() {
    const files = listFiles();
    if (files.length === 0) {
      this.listEl.innerHTML = '<div class="file-item"><span class="file-meta">No saved programs</span></div>';
      return;
    }
    this.listEl.innerHTML = files.map(f => `
      <div class="file-item" data-name="${escAttr(f.name)}">
        <div>
          <div class="file-name">${escHtml(f.name)}</div>
          <div class="file-meta">${f.modified ? new Date(f.modified).toLocaleDateString() : ''}</div>
        </div>
        <div class="file-item-actions">
          <button class="export-btn" data-name="${escAttr(f.name)}">EXPORT</button>
          <button class="delete-btn" data-name="${escAttr(f.name)}">DEL</button>
        </div>
      </div>
    `).join('');

    this.listEl.querySelectorAll('.file-item').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.classList.contains('export-btn')) {
          exportFile(e.target.dataset.name);
          return;
        }
        if (e.target.classList.contains('delete-btn')) {
          const name = e.target.dataset.name;
          if (confirm(`Delete ${name}?`)) {
            deleteFile(name);
            this._refreshList();
          }
          return;
        }
        const name = el.dataset.name;
        const src = loadFile(name);
        if (src !== null) { this.onOpen(name, src); this.hide(); }
      });
    });
  }
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s) { return String(s).replace(/"/g,'&quot;'); }

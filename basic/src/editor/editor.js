// Editor component: contenteditable BASIC editor with syntax highlighting.
// Uses inputmode="none" to suppress the iOS system keyboard.

import { KAR_BASIC_KEYWORDS } from '../kar-basic/language.mjs';

const KW_PATTERN = new RegExp(`\\b(${KAR_BASIC_KEYWORDS.join('|')})\\b`, 'gi');

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function highlightLine(line) {
  const labelMatch = line.match(/^(\s*)([A-Z_][A-Z0-9_]*:)(\s*)(.*)$/i);
  let prefix = '';
  let rest = line;
  if (labelMatch) {
    prefix = `${escHtml(labelMatch[1])}<span class="ln">${escHtml(labelMatch[2])}</span>${escHtml(labelMatch[3])}`;
    rest = labelMatch[4];
  }

  const remMatch = rest.match(/^(\s*)(REM\b.*)/i);
  if (remMatch) {
    return prefix + escHtml(remMatch[1]) + `<span class="rem">${escHtml(remMatch[2])}</span>`;
  }

  let result = '';
  let i = 0;
  while (i < rest.length) {
    if (rest[i] === '"') {
      let j = i + 1;
      while (j < rest.length && rest[j] !== '"') j++;
      j++;
      result += `<span class="str">${escHtml(rest.slice(i, j))}</span>`;
      i = j;
    } else {
      const chunk = rest.slice(i);
      KW_PATTERN.lastIndex = 0;
      const km = KW_PATTERN.exec(chunk);
      if (km && km.index === 0) {
        result += `<span class="kw">${escHtml(km[0])}</span>`;
        i += km[0].length;
      } else if (/\d/.test(rest[i])) {
        const nm = chunk.match(/^\d+(\.\d+)?/);
        result += `<span class="num">${escHtml(nm[0])}</span>`;
        i += nm[0].length;
      } else {
        result += escHtml(rest[i]);
        i++;
      }
    }
  }

  return prefix + result;
}

export class Editor {
  constructor(container) {
    this.container = container;
    this._source = '';
    this._onChange = null;
    this._onKey = null;
    this._render();
  }

  _render() {
    this.container.innerHTML = `<div class="editor-wrap"><div id="editor" contenteditable="true" inputmode="none" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div></div>`;
    this.el = this.container.querySelector('#editor');
    this._bindEvents();
  }

  _bindEvents() {
    // Prevent default keyboard input — all input comes from custom keyboard
    this.el.addEventListener('keydown', e => {
      if (this._onKey) this._onKey(e);
      // Allow copy/paste shortcuts
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
    });

    this.el.addEventListener('input', () => {
      // Should not normally fire since we prevent keydown, but handle paste
      this._syncFromDOM();
    });
  }

  setOnChange(fn) { this._onChange = fn; }
  setOnKey(fn)    { this._onKey = fn; }

  getSource() { return this._source; }

  setSource(src) {
    this._source = src;
    this._renderHighlight();
  }

  // Called by the custom keyboard to insert text / perform edits
  insertText(text) {
    this._insertAtCursor(text);
  }

  _insertAtCursor(text) {
    const { line, col } = this._getCursorPos();
    const lines = this._source.split('\n');

    if (text === '\n') {
      lines.splice(line + 1, 0, '');
      this._source = lines.join('\n');
      this._renderHighlight();
      this._setCursorPos(line + 1, 0);
    } else if (text === 'BACKSPACE') {
      if (col > 0) {
        lines[line] = lines[line].slice(0, col - 1) + lines[line].slice(col);
        this._source = lines.join('\n');
        this._renderHighlight();
        this._setCursorPos(line, col - 1);
      } else if (line > 0) {
        const prevLen = lines[line - 1].length;
        lines[line - 1] += lines[line];
        lines.splice(line, 1);
        this._source = lines.join('\n');
        this._renderHighlight();
        this._setCursorPos(line - 1, prevLen);
      }
    } else if (text === 'LEFT') {
      if (col > 0) this._setCursorPos(line, col - 1);
      else if (line > 0) this._setCursorPos(line - 1, (lines[line-1]||'').length);
    } else if (text === 'RIGHT') {
      const lineLen = (lines[line] || '').length;
      if (col < lineLen) this._setCursorPos(line, col + 1);
      else if (line < lines.length - 1) this._setCursorPos(line + 1, 0);
    } else {
      lines[line] = lines[line].slice(0, col) + text + lines[line].slice(col);
      this._source = lines.join('\n');
      this._renderHighlight();
      this._setCursorPos(line, col + text.length);
    }

    if (this._onChange) this._onChange(this._source);
  }

  _renderHighlight() {
    const lines = this._source.split('\n');
    this.el.innerHTML = lines.map(l => `<div>${highlightLine(l) || '<br>'}</div>`).join('');
  }

  _syncFromDOM() {
    // Fallback for paste events
    this._source = this.el.innerText;
    this._renderHighlight();
    if (this._onChange) this._onChange(this._source);
  }

  // Returns { line, col } of the current cursor in the source
  _getCursorPos() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return { line: 0, col: 0 };
    const range = sel.getRangeAt(0);
    const divs = this.el.querySelectorAll('div');
    let lineIdx = 0;
    for (let i = 0; i < divs.length; i++) {
      if (divs[i].contains(range.startContainer)) { lineIdx = i; break; }
    }
    // Walk text nodes to find column
    let col = 0;
    const walker = document.createTreeWalker(divs[lineIdx] || this.el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node === range.startContainer) { col += range.startOffset; break; }
      col += node.textContent.length;
    }
    return { line: lineIdx, col };
  }

  _setCursorPos(lineIdx, col) {
    const divs = this.el.querySelectorAll('div');
    const targetDiv = divs[lineIdx];
    if (!targetDiv) return;
    targetDiv.scrollIntoView({ block: 'nearest' });
    const range = document.createRange();
    const sel = window.getSelection();
    let remaining = col;
    const walker = document.createTreeWalker(targetDiv, NodeFilter.SHOW_TEXT);
    let node, placed = false;
    while ((node = walker.nextNode())) {
      if (remaining <= node.textContent.length) {
        range.setStart(node, remaining);
        range.collapse(true);
        placed = true;
        break;
      }
      remaining -= node.textContent.length;
    }
    if (!placed) {
      range.selectNodeContents(targetDiv);
      range.collapse(false);
    }
    sel.removeAllRanges();
    sel.addRange(range);
    this.el.focus();
  }

  focus() { this.el.focus(); }
  setReadOnly(v) { this.el.contentEditable = v ? 'false' : 'true'; }
}

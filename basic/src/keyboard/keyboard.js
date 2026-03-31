// Custom on-screen keyboard component.
// Suppresses the iOS system keyboard (editor uses inputmode="none").
// Emits key events to the active target (editor or console input).
// Two layers: LETTERS (QWERTY) and SYMBOLS (digits + operators), toggled by a mode key.

import { KAR_BASIC_KEYBOARD_KEYWORDS } from '../kar-basic/language.mjs';

// QWERTY letter rows (BASIC is case-insensitive but uppercase is canonical)
const LETTER_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M'],
];

const SYMBOL_ROWS = [
  [
    { label: '1' }, { label: '2' }, { label: '3' }, { label: '4' }, { label: '5' },
    { label: '6' }, { label: '7' }, { label: '8' }, { label: '9' }, { label: '0' },
  ],
  [
    { label: '+' }, { label: '-' }, { label: '*' }, { label: '/' }, { label: '=' },
    { label: '<' }, { label: '>' }, { label: '^' }, { label: '(' }, { label: ')' },
  ],
  [
    { label: '"' }, { label: "'" }, { label: '_' }, { label: '.' }, { label: ',' },
    { label: ';' }, { label: ':' }, { label: '#' }, { label: '!' }, { label: '?' },
  ],
];

// Bottom control row is the same in both modes
function controlRow(modeLabel) {
  return [
    { label: modeLabel, action: '__MODE__', cls: 'action mode-toggle' },
    { label: '◀', action: 'LEFT',  cls: 'nav' },
    { label: '▶', action: 'RIGHT', cls: 'nav' },
    { label: 'SPACE', action: ' ', cls: 'wide' },
    { label: '⌫', action: 'BACKSPACE', cls: 'action' },
    { label: '↵', action: '\n', cls: 'action' },
  ];
}

function renderRow(keys) {
  return `<div class="key-row">${keys.map(k => {
    const action = k.action !== undefined ? k.action : k.label;
    const safe = action.replace(/"/g, '&quot;');
    return `<div class="key ${k.cls||''}" data-action="${safe}">${k.label}</div>`;
  }).join('')}</div>`;
}

export class Keyboard {
  constructor(container, onKey) {
    this.container = container;
    this.onKey = onKey;
    this._mode = 'letters'; // 'letters' | 'symbols'
    this._activePress = null;

    // Attach listeners once — they delegate into the rebuilt DOM each time
    this.container.addEventListener('pointerdown', e => {
      const key = e.target.closest('[data-action]');
      if (!key) return;

      const strip = key.closest('.keyword-strip');
      if (!strip) {
        e.preventDefault();
      }

      this._clearPressedState();
      key.classList.add('pressed');
      this._activePress = {
        key,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startScrollLeft: strip ? strip.scrollLeft : 0,
        cancelled: false,
      };
    });

    this.container.addEventListener('pointermove', e => {
      if (!this._activePress || this._activePress.pointerId !== e.pointerId) return;

      const { key, startX, startY, startScrollLeft } = this._activePress;
      const strip = key.closest('.keyword-strip');
      const movedX = Math.abs(e.clientX - startX);
      const movedY = Math.abs(e.clientY - startY);
      const scrolledX = strip ? Math.abs(strip.scrollLeft - startScrollLeft) : 0;

      if (movedX > 10 || movedY > 10 || scrolledX > 6) {
        this._activePress.cancelled = true;
        key.classList.remove('pressed');
      }
    });

    this.container.addEventListener('pointerup', e => {
      if (!this._activePress || this._activePress.pointerId !== e.pointerId) return;

      const { key, cancelled } = this._activePress;
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-action]');
      this._clearPressedState();

      if (cancelled || target !== key) return;

      const action = key.dataset.action;
      if (action === '__MODE__') {
        this._mode = this._mode === 'letters' ? 'symbols' : 'letters';
        this._render();
        return;
      }

      this.onKey(action);
    });

    this.container.addEventListener('pointercancel', () => this._clearPressedState());
    this.container.addEventListener('pointerleave', e => {
      if (!this._activePress || this._activePress.pointerId !== e.pointerId) return;
      this._activePress.key.classList.remove('pressed');
    });

    this._render();
  }

  _clearPressedState() {
    if (!this._activePress) return;
    this._activePress.key.classList.remove('pressed');
    this._activePress = null;
  }

  _render() {
    const isLetters = this._mode === 'letters';
    const bodyRows = isLetters ? LETTER_ROWS : SYMBOL_ROWS;
    const modeLabel = isLetters ? '123' : 'ABC';

    this.container.innerHTML = `
      <div class="keyboard">
        <div class="key-row keyword-strip" id="kw-strip"></div>
        ${bodyRows.map(row =>
          renderRow(row.map(k => typeof k === 'string' ? { label: k } : k))
        ).join('')}
        ${renderRow(controlRow(modeLabel))}
      </div>
    `;

    // Populate keyword strip
    const strip = this.container.querySelector('#kw-strip');
    KAR_BASIC_KEYBOARD_KEYWORDS.forEach(kw => {
      const el = document.createElement('div');
      el.className = 'key keyword';
      el.dataset.action = kw + ' ';
      el.textContent = kw;
      strip.appendChild(el);
    });
  }
}

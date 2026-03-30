// Custom on-screen keyboard component.
// Suppresses the iOS system keyboard (editor uses inputmode="none").
// Emits key events to the active target (editor or console input).
// Two layers: LETTERS (QWERTY) and SYMBOLS (digits + operators), toggled by a mode key.

const KEYWORDS = [
  'PRINT','INPUT','IF','THEN','ELSE','GOTO','GOSUB','RETURN','FOR','TO','NEXT',
  'WHILE','WEND','DIM','LET','REM','END','STOP','CLS','AND','OR','NOT','MOD',
  'STEP','DATA','READ','RESTORE','ON','RENUM',
];

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
    { label: '"' }, { label: "'" }, { label: '$' }, { label: '.' }, { label: ',' },
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

    // Attach listeners once — they delegate into the rebuilt DOM each time
    this.container.addEventListener('pointerdown', e => {
      const key = e.target.closest('[data-action]');
      if (!key) return;
      e.preventDefault();
      key.classList.add('pressed');
      const action = key.dataset.action;
      if (action === '__MODE__') {
        this._mode = this._mode === 'letters' ? 'symbols' : 'letters';
        this._render();
      } else {
        this.onKey(action);
      }
    });

    this.container.addEventListener('pointerup', e => {
      const key = e.target.closest('[data-action]');
      if (key) key.classList.remove('pressed');
    });

    this._render();
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
    KEYWORDS.forEach(kw => {
      const el = document.createElement('div');
      el.className = 'key keyword';
      el.dataset.action = kw + ' ';
      el.textContent = kw;
      strip.appendChild(el);
    });
  }
}

// Custom on-screen keyboard component.
// Suppresses the iOS system keyboard (editor uses inputmode="none").
// Emits key events to the active target (editor or console input).

const KEYWORD_ROWS = [
  ['PRINT','INPUT','IF','THEN','ELSE','GOTO','GOSUB','RETURN','FOR','TO','NEXT',
   'WHILE','WEND','DIM','LET','REM','END','STOP','CLS','AND','OR','NOT','MOD',
   'STEP','DATA','READ','RESTORE','ON','RENUM'],
];

const CHAR_ROWS = [
  [
    { label: '1' }, { label: '2' }, { label: '3' },
    { label: '+' }, { label: '-' }, { label: '=' },
    { label: '<' }, { label: '>' }, { label: '^' },
  ],
  [
    { label: '4' }, { label: '5' }, { label: '6' },
    { label: '*' }, { label: '/' }, { label: '(' },
    { label: ')' }, { label: '"' }, { label: '$' },
  ],
  [
    { label: '7' }, { label: '8' }, { label: '9' }, { label: '0' },
    { label: '.' }, { label: ',' }, { label: ';' }, { label: ':' }, { label: '#' },
  ],
  [
    { label: '⌫',  action: 'BACKSPACE', cls: 'action' },
    { label: '◀',  action: 'LEFT',      cls: 'dim' },
    { label: '▶',  action: 'RIGHT',     cls: 'dim' },
    { label: 'SPACE', action: ' ', cls: 'wide' },
    { label: '↵',  action: '\n', cls: 'action wide' },
  ],
];

export class Keyboard {
  constructor(container, onKey) {
    this.container = container;
    this.onKey = onKey; // function(text)
    this._render();
  }

  _render() {
    this.container.innerHTML = `
      <div class="keyboard">
        <div class="key-row keyword-strip" id="kw-strip"></div>
        ${CHAR_ROWS.map(row => `
          <div class="key-row">
            ${row.map(k => `
              <div class="key ${k.cls||''}" data-action="${k.action !== undefined ? k.action : k.label}">
                ${k.label}
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `;

    // Populate keyword strip
    const strip = this.container.querySelector('#kw-strip');
    KEYWORD_ROWS[0].forEach(kw => {
      const el = document.createElement('div');
      el.className = 'key keyword';
      el.dataset.action = kw + ' ';
      el.textContent = kw;
      strip.appendChild(el);
    });

    // Single event listener on the keyboard container (event delegation)
    this.container.addEventListener('pointerdown', e => {
      const key = e.target.closest('[data-action]');
      if (!key) return;
      e.preventDefault();
      key.classList.add('pressed');
      const action = key.dataset.action;
      this.onKey(action);
    });

    this.container.addEventListener('pointerup', e => {
      const key = e.target.closest('[data-action]');
      if (key) key.classList.remove('pressed');
    });
  }
}

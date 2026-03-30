// Terminal console component for Run Mode.
// Streams output from bas, handles INPUT prompt, auto-scrolls.

export class Console {
  constructor(container) {
    this.container = container;
    this._onSubmit = null;
    this._render();
  }

  _render() {
    this.container.innerHTML = `
      <div class="console-wrap" id="console-wrap">
        <div id="console-output"></div>
      </div>
      <div class="input-strip" id="input-strip">
        <span class="prompt-label" id="input-prompt"></span>
        <span id="console-input-display"></span><span class="cursor"></span>
      </div>
    `;
    this.outputEl  = this.container.querySelector('#console-output');
    this.wrapEl    = this.container.querySelector('#console-wrap');
    this.stripEl   = this.container.querySelector('#input-strip');
    this.promptEl  = this.container.querySelector('#input-prompt');
    this.inputDisplay = this.container.querySelector('#console-input-display');
    this._inputBuffer = '';
  }

  clear() {
    this.outputEl.textContent = '';
    this._inputBuffer = '';
    this.hideInput();
  }

  // Append text to output (called for each chunk from bas stdout)
  write(text) {
    const node = document.createTextNode(text);
    this.outputEl.appendChild(node);
    this._scrollToBottom();
  }

  writeError(text) {
    const span = document.createElement('span');
    span.style.color = '#ff6060';
    span.textContent = text;
    this.outputEl.appendChild(span);
    this._scrollToBottom();
  }

  writeBoot() {
    const pre = document.createElement('div');
    pre.className = 'boot-splash';
    pre.textContent = 'GW-BASIC  Version 2.5\nCopyright (C) Michael Haardt\n\nOk\n';
    this.outputEl.appendChild(pre);
  }

  // Show INPUT prompt strip and buffer keys from the keyboard
  showInput(promptText, onSubmit) {
    this._inputBuffer = '';
    this._onSubmit = onSubmit;
    this.promptEl.textContent = promptText;
    this.inputDisplay.textContent = '';
    this.stripEl.classList.add('visible');
    this._scrollToBottom();
  }

  hideInput() {
    this.stripEl.classList.remove('visible');
    this._onSubmit = null;
  }

  // Called by the keyboard during INPUT mode
  handleKey(text) {
    if (!this.stripEl.classList.contains('visible')) return false;

    if (text === '\n') {
      const line = this._inputBuffer;
      const onSubmit = this._onSubmit;
      this._inputBuffer = '';
      this.inputDisplay.textContent = '';
      this.hideInput();
      if (onSubmit) onSubmit(line);
    } else if (text === 'BACKSPACE') {
      this._inputBuffer = this._inputBuffer.slice(0, -1);
      this.inputDisplay.textContent = this._inputBuffer;
    } else if (text === 'LEFT' || text === 'RIGHT') {
      // Ignore cursor movement in input strip
    } else {
      this._inputBuffer += text;
      this.inputDisplay.textContent = this._inputBuffer;
    }
    return true;
  }

  _scrollToBottom() {
    requestAnimationFrame(() => {
      this.wrapEl.scrollTop = this.wrapEl.scrollHeight;
    });
  }
}

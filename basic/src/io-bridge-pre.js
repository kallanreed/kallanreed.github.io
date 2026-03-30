// Emscripten pre-js: set up stdin/stdout bridges before the module loads.
// This file is injected by emcc --pre-js and runs before Module initialization.

var BAS_IO = {
  // Output callback - set by the app before running
  onOutput: null,  // function(text)
  onError: null,   // function(text)

  // Input queue for stdin - filled by the app when user submits a line
  _inputResolve: null,
  _pendingInput: null,

  // Called by the app to deliver a line of user input (from custom keyboard)
  provideInput: function(line) {
    if (this._inputResolve) {
      var resolve = this._inputResolve;
      this._inputResolve = null;
      resolve(line + '\n');
    } else {
      this._pendingInput = line + '\n';
    }
  },

  // Called by Emscripten stdin machinery (via Asyncify) to get the next line
  waitForInput: function() {
    if (this._pendingInput !== null) {
      var line = this._pendingInput;
      this._pendingInput = null;
      return Promise.resolve(line);
    }
    return new Promise(function(resolve) {
      BAS_IO._inputResolve = resolve;
    });
  }
};

// Wire into the Emscripten Module before it initializes
var Module = {
  print: function(text) {
    if (BAS_IO.onOutput) BAS_IO.onOutput(text + '\n');
  },
  printErr: function(text) {
    self.postMessage && self.postMessage({ type: 'error', text: text + '\n' });
    if (BAS_IO.onError) BAS_IO.onError(text + '\n');
  },

  // Provide stdin via a TTY input function.
  // Emscripten calls this once per character; we buffer a full line.
  _stdinBuffer: '',
  _stdinPos: 0,
  stdin: function() {
    // This is called synchronously by Emscripten's TTY layer.
    // With ASYNCIFY we can suspend here until a line is available.
    // The actual async bridging happens in the patched fs.c via js_read_line().
    if (Module._stdinPos < Module._stdinBuffer.length) {
      return Module._stdinBuffer.charCodeAt(Module._stdinPos++);
    }
    return null;
  },

  // Expose BAS_IO globally — use globalThis so it works in both window and Worker
  onRuntimeInitialized: function() {
    globalThis.BAS_IO = BAS_IO;
  }
};

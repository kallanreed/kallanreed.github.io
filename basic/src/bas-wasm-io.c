/**
 * Emscripten-specific I/O shims for bas.
 * Compiled alongside the bas source files.
 * Provides async-capable input via Asyncify and routes stdout to JS callbacks.
 */

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <stdlib.h>
#include <string.h>

/**
 * Read a line of input from the JS side.
 * Asyncify suspends the WASM stack until the user submits a line via the
 * custom keyboard. The JS side calls BAS_IO.provideInput(line) to resume.
 * Returns a malloc'd C string that the caller must free.
 */
EM_JS(char*, bas_wasm_read_line, (), {
  return Asyncify.handleSleep(function(wakeUp) {
    const io = globalThis.BAS_IO;

    function deliver(line) {
      var len = lengthBytesUTF8(line) + 1;
      var ptr = _malloc(len);
      stringToUTF8(line, ptr, len);
      wakeUp(ptr);
    }

    if (io) {
      if (io._pendingInput !== null) {
        var line = io._pendingInput;
        io._pendingInput = null;
        deliver(line);
      } else {
        io._inputResolve = deliver;
        // Notify the UI that input is needed (shows input strip in Run Mode)
        if (io.onInputNeeded) io.onInputNeeded();
      }
    } else {
      deliver("");
    }
  });
});

/**
 * Send output text to the JS console UI.
 */
EM_JS(void, bas_wasm_put_chars, (const char* chars), {
  if (typeof BAS_IO !== 'undefined' && BAS_IO.onOutput) {
    BAS_IO.onOutput(UTF8ToString(chars));
  }
});

#endif /* __EMSCRIPTEN__ */

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
    function deliver(line) {
      var len = lengthBytesUTF8(line) + 1;
      var ptr = _malloc(len);
      stringToUTF8(line, ptr, len);
      wakeUp(ptr);
    }

    if (typeof BAS_IO !== 'undefined') {
      if (BAS_IO._pendingInput !== null) {
        var line = BAS_IO._pendingInput;
        BAS_IO._pendingInput = null;
        deliver(line);
      } else {
        BAS_IO._inputResolve = deliver;
        // Notify the UI that input is needed (shows input strip in Run Mode)
        if (BAS_IO.onInputNeeded) BAS_IO.onInputNeeded();
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

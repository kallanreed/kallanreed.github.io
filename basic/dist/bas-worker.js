// Web Worker: owns one WASM bas module instance per program run.
// Main thread creates a fresh Worker for each RUN and terminates it on STOP.
//
// Protocol (main → worker): { type: 'run', source: string }
//                           { type: 'input', line: string }
// Protocol (worker → main): { type: 'output', text: string }
//                           { type: 'error',  text: string }
//                           { type: 'input-needed' }
//                           { type: 'done', exitCode: number }

importScripts('bas.js');

self.onmessage = async function(e) {
  if (e.data.type === 'run') {
    await runProgram(e.data.source);
  } else if (e.data.type === 'input') {
    const io = self.BAS_IO;
    if (io) {
      if (typeof io.provideInput === 'function') {
        io.provideInput(e.data.line);
      } else if (io._inputResolve) {
        const fn = io._inputResolve;
        io._inputResolve = null;
        fn(e.data.line + '\n');
      }
    }
  }
};

async function runProgram(source) {
  try {
    const Module = await createBasModule(); // eslint-disable-line no-undef

    const io = self.BAS_IO;
    let lastActivity = Date.now();
    const markActivity = () => { lastActivity = Date.now(); };

    io.onOutput = text => {
      markActivity();
      self.postMessage({ type: 'output', text });
    };
    io.onError = text => {
      if (text.includes('stdio streams had content in them that was not flushed')) {
        return;
      }
      markActivity();
      self.postMessage({ type: 'error', text });
    };
    io.onInputNeeded = () => {
      markActivity();
      self.postMessage({ type: 'input-needed' });
    };

    const enc = new TextEncoder();
    const encoded = enc.encode(source);
    Module.FS.writeFile('/program.bas', encoded);
    Module.callMain(['/program.bas']);

    await waitForProgramIdle(io, () => lastActivity);
    self.postMessage({ type: 'done', exitCode: 0 });
  } catch (e) {
    if (e && e.name === 'ExitStatus') {
      self.postMessage({ type: 'done', exitCode: e.status });
    } else {
      self.postMessage({ type: 'error', text: '\n' + (e.message || String(e)) + '\n' });
      self.postMessage({ type: 'done', exitCode: 1 });
    }
  }
}

async function waitForProgramIdle(io, getLastActivity) {
  while (true) {
    if (io && io._inputResolve) {
      await sleep(50);
      continue;
    }
    if (Date.now() - getLastActivity() < 150) {
      await sleep(50);
      continue;
    }
    return;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

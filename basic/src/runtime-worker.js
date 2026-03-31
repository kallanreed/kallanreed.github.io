import { executeSource } from './kar-basic/runtime.mjs';

class InputQueue {
  constructor() {
    this.pending = [];
    this.waiting = null;
  }

  push(value) {
    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = null;
      resolve(value);
      return;
    }
    this.pending.push(value);
  }

  next() {
    if (this.pending.length > 0) {
      return Promise.resolve(this.pending.shift());
    }
    return new Promise(resolve => {
      this.waiting = resolve;
    });
  }
}

const inputQueue = new InputQueue();

self.onmessage = async event => {
  if (event.data?.type === 'input') {
    inputQueue.push(event.data.line ?? '');
    return;
  }
  if (event.data?.type !== 'run') {
    return;
  }

  try {
    await executeSource(event.data.source ?? '', {
      print(value) {
        self.postMessage({ type: 'output', text: `${value}\n` });
      },
      async input(prompt) {
        self.postMessage({ type: 'input-needed', prompt });
        return inputQueue.next();
      },
    });
    self.postMessage({ type: 'done', exitCode: 0 });
  } catch (error) {
    self.postMessage({
      type: 'error',
      text: `${error.message || String(error)}\n`,
    });
    self.postMessage({ type: 'done', exitCode: 1 });
  }
};

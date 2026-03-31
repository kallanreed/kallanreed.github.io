import test from 'node:test';
import assert from 'node:assert/strict';

import { executeSource } from '../src/kar-basic/runtime.mjs';
import { KAR_BASIC_SAMPLES } from '../src/kar-basic/samples.mjs';

function sampleByName(name) {
  const sample = KAR_BASIC_SAMPLES.find(entry => entry.name === name);
  assert.ok(sample, `missing sample ${name}`);
  return sample.source;
}

test('sample catalog exposes the expected starter files', () => {
  assert.deepEqual(
    KAR_BASIC_SAMPLES.map(sample => sample.name),
    ['HELLO', 'FIBB', 'GUESS'],
  );
});

test('HELLO sample executes end-to-end', async () => {
  const output = [];

  await executeSource(sampleByName('HELLO'), {
    async input() {
      return 'KYLE';
    },
    now() {
      return 1000;
    },
    print(value) {
      output.push(String(value));
    },
  });

  assert.equal(output[0], 'HELLO, WORLD!');
  assert.ok(output.includes("LET'S COUNT TO 3"));
  assert.ok(output.includes('HELLO, KYLE'));
  assert.ok(output.some(line => line.startsWith('SEEDED RND: ')));
});

test('FIBB sample executes and prints the expected opening sequence', async () => {
  const output = [];

  await executeSource(sampleByName('FIBB'), {
    print(value) {
      output.push(String(value));
    },
  });

  assert.deepEqual(output.slice(0, 6), ['FIBB:', '0', '1', '1', '2', '3']);
});

test('GUESS sample executes deterministically with injected clock/input', async () => {
  const output = [];
  const inputs = ['50', '25', '20', '23'];

  await executeSource(sampleByName('GUESS'), {
    async input() {
      return inputs.shift() ?? '1';
    },
    now() {
      return 100;
    },
    print(value) {
      output.push(String(value));
    },
  });

  assert.equal(output[0], "I'M THINKING OF A NUMBER FROM 1 TO 100.");
  assert.ok(output.includes('YOU GOT IT!'));
});

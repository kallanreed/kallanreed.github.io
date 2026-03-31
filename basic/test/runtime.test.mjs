import test from 'node:test';
import assert from 'node:assert/strict';

import { executeSource } from '../src/kar-basic/runtime.mjs';

async function runProgram(source) {
  const messages = [];

  try {
    await executeSource(source, {
      async input(prompt) {
        messages.push({ type: 'input-needed', prompt });
        return '42';
      },
      print(value) {
        messages.push({ type: 'output', text: `${value}\n` });
      },
    });
    messages.push({ type: 'done', exitCode: 0 });
  } catch (error) {
    messages.push({ type: 'error', text: `${error.message}\n` });
    messages.push({ type: 'done', exitCode: 1 });
  }

  return messages;
}

test('full pipeline runs PRINT 42 from source to output message', async () => {
  assert.deepEqual(await runProgram('PRINT 42\n'), [
    { type: 'output', text: '42\n' },
    { type: 'done', exitCode: 0 },
  ]);
});

test('full pipeline preserves decimal output formatting', async () => {
  assert.deepEqual(await runProgram('PRINT 3.14\n'), [
    { type: 'output', text: '3.14\n' },
    { type: 'done', exitCode: 0 },
  ]);
});

test('full pipeline supports INPUT and follow-up PRINT', async () => {
  assert.deepEqual(
    await runProgram('PRINT "HELLO!"\nINPUT "WHAT\'S YOUR FAVORITE NUMBER?" N\nPRINT "YOUR FAVORITE NUMBER IS ", N\n'),
    [
      { type: 'output', text: 'HELLO!\n' },
      { type: 'input-needed', prompt: "WHAT'S YOUR FAVORITE NUMBER?" },
      { type: 'output', text: 'YOUR FAVORITE NUMBER IS 42\n' },
      { type: 'done', exitCode: 0 },
    ],
  );
});

test('full pipeline surfaces parser errors as error messages', async () => {
  assert.deepEqual(await runProgram('PRINT =\n'), [
    { type: 'error', text: 'Expected an expression after PRINT at 1:7\n' },
    { type: 'done', exitCode: 1 },
  ]);
});

test('full pipeline rejects malformed INPUT cleanly', async () => {
  assert.deepEqual(await runProgram('INPUT 10\n'), [
    { type: 'error', text: 'Expected a variable name after INPUT at 1:7\n' },
    { type: 'done', exitCode: 1 },
  ]);
});

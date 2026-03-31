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

test('full pipeline evaluates arithmetic expressions with precedence', async () => {
  assert.deepEqual(await runProgram('PRINT 1+2*3, (8-2)/3\n'), [
    { type: 'output', text: '72\n' },
    { type: 'done', exitCode: 0 },
  ]);
});

test('full pipeline evaluates comparison expressions', async () => {
  assert.deepEqual(await runProgram('PRINT 1 < 2, 2 = 2, 3 <> 3\n'), [
    { type: 'output', text: 'truetruefalse\n' },
    { type: 'done', exitCode: 0 },
  ]);
});

test('full pipeline supports TRUE and FALSE literals', async () => {
  assert.deepEqual(await runProgram('PRINT TRUE, FALSE\nIF TRUE THEN PRINT 42\n'), [
    { type: 'output', text: 'truefalse\n' },
    { type: 'output', text: '42\n' },
    { type: 'done', exitCode: 0 },
  ]);
});

test('full pipeline evaluates logical expressions', async () => {
  assert.deepEqual(await runProgram('PRINT NOT (1 = 2) AND 2 < 3 OR 3 < 2\n'), [
    { type: 'output', text: 'true\n' },
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

test('full pipeline runs FOR/END FOR loops', async () => {
  assert.deepEqual(await runProgram('FOR I=1 TO 5 STEP 2\nPRINT I*10\nEND FOR\n'), [
    { type: 'output', text: '10\n' },
    { type: 'output', text: '30\n' },
    { type: 'output', text: '50\n' },
    { type: 'done', exitCode: 0 },
  ]);
});

test('full pipeline surfaces expression parser errors as error messages', async () => {
  assert.deepEqual(await runProgram('PRINT (1+2\n'), [
    { type: 'error', text: 'Expected ) to close expression at 1:11\n' },
    { type: 'done', exitCode: 1 },
  ]);
});

test('full pipeline surfaces numeric runtime errors in expressions', async () => {
  assert.deepEqual(await runProgram('PRINT "HELLO"+1\n'), [
    { type: 'error', text: 'Operator + requires numeric operands at 1:7\n' },
    { type: 'done', exitCode: 1 },
  ]);
});

test('full pipeline still supports the simplest FOR/END FOR loop', async () => {
  assert.deepEqual(await runProgram('FOR I=1 TO 3\nPRINT I\nEND FOR\n'), [
    { type: 'output', text: '1\n' },
    { type: 'output', text: '2\n' },
    { type: 'output', text: '3\n' },
    { type: 'done', exitCode: 0 },
  ]);
});

test('full pipeline runs label and GOTO control flow', async () => {
  assert.deepEqual(await runProgram('GOTO START\nPRINT 1\nSTART: PRINT 2\n'), [
    { type: 'output', text: '2\n' },
    { type: 'done', exitCode: 0 },
  ]);
});

test('full pipeline surfaces unknown labels as runtime errors', async () => {
  assert.deepEqual(await runProgram('GOTO MISSING\n'), [
    { type: 'error', text: 'Unknown label: MISSING at 1:1\n' },
    { type: 'done', exitCode: 1 },
  ]);
});

test('full pipeline supports single-line IF', async () => {
  assert.deepEqual(await runProgram('IF 1 < 2 AND NOT (1 = 2) THEN PRINT 42\nIF 1 = 2 OR 2 = 3 THEN PRINT 99\n'), [
    { type: 'output', text: '42\n' },
    { type: 'done', exitCode: 0 },
  ]);
});

test('full pipeline supports block IF with ELSE IF and ELSE', async () => {
  assert.deepEqual(await runProgram('VAR X = 5\nIF X < 0 THEN\nPRINT "NEG"\nELSE IF X = 0 THEN\nPRINT "ZERO"\nELSE\nPRINT "POS"\nEND IF\n'), [
    { type: 'output', text: 'POS\n' },
    { type: 'done', exitCode: 0 },
  ]);
});

test('full pipeline supports WHILE blocks', async () => {
  assert.deepEqual(await runProgram('VAR X = 1\nWHILE X <= 3\nPRINT X\nX = X + 1\nEND WHILE\n'), [
    { type: 'output', text: '1\n' },
    { type: 'output', text: '2\n' },
    { type: 'output', text: '3\n' },
    { type: 'done', exitCode: 0 },
  ]);
});

test('full pipeline supports builtin expressions and SEED', async () => {
  const messages = await runProgram('SEED 5\nPRINT INT 3.9, ABS -2, SIGN -5, CHR 65\nPRINT RND\nSEED 5\nPRINT RND\n');

  assert.deepEqual(messages[0], { type: 'output', text: '32-1A\n' });
  assert.equal(messages[1].type, 'output');
  assert.equal(messages[2].type, 'output');
  assert.equal(messages[1].text, messages[2].text);
  assert.deepEqual(messages[3], { type: 'done', exitCode: 0 });
});

test('full pipeline supports RND max and min/max forms', async () => {
  const messages = await runProgram('SEED 7\nPRINT RND 5\nPRINT RND 2, 4\nSEED 7\nPRINT RND 5\nPRINT RND 2, 4\n');

  assert.equal(messages[0].type, 'output');
  assert.equal(messages[1].type, 'output');
  assert.equal(messages[0].text, messages[2].text);
  assert.equal(messages[1].text, messages[3].text);
  assert.deepEqual(messages[4], { type: 'done', exitCode: 0 });
});

test('full pipeline surfaces invalid RND ranges', async () => {
  assert.deepEqual(await runProgram('PRINT RND 5, 2\n'), [
    { type: 'error', text: 'RND range max must be greater than or equal to min at 1:7\n' },
    { type: 'done', exitCode: 1 },
  ]);
});

test('full pipeline surfaces missing END WHILE parser errors', async () => {
  assert.deepEqual(await runProgram('WHILE 1\nPRINT 1\n'), [
    { type: 'error', text: 'Expected END WHILE to close WHILE block at 3:1\n' },
    { type: 'done', exitCode: 1 },
  ]);
});

test('full pipeline surfaces comparison runtime errors', async () => {
  assert.deepEqual(await runProgram('PRINT "2" < 10\n'), [
    { type: 'error', text: 'Operator < requires comparable operands at 1:11\n' },
    { type: 'done', exitCode: 1 },
  ]);
});

test('full pipeline surfaces non-boolean IF condition errors', async () => {
  assert.deepEqual(await runProgram('IF 1 THEN PRINT 42\n'), [
    { type: 'error', text: 'IF condition must be boolean at 1:4\n' },
    { type: 'done', exitCode: 1 },
  ]);
});

test('full pipeline surfaces non-boolean WHILE condition errors', async () => {
  assert.deepEqual(await runProgram('WHILE 1\nPRINT 1\nEND WHILE\n'), [
    { type: 'error', text: 'WHILE condition must be boolean at 1:7\n' },
    { type: 'done', exitCode: 1 },
  ]);
});

test('full pipeline supports VAR declaration and reassignment', async () => {
  assert.deepEqual(await runProgram('VAR X = 10\nX = X + 1\nPRINT X\n'), [
    { type: 'output', text: '11\n' },
    { type: 'done', exitCode: 0 },
  ]);
});

test('full pipeline surfaces duplicate VAR declarations as runtime errors', async () => {
  assert.deepEqual(await runProgram('VAR X = 1\nVAR X = 2\n'), [
    { type: 'error', text: 'Variable already declared: X at 2:5\n' },
    { type: 'done', exitCode: 1 },
  ]);
});

test('full pipeline surfaces assignment to undeclared variables as runtime errors', async () => {
  assert.deepEqual(await runProgram('X = 1\n'), [
    { type: 'error', text: 'Unknown variable: X at 1:1\n' },
    { type: 'done', exitCode: 1 },
  ]);
});

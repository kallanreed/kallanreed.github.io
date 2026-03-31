import test from 'node:test';
import assert from 'node:assert/strict';

import { interpret } from '../src/kar-basic/interpreter.mjs';
import { parse } from '../src/kar-basic/parser.mjs';

test('interprets PRINT number literal and sends it to host output', async () => {
  const ast = parse('PRINT 42\n');
  const output = [];

  await interpret(ast, {
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output, ['42']);
});

test('interprets INPUT followed by PRINT using the assigned variable', async () => {
  const ast = parse('INPUT "WHAT?" N\nPRINT "N=", N\n');
  const output = [];
  const prompts = [];

  await interpret(ast, {
    async input(prompt) {
      prompts.push(prompt);
      return '42';
    },
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(prompts, ['WHAT?']);
  assert.deepEqual(output, ['N=42']);
});

test('throws for unsupported AST statement nodes', async () => {
  await assert.rejects(
    () => interpret({
      type: 'Program',
      body: [{ type: 'GotoStatement', location: { line: 1, column: 1 } }],
    }),
    error => {
      assert.equal(error.name, 'RuntimeError');
      assert.match(error.message, /Unsupported statement node: GotoStatement at 1:1/);
      return true;
    },
  );
});

test('throws for unsupported expression nodes', async () => {
  await assert.rejects(
    () => interpret({
      type: 'Program',
      body: [
        {
          type: 'PrintStatement',
          arguments: [{ type: 'Identifier', location: { line: 1, column: 7 } }],
          location: { line: 1, column: 1 },
        },
      ],
    }),
    error => {
      assert.equal(error.name, 'RuntimeError');
      assert.match(error.message, /Unsupported expression node: Identifier at 1:7/);
      return true;
    },
  );
});

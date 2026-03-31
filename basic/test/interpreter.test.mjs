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

test('interprets arithmetic expressions with precedence and grouping', async () => {
  const ast = parse('PRINT 1+2*3, (8-2)/3\n');
  const output = [];

  await interpret(ast, {
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output, ['72']);
});

test('interprets unary minus on literals and variables', async () => {
  const ast = parse('INPUT N\nPRINT -N, -(-2)\n');
  const output = [];

  await interpret(ast, {
    async input() {
      return '5';
    },
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output, ['-52']);
});

test('interprets FOR/END FOR with the default step', async () => {
  const ast = parse('FOR I=1 TO 1+2\nPRINT I\nEND FOR\n');
  const output = [];

  await interpret(ast, {
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output, ['1', '2', '3']);
});

test('interprets FOR/END FOR with a negative step', async () => {
  const ast = parse('INPUT START\nINPUT STEP_SIZE\nFOR I=START TO 1 STEP (STEP_SIZE)\nPRINT I\nEND FOR\n');
  const output = [];
  const inputs = ['3', '-1'];

  await interpret(ast, {
    async input() {
      return inputs.shift();
    },
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output, ['3', '2', '1']);
});

test('rejects FOR/END FOR with a zero step at runtime', async () => {
  const ast = parse('INPUT STEP_SIZE\nFOR I=1 TO 3 STEP STEP_SIZE\nPRINT I\nEND FOR\n');

  await assert.rejects(
    () => interpret(ast, {
      async input() {
        return '0';
      },
    }),
    error => {
      assert.equal(error.name, 'RuntimeError');
      assert.match(error.message, /FOR step cannot be zero at 2:19/);
      return true;
    },
  );
});

test('rejects numeric operators with string operands at runtime', async () => {
  const ast = parse('PRINT "HELLO"+1\n');

  await assert.rejects(
    () => interpret(ast),
    error => {
      assert.equal(error.name, 'RuntimeError');
      assert.match(error.message, /Operator \+ requires numeric operands at 1:7/);
      return true;
    },
  );
});

test('interprets comparison expressions as numeric truth values', async () => {
  const ast = parse('PRINT 1 < 2, 2 = 2, 3 <> 3\n');
  const output = [];

  await interpret(ast, {
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output, ['truetruefalse']);
});

test('interprets NOT, AND, and OR with expected precedence', async () => {
  const ast = parse('PRINT NOT (1 = 2) AND 2 < 3 OR 3 < 2\n');
  const output = [];

  await interpret(ast, {
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output, ['true']);
});

test('short-circuits AND and OR', async () => {
  const ast = parse('PRINT 1 = 2 AND ("NO" < 1), 1 = 1 OR ("NO" < 1)\n');
  const output = [];

  await interpret(ast, {
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output, ['falsetrue']);
});

test('interprets single-line IF with exactly one statement body', async () => {
  const ast = parse('IF 1 < 2 AND NOT (1 = 2) THEN PRINT 42\nIF 1 = 2 OR 2 = 3 THEN PRINT 99\n');
  const output = [];

  await interpret(ast, {
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output, ['42']);
});

test('interprets block IF with ELSE IF and ELSE', async () => {
  const ast = parse('VAR X = 0\nIF X < 0 THEN\nPRINT "NEG"\nELSE IF X = 0 THEN\nPRINT "ZERO"\nELSE\nPRINT "POS"\nEND IF\n');
  const output = [];

  await interpret(ast, {
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output, ['ZERO']);
});

test('rejects ordering comparisons on mixed operand types', async () => {
  const ast = parse('PRINT "2" < 10\n');

  await assert.rejects(
    () => interpret(ast),
    error => {
      assert.equal(error.name, 'RuntimeError');
      assert.match(error.message, /Operator < requires comparable operands at 1:11/);
      return true;
    },
  );
});

test('uses logical expressions in block IF branches', async () => {
  const ast = parse('VAR X = 1\nIF X = 1 AND NOT (X = 2) THEN\nPRINT "YES"\nELSE\nPRINT "NO"\nEND IF\n');
  const output = [];

  await interpret(ast, {
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output, ['YES']);
});

test('interprets builtin expressions and seeded random sequences', async () => {
  const ast = parse('SEED 123\nPRINT INT 3.9, ABS -2, SIGN -5, CHR 65\nPRINT RND, RND\nSEED 123\nPRINT RND, RND\n');
  const output = [];

  await interpret(ast, {
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output[0], '32-1A');
  assert.equal(output[1], output[2]);
});

test('interprets RND max and min/max forms as deterministic integer ranges', async () => {
  const ast = parse('SEED 7\nPRINT RND 5\nPRINT RND 2, 4\nSEED 7\nPRINT RND 5\nPRINT RND 2, 4\n');
  const output = [];

  await interpret(ast, {
    print(value) {
      output.push(value);
    },
  });

  assert.equal(output[0], output[2]);
  assert.equal(output[1], output[3]);
  const first = Number(output[0]);
  const second = Number(output[1]);
  assert.ok(first >= 0 && first <= 5);
  assert.ok(second >= 2 && second <= 4);
});

test('interprets TIMER through the injected clock source', async () => {
  const ast = parse('PRINT TIMER\nSEED TIMER\nPRINT RND\n');
  const output = [];

  await interpret(ast, {
    now() {
      return 123.456;
    },
    print(value) {
      output.push(value);
    },
  });

  assert.equal(output[0], '123.456');
  assert.match(output[1], /^0\./);
});

test('rejects invalid RND ranges at runtime', async () => {
  const ast = parse('PRINT RND 5, 2\n');

  await assert.rejects(
    () => interpret(ast),
    error => {
      assert.equal(error.name, 'RuntimeError');
      assert.match(error.message, /RND range max must be greater than or equal to min at 1:7/);
      return true;
    },
  );
});

test('rejects logical operators on non-boolean values', async () => {
  const ast = parse('PRINT 1 AND 2 < 3\n');

  await assert.rejects(
    () => interpret(ast),
    error => {
      assert.equal(error.name, 'RuntimeError');
      assert.match(error.message, /AND requires boolean operands at 1:7/);
      return true;
    },
  );
});

test('rejects IF conditions that are not boolean', async () => {
  const ast = parse('IF 1 THEN PRINT 42\n');

  await assert.rejects(
    () => interpret(ast),
    error => {
      assert.equal(error.name, 'RuntimeError');
      assert.match(error.message, /IF condition must be boolean at 1:4/);
      return true;
    },
  );
});

test('rejects WHILE conditions that are not boolean', async () => {
  const ast = parse('WHILE 1\nPRINT 1\nEND WHILE\n');

  await assert.rejects(
    () => interpret(ast),
    error => {
      assert.equal(error.name, 'RuntimeError');
      assert.match(error.message, /WHILE condition must be boolean at 1:7/);
      return true;
    },
  );
});

test('interprets WHILE blocks until the condition becomes false', async () => {
  const ast = parse('VAR X = 1\nWHILE X <= 3\nPRINT X\nX = X + 1\nEND WHILE\n');
  const output = [];

  await interpret(ast, {
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output, ['1', '2', '3']);
});

test('skips WHILE bodies when the condition starts false', async () => {
  const ast = parse('VAR X = 5\nWHILE X < 3\nPRINT X\nEND WHILE\nPRINT 99\n');
  const output = [];

  await interpret(ast, {
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output, ['99']);
});

test('interprets GOTO by jumping to a later label', async () => {
  const ast = parse('GOTO START\nPRINT 1\nSTART: PRINT 2\n');
  const output = [];

  await interpret(ast, {
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output, ['2']);
});

test('interprets GOTO to a label-only line', async () => {
  const ast = parse('GOTO START\nPRINT 1\nSTART:\nPRINT 2\n');
  const output = [];

  await interpret(ast, {
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output, ['2']);
});

test('rejects unknown labels at runtime', async () => {
  const ast = parse('GOTO MISSING\n');

  await assert.rejects(
    () => interpret(ast),
    error => {
      assert.equal(error.name, 'RuntimeError');
      assert.match(error.message, /Unknown label: MISSING at 1:1/);
      return true;
    },
  );
});

test('rejects duplicate labels at runtime', async () => {
  const ast = parse('START:\nPRINT 1\nSTART:\nPRINT 2\n');

  await assert.rejects(
    () => interpret(ast),
    error => {
      assert.equal(error.name, 'RuntimeError');
      assert.match(error.message, /Duplicate label: START at 3:1/);
      return true;
    },
  );
});

test('interprets VAR declaration and bare assignment', async () => {
  const ast = parse('VAR X = 10\nX = X + 5\nPRINT X\n');
  const output = [];

  await interpret(ast, {
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output, ['15']);
});

test('rejects duplicate VAR declarations in the current scope', async () => {
  const ast = parse('VAR X = 1\nVAR X = 2\n');

  await assert.rejects(
    () => interpret(ast),
    error => {
      assert.equal(error.name, 'RuntimeError');
      assert.match(error.message, /Variable already declared: X at 2:5/);
      return true;
    },
  );
});

test('rejects assignment to an undeclared variable', async () => {
  const ast = parse('X = 1\n');

  await assert.rejects(
    () => interpret(ast),
    error => {
      assert.equal(error.name, 'RuntimeError');
      assert.match(error.message, /Unknown variable: X at 1:1/);
      return true;
    },
  );
});

test('propagates GOTO out of a FOR body', async () => {
  const ast = parse('FOR I=1 TO 3\nGOTO DONE\nEND FOR\nDONE: PRINT 42\n');
  const output = [];

  await interpret(ast, {
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output, ['42']);
});

test('rejects non-numeric SEED values at parse time', () => {
  assert.throws(
    () => parse('SEED CHR 65\n'),
    error => {
      assert.equal(error.name, 'ParserError');
      assert.match(error.message, /Expected a numeric expression after SEED at 1:6/);
      return true;
    },
  );
});

test('propagates GOTO out of a block IF body', async () => {
  const ast = parse('IF 1 = 1 THEN\nGOTO DONE\nEND IF\nPRINT 1\nDONE: PRINT 42\n');
  const output = [];

  await interpret(ast, {
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output, ['42']);
});

test('propagates GOTO out of a WHILE body', async () => {
  const ast = parse('VAR X = 1\nWHILE X = 1\nGOTO DONE\nEND WHILE\nPRINT 1\nDONE: PRINT 42\n');
  const output = [];

  await interpret(ast, {
    print(value) {
      output.push(value);
    },
  });

  assert.deepEqual(output, ['42']);
});

test('throws for unsupported AST statement nodes', async () => {
  await assert.rejects(
    () => interpret({
      type: 'Program',
      body: [{ type: 'DoStatement', location: { line: 1, column: 1 } }],
    }),
    error => {
      assert.equal(error.name, 'RuntimeError');
      assert.match(error.message, /Unsupported statement node: DoStatement at 1:1/);
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

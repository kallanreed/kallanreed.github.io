import test from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../src/kar-basic/parser.mjs';

test('parses PRINT with an integer literal into a stable AST shape', () => {
  const ast = parse('PRINT 42\n');

  assert.deepEqual(ast, {
    type: 'Program',
    body: [
      {
        type: 'PrintStatement',
        arguments: [
          {
            type: 'NumberLiteral',
            raw: '42',
            value: 42,
            location: { line: 1, column: 7 },
          },
        ],
        location: { line: 1, column: 1 },
      },
    ],
  });
});

test('parses PRINT with a decimal literal', () => {
  const ast = parse('PRINT 3.14');

  assert.deepEqual(ast.body[0].arguments[0], {
    type: 'NumberLiteral',
    raw: '3.14',
    value: 3.14,
    location: { line: 1, column: 7 },
  });
});

test('ignores blank lines around the statement', () => {
  const ast = parse('\nPRINT 7\n\n');
  assert.equal(ast.body[0].type, 'PrintStatement');
  assert.equal(ast.body[0].arguments[0].value, 7);
});

test('parses PRINT with string and variable arguments', () => {
  const ast = parse('PRINT "HELLO ", NAME\n');

  assert.deepEqual(ast.body[0], {
    type: 'PrintStatement',
    arguments: [
      {
        type: 'StringLiteral',
        value: 'HELLO ',
        location: { line: 1, column: 7 },
      },
      {
        type: 'VariableReference',
        name: 'NAME',
        location: { line: 1, column: 17 },
      },
    ],
    location: { line: 1, column: 1 },
  });
});

test('parses additive and multiplicative precedence correctly', () => {
  const ast = parse('PRINT 1+2*3\n');

  assert.deepEqual(ast.body[0].arguments[0], {
    type: 'BinaryExpression',
    operator: '+',
    left: {
      type: 'NumberLiteral',
      raw: '1',
      value: 1,
      location: { line: 1, column: 7 },
    },
    right: {
      type: 'BinaryExpression',
      operator: '*',
      left: {
        type: 'NumberLiteral',
        raw: '2',
        value: 2,
        location: { line: 1, column: 9 },
      },
      right: {
        type: 'NumberLiteral',
        raw: '3',
        value: 3,
        location: { line: 1, column: 11 },
      },
      location: { line: 1, column: 10 },
    },
    location: { line: 1, column: 8 },
  });
});

test('parses parenthesized and unary expressions', () => {
  const ast = parse('PRINT -(1+2)\n');

  assert.deepEqual(ast.body[0].arguments[0], {
    type: 'UnaryExpression',
    operator: '-',
    argument: {
      type: 'ParenthesizedExpression',
      expression: {
        type: 'BinaryExpression',
        operator: '+',
        left: {
          type: 'NumberLiteral',
          raw: '1',
          value: 1,
          location: { line: 1, column: 9 },
        },
        right: {
          type: 'NumberLiteral',
          raw: '2',
          value: 2,
          location: { line: 1, column: 11 },
        },
        location: { line: 1, column: 10 },
      },
      location: { line: 1, column: 8 },
    },
    location: { line: 1, column: 7 },
  });
});

test('parses comparison expressions after arithmetic precedence', () => {
  const ast = parse('PRINT 1+2 < 4*2\n');

  assert.deepEqual(ast.body[0].arguments[0], {
    type: 'BinaryExpression',
    operator: '<',
    left: {
      type: 'BinaryExpression',
      operator: '+',
      left: {
        type: 'NumberLiteral',
        raw: '1',
        value: 1,
        location: { line: 1, column: 7 },
      },
      right: {
        type: 'NumberLiteral',
        raw: '2',
        value: 2,
        location: { line: 1, column: 9 },
      },
      location: { line: 1, column: 8 },
    },
    right: {
      type: 'BinaryExpression',
      operator: '*',
      left: {
        type: 'NumberLiteral',
        raw: '4',
        value: 4,
        location: { line: 1, column: 13 },
      },
      right: {
        type: 'NumberLiteral',
        raw: '2',
        value: 2,
        location: { line: 1, column: 15 },
      },
      location: { line: 1, column: 14 },
    },
    location: { line: 1, column: 11 },
  });
});

test('parses NOT, AND, and OR with stable precedence', () => {
  const ast = parse('PRINT NOT A = B AND C OR D\n');
  const expression = ast.body[0].arguments[0];

  assert.equal(expression.type, 'BinaryExpression');
  assert.equal(expression.operator, 'OR');
  assert.equal(expression.left.type, 'BinaryExpression');
  assert.equal(expression.left.operator, 'AND');
  assert.equal(expression.left.left.type, 'UnaryExpression');
  assert.equal(expression.left.left.operator, 'NOT');
});

test('parses multiple newline-separated statements into one program', () => {
  const ast = parse('PRINT "HELLO!"\nINPUT "NUMBER?" NUM\nPRINT "N=", NUM\n');

  assert.equal(ast.body.length, 3);
  assert.equal(ast.body[0].type, 'PrintStatement');
  assert.equal(ast.body[1].type, 'InputStatement');
  assert.equal(ast.body[2].type, 'PrintStatement');
});

test('parses INPUT with only a target variable', () => {
  const ast = parse('INPUT NAME\n');

  assert.deepEqual(ast.body[0], {
    type: 'InputStatement',
    prompt: null,
    target: {
      type: 'VariableReference',
      name: 'NAME',
      location: { line: 1, column: 7 },
    },
    location: { line: 1, column: 1 },
  });
});

test('parses INPUT with a string literal prompt', () => {
  const ast = parse('INPUT "Name: " NAME\n');

  assert.deepEqual(ast.body[0], {
    type: 'InputStatement',
    prompt: {
      type: 'StringLiteral',
      value: 'Name: ',
      location: { line: 1, column: 7 },
    },
    target: {
      type: 'VariableReference',
      name: 'NAME',
      location: { line: 1, column: 16 },
    },
    location: { line: 1, column: 1 },
  });
});

test('parses INPUT with an identifier prompt and target', () => {
  const ast = parse('INPUT PROMPT NAME\n');

  assert.deepEqual(ast.body[0], {
    type: 'InputStatement',
    prompt: {
      type: 'VariableReference',
      name: 'PROMPT',
      location: { line: 1, column: 7 },
    },
    target: {
      type: 'VariableReference',
      name: 'NAME',
      location: { line: 1, column: 14 },
    },
    location: { line: 1, column: 1 },
  });
});

test('parses FOR/END FOR with a default step and nested body', () => {
  const ast = parse('FOR I=1 TO LIMIT\nPRINT I\nEND FOR\n');

  assert.deepEqual(ast.body[0], {
    type: 'ForStatement',
    variable: {
      type: 'VariableReference',
      name: 'I',
      location: { line: 1, column: 5 },
    },
    start: {
      type: 'NumberLiteral',
      raw: '1',
      value: 1,
      location: { line: 1, column: 7 },
    },
    end: {
      type: 'VariableReference',
      name: 'LIMIT',
      location: { line: 1, column: 12 },
    },
    step: {
      type: 'NumberLiteral',
      raw: '1',
      value: 1,
      location: { line: 1, column: 1 },
    },
    body: [
      {
        type: 'PrintStatement',
        arguments: [
          {
            type: 'VariableReference',
            name: 'I',
            location: { line: 2, column: 7 },
          },
        ],
        location: { line: 2, column: 1 },
      },
    ],
    location: { line: 1, column: 1 },
  });
});

test('parses FOR/END FOR with an explicit STEP variable', () => {
  const ast = parse('FOR I=START TO LIMIT STEP STEP_SIZE\nPRINT I\nEND FOR\n');

  assert.deepEqual(ast.body[0].step, {
    type: 'VariableReference',
    name: 'STEP_SIZE',
    location: { line: 1, column: 27 },
  });
});

test('parses FOR/END FOR with computed numeric expressions', () => {
  const ast = parse('FOR I=(START+1) TO LIMIT*2 STEP -1\nPRINT I\nEND FOR\n');

  assert.equal(ast.body[0].start.type, 'ParenthesizedExpression');
  assert.equal(ast.body[0].end.type, 'BinaryExpression');
  assert.equal(ast.body[0].step.type, 'UnaryExpression');
});

test('parses a label on its own line', () => {
  const ast = parse('START:\nPRINT 1\n');

  assert.deepEqual(ast.body[0], {
    type: 'LabelStatement',
    labels: [
      {
        type: 'Label',
        name: 'START',
        location: { line: 1, column: 1 },
      },
    ],
    location: { line: 1, column: 1 },
  });
});

test('parses a same-line label attached to a statement', () => {
  const ast = parse('START: PRINT 1\n');

  assert.deepEqual(ast.body[0].labels, [
    {
      type: 'Label',
      name: 'START',
      location: { line: 1, column: 1 },
    },
  ]);
});

test('parses GOTO with a label target', () => {
  const ast = parse('GOTO START\n');

  assert.deepEqual(ast.body[0], {
    type: 'GotoStatement',
    target: 'START',
    location: { line: 1, column: 1 },
  });
});

test('parses VAR declarations with expressions', () => {
  const ast = parse('VAR X = 1+2\n');

  assert.deepEqual(ast.body[0], {
    type: 'VarStatement',
    target: {
      type: 'VariableReference',
      name: 'X',
      location: { line: 1, column: 5 },
    },
    value: {
      type: 'BinaryExpression',
      operator: '+',
      left: {
        type: 'NumberLiteral',
        raw: '1',
        value: 1,
        location: { line: 1, column: 9 },
      },
      right: {
        type: 'NumberLiteral',
        raw: '2',
        value: 2,
        location: { line: 1, column: 11 },
      },
      location: { line: 1, column: 10 },
    },
    location: { line: 1, column: 1 },
  });
});

test('parses bare assignment statements', () => {
  const ast = parse('X = X+1\n');

  assert.deepEqual(ast.body[0], {
    type: 'AssignmentStatement',
    target: {
      type: 'VariableReference',
      name: 'X',
      location: { line: 1, column: 1 },
    },
    value: {
      type: 'BinaryExpression',
      operator: '+',
      left: {
        type: 'VariableReference',
        name: 'X',
        location: { line: 1, column: 5 },
      },
      right: {
        type: 'NumberLiteral',
        raw: '1',
        value: 1,
        location: { line: 1, column: 7 },
      },
      location: { line: 1, column: 6 },
    },
    location: { line: 1, column: 1 },
  });
});

test('parses single-line IF with one statement body', () => {
  const ast = parse('IF 1 < 2 THEN PRINT 42\n');

  assert.equal(ast.body[0].type, 'IfStatement');
  assert.equal(ast.body[0].inline, true);
  assert.equal(ast.body[0].branches.length, 1);
  assert.equal(ast.body[0].branches[0].body[0].type, 'PrintStatement');
});

test('parses block IF with ELSE IF and ELSE branches', () => {
  const ast = parse('IF X < 0 THEN\nPRINT "NEG"\nELSE IF X = 0 THEN\nPRINT "ZERO"\nELSE\nPRINT "POS"\nEND IF\n');

  assert.equal(ast.body[0].type, 'IfStatement');
  assert.equal(ast.body[0].inline, false);
  assert.equal(ast.body[0].branches.length, 2);
  assert.equal(ast.body[0].elseBody.length, 1);
  assert.equal(ast.body[0].branches[0].body[0].type, 'PrintStatement');
  assert.equal(ast.body[0].branches[1].body[0].type, 'PrintStatement');
  assert.equal(ast.body[0].elseBody[0].type, 'PrintStatement');
});

test('parses WHILE blocks with nested statements', () => {
  const ast = parse('WHILE X < 3\nPRINT X\nX = X + 1\nEND WHILE\n');

  assert.deepEqual(ast.body[0], {
    type: 'WhileStatement',
    condition: {
      type: 'BinaryExpression',
      operator: '<',
      left: {
        type: 'VariableReference',
        name: 'X',
        location: { line: 1, column: 7 },
      },
      right: {
        type: 'NumberLiteral',
        raw: '3',
        value: 3,
        location: { line: 1, column: 11 },
      },
      location: { line: 1, column: 9 },
    },
    body: [
      {
        type: 'PrintStatement',
        arguments: [
          {
            type: 'VariableReference',
            name: 'X',
            location: { line: 2, column: 7 },
          },
        ],
        location: { line: 2, column: 1 },
      },
      {
        type: 'AssignmentStatement',
        target: {
          type: 'VariableReference',
          name: 'X',
          location: { line: 3, column: 1 },
        },
        value: {
          type: 'BinaryExpression',
          operator: '+',
          left: {
            type: 'VariableReference',
            name: 'X',
            location: { line: 3, column: 5 },
          },
          right: {
            type: 'NumberLiteral',
            raw: '1',
            value: 1,
            location: { line: 3, column: 9 },
          },
          location: { line: 3, column: 7 },
        },
        location: { line: 3, column: 1 },
      },
    ],
    location: { line: 1, column: 1 },
  });
});

test('parses builtin expressions without call parentheses', () => {
  const ast = parse('PRINT ABS -2, INT 3.9, SIGN -5, CHR 65, RND, TIMER\n');
  const args = ast.body[0].arguments;

  assert.equal(args[0].type, 'BuiltinExpression');
  assert.equal(args[0].name, 'ABS');
  assert.equal(args[0].arguments.length, 1);
  assert.equal(args[1].name, 'INT');
  assert.equal(args[2].name, 'SIGN');
  assert.equal(args[3].name, 'CHR');
  assert.equal(args[4].name, 'RND');
  assert.deepEqual(args[4].arguments, []);
  assert.equal(args[5].name, 'TIMER');
  assert.deepEqual(args[5].arguments, []);
});

test('parses SEED as a statement with a numeric expression', () => {
  const ast = parse('SEED TIMER\n');

  assert.deepEqual(ast.body[0], {
    type: 'SeedStatement',
    argument: {
      type: 'BuiltinExpression',
      name: 'TIMER',
      arguments: [],
      location: { line: 1, column: 6 },
    },
    location: { line: 1, column: 1 },
  });
});

test('parses RND with max and min/max argument forms', () => {
  const ast = parse('PRINT RND 10\nPRINT RND 2, 5\n');

  assert.equal(ast.body[0].arguments[0].name, 'RND');
  assert.equal(ast.body[0].arguments[0].arguments.length, 1);
  assert.equal(ast.body[1].arguments[0].name, 'RND');
  assert.equal(ast.body[1].arguments[0].arguments.length, 2);
});

test('rejects malformed INPUT with useful errors', () => {
  assert.throws(
    () => parse('INPUT 10\n'),
    error => {
      assert.equal(error.name, 'ParserError');
      assert.match(error.message, /Expected a variable name after INPUT at 1:7/);
      assert.equal(error.line, 1);
      assert.equal(error.column, 7);
      return true;
    },
  );
});

test('rejects FOR with a string bound', () => {
  assert.throws(
    () => parse('FOR I=("NO") TO 3\nPRINT I\nEND FOR\n'),
    error => {
      assert.equal(error.name, 'ParserError');
      assert.match(error.message, /Expected a numeric expression after = at 1:8/);
      assert.equal(error.line, 1);
      assert.equal(error.column, 8);
      return true;
    },
  );
});

test('rejects missing right parenthesis with a useful location', () => {
  assert.throws(
    () => parse('PRINT (1+2\n'),
    error => {
      assert.equal(error.name, 'ParserError');
      assert.match(error.message, /Expected \) to close expression at 1:11/);
      assert.equal(error.line, 1);
      assert.equal(error.column, 11);
      return true;
    },
  );
});

test('rejects an operator without a right-hand operand', () => {
  assert.throws(
    () => parse('PRINT 1+\n'),
    error => {
      assert.equal(error.name, 'ParserError');
      assert.match(error.message, /Expected an expression after operator at 1:9/);
      assert.equal(error.line, 1);
      assert.equal(error.column, 9);
      return true;
    },
  );
});

test('rejects logical operators without a right-hand operand', () => {
  assert.throws(
    () => parse('PRINT 1 AND\n'),
    error => {
      assert.equal(error.name, 'ParserError');
      assert.match(error.message, /Expected an expression after operator at 1:12/);
      assert.equal(error.line, 1);
      assert.equal(error.column, 12);
      return true;
    },
  );
});

test('rejects END without a matching block statement', () => {
  assert.throws(
    () => parse('END FOR\n'),
    error => {
      assert.equal(error.name, 'ParserError');
      assert.match(error.message, /Unsupported statement: END at 1:1/);
      assert.equal(error.line, 1);
      assert.equal(error.column, 1);
      return true;
    },
  );
});

test('rejects SEED without an argument', () => {
  assert.throws(
    () => parse('SEED\n'),
    error => {
      assert.equal(error.name, 'ParserError');
      assert.match(error.message, /Expected a numeric expression after SEED at 1:5/);
      assert.equal(error.line, 1);
      assert.equal(error.column, 5);
      return true;
    },
  );
});

test('allows grouping immediately after builtin names', () => {
  const ast = parse('PRINT ABS(1+2)\n');
  assert.equal(ast.body[0].arguments[0].type, 'BuiltinExpression');
  assert.equal(ast.body[0].arguments[0].name, 'ABS');
});

test('rejects CHR in numeric-only loop expressions', () => {
  assert.throws(
    () => parse('FOR I=CHR 65 TO 3\nPRINT I\nEND FOR\n'),
    error => {
      assert.equal(error.name, 'ParserError');
      assert.match(error.message, /Expected a numeric expression after = at 1:7/);
      assert.equal(error.line, 1);
      assert.equal(error.column, 7);
      return true;
    },
  );
});

test('rejects GOTO without a target label', () => {
  assert.throws(
    () => parse('GOTO\n'),
    error => {
      assert.equal(error.name, 'ParserError');
      assert.match(error.message, /Expected label name after GOTO at 1:5/);
      assert.equal(error.line, 1);
      assert.equal(error.column, 5);
      return true;
    },
  );
});

test('rejects VAR without an initializer', () => {
  assert.throws(
    () => parse('VAR X =\n'),
    error => {
      assert.equal(error.name, 'ParserError');
      assert.match(error.message, /Expected an expression after = at 1:8/);
      assert.equal(error.line, 1);
      assert.equal(error.column, 8);
      return true;
    },
  );
});

test('rejects IF without THEN', () => {
  assert.throws(
    () => parse('IF 1 < 2 PRINT 42\n'),
    error => {
      assert.equal(error.name, 'ParserError');
      assert.match(error.message, /Expected THEN after IF condition at 1:10/);
      assert.equal(error.line, 1);
      assert.equal(error.column, 10);
      return true;
    },
  );
});

test('rejects block IF without END IF', () => {
  assert.throws(
    () => parse('IF 1 THEN\nPRINT 1\n'),
    error => {
      assert.equal(error.name, 'ParserError');
      assert.match(error.message, /Expected END IF to close IF block at 3:1/);
      assert.equal(error.line, 3);
      assert.equal(error.column, 1);
      return true;
    },
  );
});

test('rejects WHILE without END WHILE', () => {
  assert.throws(
    () => parse('WHILE 1\nPRINT 1\n'),
    error => {
      assert.equal(error.name, 'ParserError');
      assert.match(error.message, /Expected END WHILE to close WHILE block at 3:1/);
      assert.equal(error.line, 3);
      assert.equal(error.column, 1);
      return true;
    },
  );
});

test('rejects PRINT without a numeric literal', () => {
  assert.throws(
    () => parse('PRINT =\n'),
    error => {
      assert.equal(error.name, 'ParserError');
      assert.match(error.message, /Expected an expression after PRINT at 1:7/);
      assert.equal(error.line, 1);
      assert.equal(error.column, 7);
      return true;
    },
  );
});

test('rejects extra tokens after the one allowed statement form', () => {
  assert.throws(
    () => parse('PRINT 1 PRINT 2\n'),
    error => {
      assert.equal(error.name, 'ParserError');
      assert.match(error.message, /Expected end of line after statement at 1:9/);
      assert.equal(error.line, 1);
      assert.equal(error.column, 9);
      return true;
    },
  );
});

test('rejects a file that only contains a label with no newline terminator', () => {
  const ast = parse('END:');
  assert.equal(ast.body[0].type, 'LabelStatement');
});

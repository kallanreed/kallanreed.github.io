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

test('rejects labels for now instead of silently accepting them', () => {
  assert.throws(
    () => parse('START: PRINT 1\n'),
    error => {
      assert.equal(error.name, 'ParserError');
      assert.match(error.message, /Unsupported statement: START at 1:1/);
      assert.equal(error.line, 1);
      assert.equal(error.column, 1);
      return true;
    },
  );
});

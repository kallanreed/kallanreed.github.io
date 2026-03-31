import test from 'node:test';
import assert from 'node:assert/strict';

import { createLexer, lex } from '../src/kar-basic/lexer.mjs';

function compact(tokens) {
  return tokens
    .filter(token => token.type !== 'WHITESPACE')
    .map(({ type, kind, value, line, column }) => ({ type, kind, value, line, column }));
}

test('lexes labels, keywords, identifiers, and punctuation without line numbers', () => {
  const tokens = compact(lex('START: PRINT NAME\nEND_LABEL: GOTO START\n'));

  assert.deepEqual(tokens, [
    { type: 'LABEL', kind: 'START', value: 'START', line: 1, column: 1 },
    { type: 'KEYWORD', kind: 'PRINT', value: 'PRINT', line: 1, column: 8 },
    { type: 'IDENTIFIER', kind: 'NAME', value: 'NAME', line: 1, column: 14 },
    { type: 'NEWLINE', kind: 'NEWLINE', value: '\n', line: 1, column: 18 },
    { type: 'LABEL', kind: 'END_LABEL', value: 'END_LABEL', line: 2, column: 1 },
    { type: 'KEYWORD', kind: 'GOTO', value: 'GOTO', line: 2, column: 12 },
    { type: 'IDENTIFIER', kind: 'START', value: 'START', line: 2, column: 17 },
    { type: 'NEWLINE', kind: 'NEWLINE', value: '\n', line: 2, column: 22 },
    { type: 'EOF', kind: 'EOF', value: '', line: 3, column: 1 },
  ]);
});

test('lexes strings with doubled quotes and leaves trailing punctuation intact', () => {
  const tokens = compact(lex('PRINT "HI ""KYLE""", X\n'));

  assert.deepEqual(tokens, [
    { type: 'KEYWORD', kind: 'PRINT', value: 'PRINT', line: 1, column: 1 },
    { type: 'STRING', kind: 'STRING', value: 'HI "KYLE"', line: 1, column: 7 },
    { type: 'PUNCTUATION', kind: 'COMMA', value: ',', line: 1, column: 20 },
    { type: 'IDENTIFIER', kind: 'X', value: 'X', line: 1, column: 22 },
    { type: 'NEWLINE', kind: 'NEWLINE', value: '\n', line: 1, column: 23 },
    { type: 'EOF', kind: 'EOF', value: '', line: 2, column: 1 },
  ]);
});

test('rejects legacy BASIC string sigils in identifiers', () => {
  assert.throws(
    () => lex('PRINT NAME$\n'),
    error => {
      assert.equal(error.name, 'LexerError');
      assert.match(error.message, /Unexpected character: \$ at 1:11/);
      return true;
    },
  );
});

test('treats apostrophe and REM as comments', () => {
  const tokens = compact(lex("PRINT 1 ' note\nREM full line comment\n"));

  assert.deepEqual(tokens, [
    { type: 'KEYWORD', kind: 'PRINT', value: 'PRINT', line: 1, column: 1 },
    { type: 'NUMBER', kind: 'NUMBER', value: '1', line: 1, column: 7 },
    { type: 'COMMENT', kind: 'COMMENT', value: "' note", line: 1, column: 9 },
    { type: 'NEWLINE', kind: 'NEWLINE', value: '\n', line: 1, column: 15 },
    { type: 'KEYWORD', kind: 'REM', value: 'REM', line: 2, column: 1 },
    { type: 'COMMENT', kind: 'COMMENT', value: ' full line comment', line: 2, column: 4 },
    { type: 'NEWLINE', kind: 'NEWLINE', value: '\n', line: 2, column: 22 },
    { type: 'EOF', kind: 'EOF', value: '', line: 3, column: 1 },
  ]);
});

test('recognizes multi-character operators before single-character operators', () => {
  const tokens = compact(lex('IF A<=10 AND B<>3 THEN END\n'));

  assert.deepEqual(tokens, [
    { type: 'KEYWORD', kind: 'IF', value: 'IF', line: 1, column: 1 },
    { type: 'IDENTIFIER', kind: 'A', value: 'A', line: 1, column: 4 },
    { type: 'OPERATOR', kind: 'LESS_THAN_EQUALS', value: '<=', line: 1, column: 5 },
    { type: 'NUMBER', kind: 'NUMBER', value: '10', line: 1, column: 7 },
    { type: 'OPERATOR', kind: 'AND', value: 'AND', line: 1, column: 10 },
    { type: 'IDENTIFIER', kind: 'B', value: 'B', line: 1, column: 14 },
    { type: 'OPERATOR', kind: 'NOT_EQUALS', value: '<>', line: 1, column: 15 },
    { type: 'NUMBER', kind: 'NUMBER', value: '3', line: 1, column: 17 },
    { type: 'KEYWORD', kind: 'THEN', value: 'THEN', line: 1, column: 19 },
    { type: 'KEYWORD', kind: 'END', value: 'END', line: 1, column: 24 },
    { type: 'NEWLINE', kind: 'NEWLINE', value: '\n', line: 1, column: 27 },
    { type: 'EOF', kind: 'EOF', value: '', line: 2, column: 1 },
  ]);
});

test('supports custom keyword and operator extension points', () => {
  const lexer = createLexer({
    keywords: ['PRINT', 'SPRITE'],
    wordOperators: ['XOR'],
    symbolOperators: ['=>', '='],
  });

  const tokens = compact(lexer.lex('SPRITE HERO => TARGET XOR FLAG\n'));

  assert.deepEqual(tokens, [
    { type: 'KEYWORD', kind: 'SPRITE', value: 'SPRITE', line: 1, column: 1 },
    { type: 'IDENTIFIER', kind: 'HERO', value: 'HERO', line: 1, column: 8 },
    { type: 'OPERATOR', kind: '=>', value: '=>', line: 1, column: 13 },
    { type: 'IDENTIFIER', kind: 'TARGET', value: 'TARGET', line: 1, column: 16 },
    { type: 'OPERATOR', kind: 'XOR', value: 'XOR', line: 1, column: 23 },
    { type: 'IDENTIFIER', kind: 'FLAG', value: 'FLAG', line: 1, column: 27 },
    { type: 'NEWLINE', kind: 'NEWLINE', value: '\n', line: 1, column: 31 },
    { type: 'EOF', kind: 'EOF', value: '', line: 2, column: 1 },
  ]);
});

test('tracks label positions after statement separators', () => {
  const tokens = compact(lex('PRINT 1: LOOP: PRINT 2\n'));

  assert.deepEqual(tokens, [
    { type: 'KEYWORD', kind: 'PRINT', value: 'PRINT', line: 1, column: 1 },
    { type: 'NUMBER', kind: 'NUMBER', value: '1', line: 1, column: 7 },
    { type: 'PUNCTUATION', kind: 'COLON', value: ':', line: 1, column: 8 },
    { type: 'LABEL', kind: 'LOOP', value: 'LOOP', line: 1, column: 10 },
    { type: 'KEYWORD', kind: 'PRINT', value: 'PRINT', line: 1, column: 16 },
    { type: 'NUMBER', kind: 'NUMBER', value: '2', line: 1, column: 22 },
    { type: 'NEWLINE', kind: 'NEWLINE', value: '\n', line: 1, column: 23 },
    { type: 'EOF', kind: 'EOF', value: '', line: 2, column: 1 },
  ]);
});

test('throws useful errors with exact locations', () => {
  assert.throws(
    () => lex('PRINT "oops\n'),
    error => {
      assert.equal(error.name, 'LexerError');
      assert.match(error.message, /Unterminated string literal at 1:12/);
      assert.equal(error.line, 1);
      assert.equal(error.column, 12);
      return true;
    },
  );

  assert.throws(
    () => lex('PRINT @\n'),
    error => {
      assert.equal(error.name, 'LexerError');
      assert.match(error.message, /Unexpected character: @ at 1:7/);
      assert.equal(error.line, 1);
      assert.equal(error.column, 7);
      return true;
    },
  );
});

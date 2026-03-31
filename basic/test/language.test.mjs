import test from 'node:test';
import assert from 'node:assert/strict';

import {
  KAR_BASIC_KEYWORDS,
  KAR_BASIC_KEYWORD_SET,
  KAR_BASIC_KEYBOARD_KEYWORDS,
} from '../src/kar-basic/language.mjs';

test('language keyword set contains the parser-visible core keywords', () => {
  for (const keyword of ['PRINT', 'INPUT', 'IF', 'THEN', 'GOTO', 'VAR', 'END', 'FOR', 'WHILE', 'RND', 'INT', 'SEED']) {
    assert.equal(KAR_BASIC_KEYWORD_SET.has(keyword), true);
  }
});

test('keyboard keyword strip is a deliberate subset of the language keywords', () => {
  for (const keyword of KAR_BASIC_KEYBOARD_KEYWORDS) {
    assert.equal(KAR_BASIC_KEYWORD_SET.has(keyword), true);
  }
});

test('line numbers are not part of the shared language keyword surface', () => {
  assert.equal(KAR_BASIC_KEYWORDS.includes('RENUM'), false);
  assert.equal(KAR_BASIC_KEYWORDS.includes('RUN'), false);
  assert.equal(KAR_BASIC_KEYWORDS.includes('LIST'), false);
});

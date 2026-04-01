import { KAR_BASIC_KEYWORDS } from './language.mjs';

const DEFAULT_KEYWORDS = new Set(KAR_BASIC_KEYWORDS);

const DEFAULT_WORD_OPERATORS = new Set(['AND', 'OR', 'NOT', 'DIV', 'MOD']);
const DEFAULT_SYMBOL_OPERATORS = [
  '<=',
  '>=',
  '<>',
  '!=',
  '==',
  '=',
  '<',
  '>',
  '+',
  '-',
  '*',
  '/',
  '^',
];
const DEFAULT_PUNCTUATION = new Set(['(', ')', '[', ']', ',', '.', ';', ':']);

export function createLexer(options = {}) {
  const keywords = toUpperSet(options.keywords, DEFAULT_KEYWORDS);
  const wordOperators = toUpperSet(options.wordOperators, DEFAULT_WORD_OPERATORS);
  const punctuation = new Set(options.punctuation ?? DEFAULT_PUNCTUATION);
  const commentPrefixes = options.commentPrefixes ?? ["'"];
  const symbolOperators = [...(options.symbolOperators ?? DEFAULT_SYMBOL_OPERATORS)]
    .sort((left, right) => right.length - left.length);

  return {
    keywords,
    wordOperators,
    punctuation,
    symbolOperators,
    commentPrefixes,
    lex(source) {
      return lexSource(source, {
        keywords,
        wordOperators,
        punctuation,
        symbolOperators,
        commentPrefixes,
      });
    },
  };
}

export function lex(source, options = {}) {
  return createLexer(options).lex(source);
}

function lexSource(source, config) {
  const tokens = [];
  let index = 0;
  let line = 1;
  let column = 1;
  let startOfStatement = true;

  while (index < source.length) {
    const ch = source[index];

    if (ch === '\r') {
      index += 1;
      continue;
    }

    if (ch === '\n') {
      tokens.push(makeToken('NEWLINE', '\n', index, index + 1, line, column));
      index += 1;
      line += 1;
      column = 1;
      startOfStatement = true;
      continue;
    }

    if (isHorizontalWhitespace(ch)) {
      const start = index;
      const startColumn = column;
      while (index < source.length && isHorizontalWhitespace(source[index])) {
        index += 1;
        column += 1;
      }
      tokens.push(makeToken('WHITESPACE', source.slice(start, index), start, index, line, startColumn));
      continue;
    }

    const commentPrefix = config.commentPrefixes.find(prefix => source.startsWith(prefix, index));
    if (commentPrefix) {
      const start = index;
      const startColumn = column;
      while (index < source.length && source[index] !== '\n') {
        index += 1;
        column += 1;
      }
      tokens.push(makeToken('COMMENT', source.slice(start, index), start, index, line, startColumn));
      startOfStatement = false;
      continue;
    }

    if (ch === '"') {
      const start = index;
      const startColumn = column;
      index += 1;
      column += 1;

      let value = '';
      while (index < source.length) {
        const current = source[index];
        if (current === '\r') {
          index += 1;
          continue;
        }
        if (current === '\n') {
          throw lexError('Unterminated string literal', line, column);
        }
        if (current === '"') {
          if (source[index + 1] === '"') {
            value += '"';
            index += 2;
            column += 2;
            continue;
          }
          index += 1;
          column += 1;
          tokens.push(makeToken('STRING', value, start, index, line, startColumn));
          startOfStatement = false;
          value = null;
          break;
        }
        value += current;
        index += 1;
        column += 1;
      }

      if (value !== null) {
        throw lexError('Unterminated string literal', line, column);
      }
      continue;
    }

    if (isDigit(ch)) {
      const start = index;
      const startColumn = column;
      let hasDot = false;
      while (index < source.length) {
        const current = source[index];
        if (isDigit(current)) {
          index += 1;
          column += 1;
          continue;
        }
        if (current === '.' && !hasDot && isDigit(source[index + 1])) {
          hasDot = true;
          index += 1;
          column += 1;
          continue;
        }
        break;
      }
      tokens.push(makeToken('NUMBER', source.slice(start, index), start, index, line, startColumn));
      startOfStatement = false;
      continue;
    }

    if (isIdentifierStart(ch)) {
      const start = index;
      const startColumn = column;
      index += 1;
      column += 1;
      while (index < source.length && isIdentifierPart(source[index])) {
        index += 1;
        column += 1;
      }

      const upper = source.slice(start, index).toUpperCase();
      if (!/^[A-Z][0-9A-Z_]*$/.test(upper)) {
        throw lexError(`Invalid identifier: ${upper}`, line, startColumn);
      }
      if (startOfStatement && source[index] === ':') {
        tokens.push(makeToken('LABEL', upper, start, index + 1, line, startColumn));
        index += 1;
        column += 1;
        startOfStatement = true;
        continue;
      }

      if (upper === 'REM') {
        tokens.push(makeToken('KEYWORD', upper, start, index, line, startColumn));
        const commentStart = index;
        const commentColumn = column;
        while (index < source.length && source[index] !== '\n') {
          index += 1;
          column += 1;
        }
        if (commentStart < index) {
          tokens.push(makeToken('COMMENT', source.slice(commentStart, index), commentStart, index, line, commentColumn));
        }
        startOfStatement = false;
        continue;
      }

      if (config.wordOperators.has(upper)) {
        tokens.push(makeToken('OPERATOR', upper, start, index, line, startColumn));
      } else if (config.keywords.has(upper)) {
        tokens.push(makeToken('KEYWORD', upper, start, index, line, startColumn));
      } else {
        tokens.push(makeToken('IDENTIFIER', upper, start, index, line, startColumn));
      }
      startOfStatement = false;
      continue;
    }

    const operator = config.symbolOperators.find(candidate => source.startsWith(candidate, index));
    if (operator) {
      tokens.push(makeToken('OPERATOR', operator, index, index + operator.length, line, column));
      index += operator.length;
      column += operator.length;
      startOfStatement = false;
      continue;
    }

    if (config.punctuation.has(ch)) {
      tokens.push(makeToken('PUNCTUATION', ch, index, index + 1, line, column));
      index += 1;
      column += 1;
      startOfStatement = ch === ':';
      continue;
    }

    throw lexError(`Unexpected character: ${ch}`, line, column);
  }

  tokens.push(makeToken('EOF', '', source.length, source.length, line, column));
  return tokens;
}

function makeToken(type, value, start, end, line, column) {
  return {
    type,
    kind: tokenKind(type, value),
    value,
    start,
    end,
    line,
    column,
  };
}

function tokenKind(type, value) {
  switch (type) {
    case 'KEYWORD':
    case 'IDENTIFIER':
    case 'LABEL':
      return value.toUpperCase();
    case 'OPERATOR':
      return operatorKind(value);
    case 'PUNCTUATION':
      return punctuationKind(value);
    default:
      return type;
  }
}

function operatorKind(value) {
  switch (value) {
    case '+': return 'PLUS';
    case '-': return 'MINUS';
    case '*': return 'STAR';
    case '/': return 'SLASH';
    case '^': return 'CARET';
    case '=': return 'EQUALS';
    case '==': return 'DOUBLE_EQUALS';
    case '!=': return 'BANG_EQUALS';
    case '<': return 'LESS_THAN';
    case '<=': return 'LESS_THAN_EQUALS';
    case '>': return 'GREATER_THAN';
    case '>=': return 'GREATER_THAN_EQUALS';
    case '<>': return 'NOT_EQUALS';
    default: return value.toUpperCase();
  }
}

function punctuationKind(value) {
  switch (value) {
    case '(': return 'LEFT_PAREN';
    case ')': return 'RIGHT_PAREN';
    case '[': return 'LEFT_BRACKET';
    case ']': return 'RIGHT_BRACKET';
    case ',': return 'COMMA';
    case '.': return 'DOT';
    case ';': return 'SEMICOLON';
    case ':': return 'COLON';
    default: return value;
  }
}

function lexError(message, line, column) {
  const error = new Error(`${message} at ${line}:${column}`);
  error.name = 'LexerError';
  error.line = line;
  error.column = column;
  return error;
}

function toUpperSet(values, fallback) {
  const source = values ?? fallback;
  return new Set([...source].map(value => value.toUpperCase()));
}

function isHorizontalWhitespace(ch) {
  return ch === ' ' || ch === '\t';
}

function isDigit(ch) {
  return ch >= '0' && ch <= '9';
}

function isIdentifierStart(ch) {
  return ch >= 'A' && ch <= 'Z';
}

function isIdentifierPart(ch) {
  return (ch >= 'A' && ch <= 'Z') || isDigit(ch) || ch === '_';
}

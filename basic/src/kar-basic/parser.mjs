import { lex } from './lexer.mjs';

export function parse(source) {
  const tokens = normalizeTokens(lex(source));
  const parser = new Parser(tokens);
  return parser.parseProgram();
}

export function parseTokens(tokens) {
  const parser = new Parser(normalizeTokens(tokens));
  return parser.parseProgram();
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }

  parseProgram() {
    this.skipNewlines();
    if (this.peek()?.kind === 'EOF') {
      throw parserError('Expected a statement', this.peek());
    }

    const body = [];
    while (this.peek() && this.peek().kind !== 'EOF') {
      body.push(this.parseStatement());
      if (this.peek()?.kind === 'EOF') {
        break;
      }
      if (!this.matchKind('NEWLINE')) {
        throw parserError('Expected end of line after statement', this.peek());
      }
      this.skipNewlines();
    }

    this.consumeKind('EOF', 'Expected end of file');
    return {
      type: 'Program',
      body,
    };
  }

  parseStatement() {
    const token = this.peek();
    if (!token) {
      throw parserError('Expected a statement', this.tokens[this.tokens.length - 1]);
    }

    switch (token.kind) {
      case 'PRINT':
        return this.parsePrintStatement();
      case 'INPUT':
        return this.parseInputStatement();
      default:
        throw parserError(`Unsupported statement: ${token.kind}`, token);
    }
  }

  parsePrintStatement() {
    const keyword = this.consumeKind('PRINT', 'Expected PRINT');
    const argumentsList = [this.parseExpression('Expected an expression after PRINT')];

    while (this.matchKind('COMMA')) {
      argumentsList.push(this.parseExpression('Expected an expression after comma'));
    }

    return {
      type: 'PrintStatement',
      arguments: argumentsList,
      location: tokenLocation(keyword),
    };
  }

  parseInputStatement() {
    const keyword = this.consumeKind('INPUT', 'Expected INPUT');
    let prompt = null;

    if (this.isInputPromptStart()) {
      prompt = this.parseInputPrompt();
    }

    const target = this.parseVariableReference('Expected a variable name after INPUT');
    return {
      type: 'InputStatement',
      prompt,
      target,
      location: tokenLocation(keyword),
    };
  }

  parseNumberLiteral() {
    const token = this.consumeKind('NUMBER', 'Expected a numeric literal after PRINT');
    return {
      type: 'NumberLiteral',
      raw: token.value,
      value: Number(token.value),
      location: tokenLocation(token),
    };
  }

  parseStringLiteral() {
    const token = this.consumeKind('STRING', 'Expected a string literal');
    return {
      type: 'StringLiteral',
      value: token.value,
      location: tokenLocation(token),
    };
  }

  parseExpression(message = 'Expected an expression') {
    const token = this.peek();
    if (!token) {
      throw parserError(message, this.tokens[this.tokens.length - 1]);
    }

    switch (token.kind) {
      case 'NUMBER':
        return this.parseNumberLiteral();
      case 'STRING':
        return this.parseStringLiteral();
      default:
        if (token.type === 'IDENTIFIER') {
          return this.parseVariableReference(message);
        }
        throw parserError(message, token);
    }
  }

  parseInputPrompt() {
    const token = this.peek();
    if (token.kind === 'STRING') {
      return this.parseStringLiteral();
    }
    return this.parseVariableReference('Expected a string literal or prompt variable for INPUT prompt');
  }

  parseVariableReference(message = 'Expected a variable name') {
    const token = this.consumeKindMatching(
      current => current.type === 'IDENTIFIER',
      message,
    );
    return {
      type: 'VariableReference',
      name: token.value,
      location: tokenLocation(token),
    };
  }

  isInputPromptStart() {
    const first = this.peek();
    const second = this.peek(1);
    if (!first || !second || second.kind === 'EOF') {
      return false;
    }
    if (first.kind === 'STRING') {
      return second.type === 'IDENTIFIER';
    }
    return first.type === 'IDENTIFIER' && second.type === 'IDENTIFIER';
  }

  consumeKind(kind, message) {
    const token = this.peek();
    if (!token || token.kind !== kind) {
      throw parserError(message, token ?? this.tokens[this.tokens.length - 1]);
    }
    this.index += 1;
    return token;
  }

  consumeKindMatching(predicate, message) {
    const token = this.peek();
    if (!token || !predicate(token)) {
      throw parserError(message, token ?? this.tokens[this.tokens.length - 1]);
    }
    this.index += 1;
    return token;
  }

  peek(offset = 0) {
    return this.tokens[this.index + offset];
  }

  matchKind(kind) {
    if (this.peek()?.kind !== kind) {
      return false;
    }
    this.index += 1;
    return true;
  }

  skipNewlines() {
    while (this.peek()?.kind === 'NEWLINE') {
      this.index += 1;
    }
  }
}

function normalizeTokens(tokens) {
  const result = [];
  for (const token of tokens) {
    if (token.type === 'WHITESPACE' || token.type === 'COMMENT') {
      continue;
    }
    result.push(token);
  }
  return result;
}

function tokenLocation(token) {
  return {
    line: token.line,
    column: token.column,
  };
}

function parserError(message, token) {
  const suffix = token ? ` at ${token.line}:${token.column}` : '';
  const error = new Error(`${message}${suffix}`);
  error.name = 'ParserError';
  if (token) {
    error.line = token.line;
    error.column = token.column;
    error.token = token;
  }
  return error;
}

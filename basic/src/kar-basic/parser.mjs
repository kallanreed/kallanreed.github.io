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
    const body = this.parseStatementList(new Set(['EOF']));
    this.consumeKind('EOF', 'Expected end of file');
    return {
      type: 'Program',
      body,
    };
  }

  parseStatementList(stopKinds) {
    return this.parseStatementListWithOptions(stopKinds);
  }

  parseStatementListWithOptions(stopKinds, options = {}) {
    const { allowEmpty = false } = options;
    this.skipNewlines();
    if (!allowEmpty && this.peek() && stopKinds.has(this.peek().kind) && this.peek().kind !== 'EOF') {
      throw parserError('Expected a statement', this.peek());
    }

    const body = [];
    while (this.peek() && this.peek().kind !== 'EOF' && !stopKinds.has(this.peek().kind)) {
      body.push(this.parseStatement());
      if (!this.peek() || stopKinds.has(this.peek().kind)) {
        break;
      }
      if (!this.matchKind('NEWLINE')) {
        throw parserError('Expected end of line after statement', this.peek());
      }
      this.skipNewlines();
    }
    return body;
  }

  parseStatement() {
    const labels = this.parseLeadingLabels();
    const token = this.peek();
    if (!token) {
      throw parserError('Expected a statement', this.tokens[this.tokens.length - 1]);
    }

    if (token.kind === 'NEWLINE' || token.kind === 'EOF') {
      return {
        type: 'LabelStatement',
        labels,
        location: labels[0]?.location ?? tokenLocation(token),
      };
    }

    let statement;
    switch (token.kind) {
      case 'PRINT':
        statement = this.parsePrintStatement();
        break;
      case 'INPUT':
        statement = this.parseInputStatement();
        break;
      case 'DIM':
        statement = this.parseDimStatement();
        break;
      case 'FOR':
        statement = this.parseForStatement();
        break;
      case 'GOTO':
        statement = this.parseGotoStatement();
        break;
      case 'VAR':
        statement = this.parseVarStatement();
        break;
      case 'IF':
        statement = this.parseIfStatement();
        break;
      case 'WHILE':
        statement = this.parseWhileStatement();
        break;
      case 'SEED':
        statement = this.parseSeedStatement();
        break;
      default:
        if (token.type === 'IDENTIFIER' && this.isAssignmentStart()) {
          statement = this.parseAssignmentStatement();
          break;
        }
        throw parserError(`Unsupported statement: ${token.kind}`, token);
    }

    if (labels.length > 0) {
      statement.labels = labels;
    }
    return statement;
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

  parseDimStatement() {
    const keyword = this.consumeKind('DIM', 'Expected DIM');
    const target = this.parseVariableReference('Expected array name after DIM');
    this.consumeKind('LEFT_PAREN', 'Expected ( after array name');
    const size = this.parseExpression('Expected an array size inside DIM(...)');
    this.consumeKind('RIGHT_PAREN', 'Expected ) after array size');
    return {
      type: 'DimStatement',
      target,
      size,
      location: tokenLocation(keyword),
    };
  }

  parseForStatement() {
    const keyword = this.consumeKind('FOR', 'Expected FOR');
    const variable = this.parseVariableReference('Expected loop variable after FOR');
    this.consumeKind('EQUALS', 'Expected = after loop variable');
    const start = this.parseNumericExpression('Expected a numeric expression after =');
    this.consumeKind('TO', 'Expected TO in FOR statement');
    const end = this.parseNumericExpression('Expected a numeric expression after TO');

    let step = {
      type: 'NumberLiteral',
      raw: '1',
      value: 1,
      location: tokenLocation(keyword),
    };
    if (this.matchKind('STEP')) {
      step = this.parseNumericExpression('Expected a numeric expression after STEP');
    }

    if (!this.matchKind('NEWLINE')) {
      throw parserError('Expected end of line after FOR header', this.peek());
    }

    const body = this.parseStatementListWithOptions(new Set(['END']), { allowEmpty: true });
    this.consumeKind('END', 'Expected END FOR to close FOR block');
    this.consumeKind('FOR', 'Expected FOR after END');

    return {
      type: 'ForStatement',
      variable,
      start,
      end,
      step,
      body,
      location: tokenLocation(keyword),
    };
  }

  parseSeedStatement() {
    const keyword = this.consumeKind('SEED', 'Expected SEED');
    const argument = this.parseNumericExpression('Expected a numeric expression after SEED');
    return {
      type: 'SeedStatement',
      argument,
      location: tokenLocation(keyword),
    };
  }

  parseGotoStatement() {
    const keyword = this.consumeKind('GOTO', 'Expected GOTO');
    const target = this.parseVariableReference('Expected label name after GOTO');
    return {
      type: 'GotoStatement',
      target: target.name,
      location: tokenLocation(keyword),
    };
  }

  parseVarStatement() {
    const keyword = this.consumeKind('VAR', 'Expected VAR');
    const target = this.parseVariableReference('Expected variable name after VAR');
    this.consumeKind('EQUALS', 'Expected = after variable name');
    const value = this.parseExpression('Expected an expression after =');
    return {
      type: 'VarStatement',
      target,
      value,
      location: tokenLocation(keyword),
    };
  }

  parseAssignmentStatement() {
    const target = this.parseAssignmentTarget('Expected assignment target');
    this.consumeKind('EQUALS', 'Expected = after assignment target');
    const value = this.parseExpression('Expected an expression after =');
    return {
      type: 'AssignmentStatement',
      target,
      value,
      location: target.location,
    };
  }

  parseIfStatement() {
    const keyword = this.consumeKind('IF', 'Expected IF');
    const condition = this.parseExpression('Expected a condition after IF');
    this.consumeKind('THEN', 'Expected THEN after IF condition');

    if (this.matchKind('NEWLINE')) {
      return this.parseBlockIfStatement(keyword, condition);
    }

    const statement = this.parseStatement();
    return {
      type: 'IfStatement',
      branches: [
        {
          condition,
          body: [statement],
          location: tokenLocation(keyword),
        },
      ],
      elseBody: null,
      inline: true,
      location: tokenLocation(keyword),
    };
  }

  parseWhileStatement() {
    const keyword = this.consumeKind('WHILE', 'Expected WHILE');
    const condition = this.parseExpression('Expected a condition after WHILE');
    this.consumeKind('NEWLINE', 'Expected end of line after WHILE condition');
    const body = this.parseStatementListWithOptions(new Set(['END']), { allowEmpty: true });
    this.consumeKind('END', 'Expected END WHILE to close WHILE block');
    this.consumeKind('WHILE', 'Expected WHILE after END');
    return {
      type: 'WhileStatement',
      condition,
      body,
      location: tokenLocation(keyword),
    };
  }

  parseBlockIfStatement(keyword, initialCondition) {
    const branches = [
      {
        condition: initialCondition,
        body: this.parseStatementListWithOptions(new Set(['ELSE', 'END']), { allowEmpty: true }),
        location: tokenLocation(keyword),
      },
    ];
    let elseBody = null;

    while (this.peek()?.kind === 'ELSE') {
      const elseToken = this.consumeKind('ELSE', 'Expected ELSE');
      if (this.peek()?.kind === 'IF') {
        this.consumeKind('IF', 'Expected IF after ELSE');
        const condition = this.parseExpression('Expected a condition after ELSE IF');
        this.consumeKind('THEN', 'Expected THEN after ELSE IF condition');
        this.consumeKind('NEWLINE', 'Expected end of line after ELSE IF THEN');
        branches.push({
          condition,
          body: this.parseStatementListWithOptions(new Set(['ELSE', 'END']), { allowEmpty: true }),
          location: tokenLocation(elseToken),
        });
        continue;
      }

      this.consumeKind('NEWLINE', 'Expected end of line after ELSE');
      elseBody = this.parseStatementListWithOptions(new Set(['END']), { allowEmpty: true });
      break;
    }

    this.consumeKind('END', 'Expected END IF to close IF block');
    this.consumeKind('IF', 'Expected IF after END');

    return {
      type: 'IfStatement',
      branches,
      elseBody,
      inline: false,
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

  parseBooleanLiteral() {
    const token = this.matchOneOf(['TRUE', 'FALSE']);
    if (!token) {
      throw parserError('Expected a boolean literal', this.peek() ?? this.tokens[this.tokens.length - 1]);
    }
    return {
      type: 'BooleanLiteral',
      value: token.kind === 'TRUE',
      location: tokenLocation(token),
    };
  }

  parseExpression(message = 'Expected an expression') {
    return this.parseOrExpression(message);
  }

  parseOrExpression(message) {
    let expression = this.parseAndExpression(message);

    while (true) {
      const operator = this.matchKind('OR');
      if (!operator) {
        return expression;
      }
      expression = {
        type: 'BinaryExpression',
        operator: operator.value,
        left: expression,
        right: this.parseAndExpression('Expected an expression after operator'),
        location: tokenLocation(operator),
      };
    }
  }

  parseAndExpression(message) {
    let expression = this.parseNotExpression(message);

    while (true) {
      const operator = this.matchKind('AND');
      if (!operator) {
        return expression;
      }
      expression = {
        type: 'BinaryExpression',
        operator: operator.value,
        left: expression,
        right: this.parseNotExpression('Expected an expression after operator'),
        location: tokenLocation(operator),
      };
    }
  }

  parseNotExpression(message) {
    const operator = this.matchKind('NOT');
    if (operator) {
      return {
        type: 'UnaryExpression',
        operator: operator.value,
        argument: this.parseNotExpression('Expected an expression after operator'),
        location: tokenLocation(operator),
      };
    }
    return this.parseComparisonExpression(message);
  }

  parseComparisonExpression(message) {
    let expression = this.parseAdditiveExpression(message);

    while (true) {
      const operator = this.matchOneOf([
        'EQUALS',
        'DOUBLE_EQUALS',
        'BANG_EQUALS',
        'NOT_EQUALS',
        'LESS_THAN',
        'LESS_THAN_EQUALS',
        'GREATER_THAN',
        'GREATER_THAN_EQUALS',
      ]);
      if (!operator) {
        return expression;
      }
      expression = {
        type: 'BinaryExpression',
        operator: operator.value,
        left: expression,
        right: this.parseAdditiveExpression('Expected an expression after operator'),
        location: tokenLocation(operator),
      };
    }
  }

  parseNumericExpression(message = 'Expected a numeric expression') {
    const expression = this.parseExpression(message);
    const nonNumericLocation = firstNonNumericLocation(expression);
    if (nonNumericLocation) {
      throw parserError(message, nonNumericLocation);
    }
    return expression;
  }

  parseAdditiveExpression(message) {
    let expression = this.parseMultiplicativeExpression(message);

    while (true) {
      const operator = this.matchOneOf(['PLUS', 'MINUS']);
      if (!operator) {
        return expression;
      }
      expression = {
        type: 'BinaryExpression',
        operator: operator.value,
        left: expression,
        right: this.parseMultiplicativeExpression('Expected an expression after operator'),
        location: tokenLocation(operator),
      };
    }
  }

  parseMultiplicativeExpression(message) {
    let expression = this.parseUnaryExpression(message);

    while (true) {
      const operator = this.matchOneOf(['STAR', 'SLASH', 'DIV', 'MOD']);
      if (!operator) {
        return expression;
      }
      expression = {
        type: 'BinaryExpression',
        operator: operator.value,
        left: expression,
        right: this.parseUnaryExpression('Expected an expression after operator'),
        location: tokenLocation(operator),
      };
    }
  }

  parseUnaryExpression(message) {
    const token = this.peek();
    if (!token) {
      throw parserError(message, this.tokens[this.tokens.length - 1]);
    }

    if (token.kind === 'PLUS' || token.kind === 'MINUS') {
      this.index += 1;
      return {
        type: 'UnaryExpression',
        operator: token.value,
        argument: this.parseUnaryExpression('Expected an expression after operator'),
        location: tokenLocation(token),
      };
    }

    if (token.kind === 'MID') {
      return this.parseMidExpression();
    }

    if (isBuiltinPrefixFunction(token.kind)) {
      this.index += 1;
      return {
        type: 'BuiltinExpression',
        name: token.kind,
        arguments: [this.parseUnaryExpression('Expected an expression after builtin')],
        location: tokenLocation(token),
      };
    }

    return this.parsePrimaryExpression(message);
  }

  parseMidExpression() {
    const token = this.consumeKind('MID', 'Expected MID');
    const source = this.parseExpression('Expected a string expression after MID');
    this.consumeKind('COMMA', 'Expected comma after MID source');
    const start = this.parseExpression('Expected a start expression after comma');
    const args = [source, start];
    if (this.matchKind('COMMA')) {
      args.push(this.parseExpression('Expected a length expression after comma'));
    }
    return {
      type: 'BuiltinExpression',
      name: 'MID',
      arguments: args,
      location: tokenLocation(token),
    };
  }

  parsePrimaryExpression(message) {
    const token = this.peek();
    if (!token) {
      throw parserError(message, this.tokens[this.tokens.length - 1]);
    }

    switch (token.kind) {
      case 'NUMBER':
        return this.parseNumberLiteral();
      case 'STRING':
        return this.parseStringLiteral();
      case 'TRUE':
      case 'FALSE':
        return this.parseBooleanLiteral();
      case 'LEFT_PAREN':
        return this.parseParenthesizedExpression();
      case 'RND':
        return this.parseRndExpression();
      case 'TIMER':
        this.index += 1;
        return {
          type: 'BuiltinExpression',
          name: token.kind,
          arguments: [],
          location: tokenLocation(token),
        };
      default:
        if (token.type === 'IDENTIFIER') {
          return this.parseReferenceExpression(message);
        }
        throw parserError(message, token);
    }
  }

  parseParenthesizedExpression() {
    const leftParen = this.consumeKind('LEFT_PAREN', 'Expected (');
    const expression = this.parseExpression('Expected an expression after (');
    this.consumeKind('RIGHT_PAREN', 'Expected ) to close expression');
    return {
      type: 'ParenthesizedExpression',
      expression,
      location: tokenLocation(leftParen),
    };
  }

  parseRndExpression() {
    const token = this.consumeKind('RND', 'Expected RND');
    const args = [];

    if (this.canStartExpression(this.peek())) {
      args.push(this.parseExpression('Expected an expression after RND'));
      if (this.peek()?.kind === 'COMMA' && this.canStartExpression(this.peek(1))) {
        this.consumeKind('COMMA', 'Expected comma in RND range');
        args.push(this.parseExpression('Expected an expression after comma'));
      }
    }

    return {
      type: 'BuiltinExpression',
      name: 'RND',
      arguments: args,
      location: tokenLocation(token),
    };
  }

  parseInputPrompt() {
    const token = this.peek();
    if (token.kind === 'STRING') {
      return this.parseStringLiteral();
    }
    return this.parseVariableReference('Expected a string literal or prompt variable for INPUT prompt');
  }

  parseReferenceExpression(message = 'Expected a variable name') {
    return this.parseAssignmentTarget(message);
  }

  parseAssignmentTarget(message = 'Expected a variable name') {
    const target = this.parseVariableReference(message);
    if (!this.matchKind('LEFT_PAREN')) {
      return target;
    }
    const index = this.parseExpression('Expected an array index after (');
    this.consumeKind('RIGHT_PAREN', 'Expected ) after array index');
    return {
      type: 'ArrayAccess',
      target,
      index,
      location: target.location,
    };
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

  parseLeadingLabels() {
    const labels = [];
    while (this.peek()?.type === 'LABEL') {
      const token = this.consumeKindMatching(
        current => current.type === 'LABEL',
        'Expected a label',
      );
      labels.push({
        type: 'Label',
        name: token.value,
        location: tokenLocation(token),
      });
    }
    return labels;
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
    const token = this.peek();
    if (!token || token.kind !== kind) {
      return null;
    }
    this.index += 1;
    return token;
  }

  matchOneOf(kinds) {
    const token = this.peek();
    if (!token || !kinds.includes(token.kind)) {
      return null;
    }
    this.index += 1;
    return token;
  }

  skipNewlines() {
    while (this.peek()?.kind === 'NEWLINE') {
      this.index += 1;
    }
  }

  canStartExpression(token) {
    if (!token) {
      return false;
    }
    if (token.type === 'IDENTIFIER') {
      return true;
    }
    return [
      'NUMBER',
      'STRING',
      'TRUE',
      'FALSE',
      'LEFT_PAREN',
      'PLUS',
      'MINUS',
      'NOT',
      'INT',
      'ABS',
      'ASC',
      'LEN',
      'MID',
      'SIGN',
      'STR',
      'CHR',
      'RND',
      'TIMER',
      'VAL',
    ].includes(token.kind);
  }

  isAssignmentStart() {
    if (this.peek()?.type !== 'IDENTIFIER') {
      return false;
    }

    if (this.peek(1)?.kind === 'EQUALS') {
      return true;
    }

    if (this.peek(1)?.kind !== 'LEFT_PAREN') {
      return false;
    }

    let depth = 0;
    let offset = 1;
    while (true) {
      const token = this.peek(offset);
      if (!token || token.kind === 'EOF' || token.kind === 'NEWLINE') {
        return false;
      }
      if (token.kind === 'LEFT_PAREN') {
        depth += 1;
      } else if (token.kind === 'RIGHT_PAREN') {
        depth -= 1;
        if (depth === 0) {
          return this.peek(offset + 1)?.kind === 'EQUALS';
        }
      }
      offset += 1;
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

function parserError(message, tokenOrLocation) {
  const location = tokenOrLocation
    ? ('line' in tokenOrLocation && 'column' in tokenOrLocation
      ? { line: tokenOrLocation.line, column: tokenOrLocation.column }
      : null)
    : null;
  const suffix = location ? ` at ${location.line}:${location.column}` : '';
  const error = new Error(`${message}${suffix}`);
  error.name = 'ParserError';
  if (location) {
    error.line = location.line;
    error.column = location.column;
  }
  return error;
}

function firstNonNumericLocation(expression) {
  switch (expression?.type) {
    case 'StringLiteral':
      return expression.location;
    case 'BuiltinExpression':
      if (expression.name === 'LEN') {
        return null;
      }
      if (expression.name === 'VAL') {
        return null;
      }
      if (expression.name === 'ASC') {
        return null;
      }
      if (expression.name === 'STR' || expression.name === 'CHR') {
        return expression.location;
      }
      if (expression.name === 'MID') {
        return expression.location;
      }
      return firstNonNumericLocation(expression.arguments?.[0] ?? null);
    case 'UnaryExpression':
      return firstNonNumericLocation(expression.argument);
    case 'BinaryExpression':
      if (expression.operator === '+' || expression.operator === '-' || expression.operator === '*' || expression.operator === '/') {
        return firstNonNumericLocation(expression.left) ?? firstNonNumericLocation(expression.right);
      }
      return null;
    case 'ParenthesizedExpression':
      return firstNonNumericLocation(expression.expression);
    case 'ArrayAccess':
      return null;
    default:
      return null;
  }
}

function isBuiltinPrefixFunction(kind) {
  return kind === 'INT'
    || kind === 'ABS'
    || kind === 'ASC'
    || kind === 'LEN'
    || kind === 'SIGN'
    || kind === 'STR'
    || kind === 'CHR'
    || kind === 'VAL';
}

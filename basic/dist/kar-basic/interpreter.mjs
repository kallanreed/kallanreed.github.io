export function interpret(ast, host = {}) {
  const runtime = new InterpreterRuntime(host);
  return runtime.run(ast);
}

class InterpreterRuntime {
  constructor(host) {
    this.host = {
      print: host.print ?? (() => {}),
      input: host.input ?? (async () => ''),
      now: host.now ?? (() => Date.now() / 1000),
    };
    this.globalEnvironment = new Environment();
    this.labelIndex = new Map();
    this.program = [];
    this.randomState = 1;
  }

  async run(ast) {
    if (!ast || ast.type !== 'Program' || !Array.isArray(ast.body)) {
      throw runtimeError('Expected Program node', ast?.location);
    }

    this.program = ast.body;
    this.labelIndex = buildLabelIndex(ast.body);

    let programCounter = 0;
    while (programCounter < this.program.length) {
      const signal = await this.executeStatement(this.program[programCounter]);
      if (signal?.type === 'goto') {
        programCounter = this.resolveLabel(signal.target, signal.location);
        continue;
      }
      programCounter += 1;
    }
  }

  async executeBlock(statements) {
    for (const statement of statements) {
      const signal = await this.executeStatement(statement);
      if (signal) {
        return signal;
      }
    }
    return null;
  }

  async executeStatement(statement) {
    switch (statement?.type) {
      case 'LabelStatement':
        return null;
      case 'PrintStatement':
        this.executePrintStatement(statement);
        return null;
      case 'InputStatement':
        await this.executeInputStatement(statement);
        return null;
      case 'DimStatement':
        this.executeDimStatement(statement);
        return null;
      case 'ForStatement':
        return this.executeForStatement(statement);
      case 'GotoStatement':
        return this.executeGotoStatement(statement);
      case 'VarStatement':
        this.executeVarStatement(statement);
        return null;
      case 'AssignmentStatement':
        this.executeAssignmentStatement(statement);
        return null;
      case 'IfStatement':
        return this.executeIfStatement(statement);
      case 'WhileStatement':
        return this.executeWhileStatement(statement);
      case 'SeedStatement':
        this.executeSeedStatement(statement);
        return null;
      default:
        throw runtimeError(`Unsupported statement node: ${statement?.type ?? 'unknown'}`, statement?.location);
    }
  }

  executePrintStatement(statement) {
    const text = statement.arguments
      .map(argument => this.evaluateExpression(argument))
      .map(value => formatValue(value))
      .join('');
    this.host.print(text);
  }

  async executeInputStatement(statement) {
    const promptValue = statement.prompt ? this.evaluateExpression(statement.prompt) : '';
    const raw = await this.host.input(String(promptValue));
    this.globalEnvironment.setImplicit(statement.target.name, coerceInputValue(raw));
  }

  async executeForStatement(statement) {
    const start = this.evaluateNumericExpression(statement.start, 'FOR start value must be numeric');
    const end = this.evaluateNumericExpression(statement.end, 'FOR end value must be numeric');
    const step = this.evaluateNumericExpression(statement.step, 'FOR step value must be numeric');

    if (step === 0) {
      throw runtimeError('FOR step cannot be zero', statement.step?.location ?? statement.location);
    }

    for (let current = start; loopContinues(current, end, step); current += step) {
      this.globalEnvironment.setImplicit(statement.variable.name, current);
      const signal = await this.executeBlock(statement.body);
      if (signal) {
        return signal;
      }
    }
    return null;
  }

  executeDimStatement(statement) {
    const size = this.evaluateArraySize(statement.size, 'DIM size must be a non-negative integer');
    this.globalEnvironment.declare(
      statement.target.name,
      createArrayValue(size),
      statement.target.location,
    );
  }

  executeVarStatement(statement) {
    const value = this.evaluateExpression(statement.value);
    this.globalEnvironment.declare(statement.target.name, value, statement.target.location);
  }

  executeAssignmentStatement(statement) {
    const value = this.evaluateExpression(statement.value);
    if (statement.target.type === 'ArrayAccess') {
      const index = this.evaluateArrayIndex(statement.target.index);
      const target = this.evaluateIndexedTarget(statement.target);
      if (typeof target === 'string') {
        throw runtimeError(`String indexing is read-only: ${statement.target.target.name}`, statement.target.location);
      }
      if (index >= target.elements.length) {
        throw runtimeError(`Index out of bounds: ${index}`, statement.target.index.location ?? statement.target.location);
      }
      target.elements[index] = value;
      return;
    }
    this.globalEnvironment.assign(statement.target.name, value, statement.target.location);
  }

  async executeIfStatement(statement) {
    for (const branch of statement.branches) {
      if (!this.evaluateBooleanExpression(branch.condition, 'IF condition must be boolean')) {
        continue;
      }
      return this.executeBlock(branch.body);
    }

    if (statement.elseBody) {
      return this.executeBlock(statement.elseBody);
    }

    return null;
  }

  async executeWhileStatement(statement) {
    while (this.evaluateBooleanExpression(statement.condition, 'WHILE condition must be boolean')) {
      const signal = await this.executeBlock(statement.body);
      if (signal) {
        return signal;
      }
    }
    return null;
  }

  executeSeedStatement(statement) {
    const seed = this.evaluateNumericExpression(statement.argument, 'SEED requires a numeric value');
    this.randomState = normalizeSeed(seed);
  }

  executeGotoStatement(statement) {
    return {
      type: 'goto',
      target: statement.target,
      location: statement.location,
    };
  }

  evaluateExpression(expression) {
    switch (expression?.type) {
      case 'NumberLiteral':
        return expression.value;
      case 'StringLiteral':
        return expression.value;
      case 'BooleanLiteral':
        return expression.value;
      case 'VariableReference':
        return this.globalEnvironment.get(expression.name);
      case 'ArrayAccess':
        return this.evaluateArrayElement(expression);
      case 'UnaryExpression':
        return this.evaluateUnaryExpression(expression);
      case 'BinaryExpression':
        return this.evaluateBinaryExpression(expression);
      case 'ParenthesizedExpression':
        return this.evaluateExpression(expression.expression);
      case 'BuiltinExpression':
        return this.evaluateBuiltinExpression(expression);
      default:
        throw runtimeError(`Unsupported expression node: ${expression?.type ?? 'unknown'}`, expression?.location);
    }
  }

  evaluateBuiltinExpression(expression) {
    switch (expression.name) {
      case 'RND':
        return this.evaluateRndBuiltin(expression);
      case 'TIMER':
        return this.host.now();
      case 'INT':
        return Math.floor(this.evaluateNumericExpression(expression.arguments[0], 'INT requires a numeric argument'));
      case 'LEN':
        return this.evaluateLengthBuiltin(expression);
      case 'ABS':
        return Math.abs(this.evaluateNumericExpression(expression.arguments[0], 'ABS requires a numeric argument'));
      case 'ASC':
        return this.evaluateAscBuiltin(expression);
      case 'SIGN':
        return signOf(this.evaluateNumericExpression(expression.arguments[0], 'SIGN requires a numeric argument'));
      case 'STR':
        return formatValue(this.evaluateExpression(expression.arguments[0]));
      case 'CHR':
        return String.fromCharCode(normalizeCharCode(this.evaluateNumericExpression(expression.arguments[0], 'CHR requires a numeric argument')));
      case 'MID':
        return this.evaluateMidBuiltin(expression);
      case 'VAL':
        return this.evaluateValueBuiltin(expression);
      default:
        throw runtimeError(`Unsupported builtin: ${expression.name}`, expression.location);
    }
  }

  evaluateRndBuiltin(expression) {
    if (!Array.isArray(expression.arguments) || expression.arguments.length === 0) {
      return this.nextRandom();
    }

    if (expression.arguments.length === 1) {
      const max = this.evaluateNumericExpression(expression.arguments[0], 'RND max must be numeric');
      return this.randomIntegerInRange(0, max, expression.location);
    }

    if (expression.arguments.length === 2) {
      const min = this.evaluateNumericExpression(expression.arguments[0], 'RND min must be numeric');
      const max = this.evaluateNumericExpression(expression.arguments[1], 'RND max must be numeric');
      return this.randomIntegerInRange(min, max, expression.location);
    }

    throw runtimeError('RND accepts at most two arguments', expression.location);
  }

  evaluateLengthBuiltin(expression) {
    const value = this.evaluateExpression(expression.arguments[0]);
    if (typeof value === 'string') {
      return value.length;
    }
    if (isArrayValue(value)) {
      return value.elements.length;
    }
    throw runtimeError('LEN requires a string or array argument', expression.location);
  }

  evaluateAscBuiltin(expression) {
    const value = this.evaluateExpression(expression.arguments[0]);
    if (typeof value !== 'string') {
      throw runtimeError('ASC requires a string argument', expression.location);
    }
    if (value.length === 0) {
      throw runtimeError('ASC requires a non-empty string', expression.location);
    }
    return value.charCodeAt(0);
  }

  evaluateMidBuiltin(expression) {
    const [sourceExpression, startExpression, lengthExpression] = expression.arguments;
    const source = this.evaluateExpression(sourceExpression);
    if (typeof source !== 'string') {
      throw runtimeError('MID requires a string source', expression.location);
    }
    const start = this.evaluateNumericExpression(startExpression, 'MID start must be a non-negative integer');
    if (!Number.isInteger(start) || start < 0) {
      throw runtimeError('MID start must be a non-negative integer', startExpression?.location ?? expression.location);
    }
    if (lengthExpression === undefined) {
      return source.slice(start);
    }
    const length = this.evaluateNumericExpression(lengthExpression, 'MID length must be a non-negative integer');
    if (!Number.isInteger(length) || length < 0) {
      throw runtimeError('MID length must be a non-negative integer', lengthExpression?.location ?? expression.location);
    }
    return source.slice(start, start + length);
  }

  evaluateValueBuiltin(expression) {
    const value = this.evaluateExpression(expression.arguments[0]);
    if (typeof value !== 'string') {
      throw runtimeError('VAL requires a string argument', expression.location);
    }
    const trimmed = value.trim();
    if (trimmed === '') {
      throw runtimeError('VAL requires a numeric string', expression.location);
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      throw runtimeError('VAL requires a numeric string', expression.location);
    }
    return parsed;
  }

  evaluateArrayElement(expression) {
    const target = this.evaluateIndexedTarget(expression);
    const index = this.evaluateArrayIndex(expression.index);
    if (typeof target === 'string') {
      if (index >= target.length) {
        throw runtimeError(`Index out of bounds: ${index}`, expression.index?.location ?? expression.location);
      }
      return target[index];
    }
    if (index >= target.elements.length) {
      throw runtimeError(`Index out of bounds: ${index}`, expression.index?.location ?? expression.location);
    }
    return target.elements[index];
  }

  evaluateIndexedTarget(expression) {
    const value = this.globalEnvironment.get(expression.target.name);
    if (typeof value === 'string' || isArrayValue(value)) {
      return value;
    }
    throw runtimeError(`Variable is not indexable: ${expression.target.name}`, expression.target.location);
  }

  evaluateArrayIndex(expression) {
    const index = this.evaluateNumericExpression(expression, 'Array index must be a non-negative integer');
    if (!Number.isInteger(index) || index < 0) {
      throw runtimeError('Array index must be a non-negative integer', expression?.location);
    }
    return index;
  }

  evaluateArraySize(expression, message) {
    const size = this.evaluateNumericExpression(expression, message);
    if (!Number.isInteger(size) || size < 0) {
      throw runtimeError(message, expression?.location);
    }
    return size;
  }

  evaluateNumericExpression(expression, message) {
    const value = this.evaluateExpression(expression);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw runtimeError(message, expression?.location);
    }
    return value;
  }

  evaluateBooleanExpression(expression, message) {
    const value = this.evaluateExpression(expression);
    if (typeof value !== 'boolean') {
      throw runtimeError(message, expression?.location);
    }
    return value;
  }

  evaluateUnaryExpression(expression) {
    switch (expression.operator) {
      case '+':
      case '-': {
        const value = this.evaluateNumericExpression(expression.argument, 'Unary operator requires a numeric operand');
        return expression.operator === '+' ? value : -value;
      }
      case 'NOT':
        return !this.evaluateBooleanExpression(expression.argument, 'NOT requires a boolean operand');
      default:
        throw runtimeError(`Unsupported unary operator: ${expression.operator}`, expression.location);
    }
  }

  evaluateBinaryExpression(expression) {
    switch (expression.operator) {
      case 'AND':
      case 'OR':
        return this.evaluateLogicalExpression(expression);
      case '+':
      case '-':
      case '*':
      case '/':
      case 'DIV':
      case 'MOD':
        return this.evaluateArithmeticExpression(expression);
      case '=':
      case '==':
      case '!=':
      case '<>':
        return this.evaluateEqualityExpression(expression);
      case '<':
      case '<=':
      case '>':
      case '>=':
        return this.evaluateOrderingExpression(expression);
      default:
        throw runtimeError(`Unsupported binary operator: ${expression.operator}`, expression.location);
    }
  }

  evaluateLogicalExpression(expression) {
    switch (expression.operator) {
      case 'AND': {
        const left = this.evaluateBooleanExpression(expression.left, 'AND requires boolean operands');
        if (!left) {
          return false;
        }
        return this.evaluateBooleanExpression(expression.right, 'AND requires boolean operands');
      }
      case 'OR': {
        const left = this.evaluateBooleanExpression(expression.left, 'OR requires boolean operands');
        if (left) {
          return true;
        }
        return this.evaluateBooleanExpression(expression.right, 'OR requires boolean operands');
      }
      default:
        throw runtimeError(`Unsupported logical operator: ${expression.operator}`, expression.location);
    }
  }

  evaluateArithmeticExpression(expression) {
    switch (expression.operator) {
      case '+': {
        const left = this.evaluateExpression(expression.left);
        const right = this.evaluateExpression(expression.right);
        if (typeof left === 'number' && typeof right === 'number') {
          return left + right;
        }
        if (typeof left === 'string' && typeof right === 'string') {
          return left + right;
        }
        throw runtimeError('Operator + requires numeric operands or string operands', expression.location);
      }
      case '-':
      case '*':
      case '/':
      case 'DIV':
      case 'MOD': {
        const left = this.evaluateNumericExpression(expression.left, `Operator ${expression.operator} requires numeric operands`);
        const right = this.evaluateNumericExpression(expression.right, `Operator ${expression.operator} requires numeric operands`);
        switch (expression.operator) {
          case '-':
            return left - right;
          case '*':
            return left * right;
          case '/':
            return left / right;
          case 'DIV':
            if (right === 0) {
              throw runtimeError('DIV requires a non-zero divisor', expression.location);
            }
            return truncateTowardZero(left / right);
          case 'MOD':
            if (right === 0) {
              throw runtimeError('MOD requires a non-zero divisor', expression.location);
            }
            return left % right;
          default:
            throw runtimeError(`Unsupported arithmetic operator: ${expression.operator}`, expression.location);
        }
      }
      default:
        throw runtimeError(`Unsupported arithmetic operator: ${expression.operator}`, expression.location);
    }
  }

  evaluateEqualityExpression(expression) {
    const left = this.evaluateExpression(expression.left);
    const right = this.evaluateExpression(expression.right);

    switch (expression.operator) {
      case '=':
      case '==':
        return left === right;
      case '!=':
      case '<>':
        return left !== right;
      default:
        throw runtimeError(`Unsupported equality operator: ${expression.operator}`, expression.location);
    }
  }

  evaluateOrderingExpression(expression) {
    const left = this.evaluateExpression(expression.left);
    const right = this.evaluateExpression(expression.right);

    if (typeof left !== typeof right || !isComparableValue(left)) {
      throw runtimeError(`Operator ${expression.operator} requires comparable operands`, expression.location);
    }

    switch (expression.operator) {
      case '<':
        return left < right;
      case '<=':
        return left <= right;
      case '>':
        return left > right;
      case '>=':
        return left >= right;
      default:
        throw runtimeError(`Unsupported ordering operator: ${expression.operator}`, expression.location);
    }
  }

  resolveLabel(target, location) {
    const index = this.labelIndex.get(target);
    if (index === undefined) {
      throw runtimeError(`Unknown label: ${target}`, location);
    }
    return index;
  }

  nextRandom() {
    this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  randomIntegerInRange(min, max, location) {
    const lower = Math.trunc(min);
    const upper = Math.trunc(max);
    if (upper < lower) {
      throw runtimeError('RND range max must be greater than or equal to min', location);
    }
    const span = upper - lower + 1;
    return lower + Math.floor(this.nextRandom() * span);
  }
}

function coerceInputValue(raw) {
  const text = String(raw ?? '');
  if (!text.trim()) {
    return '';
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : text;
}

function loopContinues(current, end, step) {
  return step > 0 ? current <= end : current >= end;
}

function createArrayValue(size) {
  return {
    kind: 'array',
    elements: Array(size).fill(0),
  };
}

function buildLabelIndex(statements) {
  const labels = new Map();

  for (let index = 0; index < statements.length; index += 1) {
    const statement = statements[index];
    const statementLabels = statement?.type === 'LabelStatement'
      ? statement.labels
      : statement?.labels;

    if (!Array.isArray(statementLabels)) {
      continue;
    }

    for (const label of statementLabels) {
      if (labels.has(label.name)) {
        throw runtimeError(`Duplicate label: ${label.name}`, label.location);
      }
      labels.set(label.name, index);
    }
  }

  return labels;
}

class Environment {
  constructor(parent = null) {
    this.parent = parent;
    this.bindings = new Map();
  }

  declare(name, value, location) {
    if (this.bindings.has(name)) {
      throw runtimeError(`Variable already declared: ${name}`, location);
    }
    this.bindings.set(name, value);
  }

  assign(name, value, location) {
    const scope = this.resolveScope(name);
    if (!scope) {
      throw runtimeError(`Unknown variable: ${name}`, location);
    }
    scope.bindings.set(name, value);
  }

  get(name) {
    const scope = this.resolveScope(name);
    if (!scope) {
      return '';
    }
    return scope.bindings.get(name);
  }

  setImplicit(name, value) {
    const scope = this.resolveScope(name) ?? this;
    scope.bindings.set(name, value);
  }

  resolveScope(name) {
    if (this.bindings.has(name)) {
      return this;
    }
    return this.parent?.resolveScope(name) ?? null;
  }
}

function isComparableValue(value) {
  return (typeof value === 'number' && Number.isFinite(value)) || typeof value === 'string';
}

function isArrayValue(value) {
  return value !== null
    && typeof value === 'object'
    && value.kind === 'array'
    && Array.isArray(value.elements);
}

function formatValue(value) {
  if (isArrayValue(value)) {
    return `[${value.elements.map(element => formatValue(element)).join(', ')}]`;
  }
  return String(value);
}

function signOf(value) {
  if (value === 0) {
    return 0;
  }
  return value > 0 ? 1 : -1;
}

function normalizeSeed(value) {
  return (Math.trunc(value * 1000) >>> 0) || 1;
}

function normalizeCharCode(value) {
  return Math.trunc(value) & 0xffff;
}

function truncateTowardZero(value) {
  return value < 0 ? Math.ceil(value) : Math.floor(value);
}

function runtimeError(message, location) {
  const suffix = location ? ` at ${location.line}:${location.column}` : '';
  const error = new Error(`${message}${suffix}`);
  error.name = 'RuntimeError';
  if (location) {
    error.line = location.line;
    error.column = location.column;
  }
  return error;
}

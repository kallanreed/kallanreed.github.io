export function interpret(ast, host = {}) {
  const runtime = new InterpreterRuntime(host);
  return runtime.run(ast);
}

class InterpreterRuntime {
  constructor(host) {
    this.host = {
      print: host.print ?? (() => {}),
      input: host.input ?? (async () => ''),
    };
    this.variables = new Map();
  }

  async run(ast) {
    if (!ast || ast.type !== 'Program' || !Array.isArray(ast.body)) {
      throw runtimeError('Expected Program node', ast?.location);
    }

    for (const statement of ast.body) {
      await this.executeStatement(statement);
    }
  }

  async executeStatement(statement) {
    switch (statement?.type) {
      case 'PrintStatement':
        this.executePrintStatement(statement);
        return;
      case 'InputStatement':
        await this.executeInputStatement(statement);
        return;
      default:
        throw runtimeError(`Unsupported statement node: ${statement?.type ?? 'unknown'}`, statement?.location);
    }
  }

  executePrintStatement(statement) {
    const text = statement.arguments
      .map(argument => this.evaluateExpression(argument))
      .map(value => String(value))
      .join('');
    this.host.print(text);
  }

  async executeInputStatement(statement) {
    const promptValue = statement.prompt ? this.evaluateExpression(statement.prompt) : '';
    const raw = await this.host.input(String(promptValue));
    this.variables.set(statement.target.name, coerceInputValue(raw));
  }

  evaluateExpression(expression) {
    switch (expression?.type) {
      case 'NumberLiteral':
        return expression.value;
      case 'StringLiteral':
        return expression.value;
      case 'VariableReference':
        return this.variables.get(expression.name) ?? defaultValueForVariable(expression.name);
      default:
        throw runtimeError(`Unsupported expression node: ${expression?.type ?? 'unknown'}`, expression?.location);
    }
  }
}

function defaultValueForVariable(name) {
  return '';
}

function coerceInputValue(raw) {
  const text = String(raw ?? '');
  if (!text.trim()) {
    return '';
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : text;
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

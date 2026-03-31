import { parse } from './parser.mjs';
import { interpret } from './interpreter.mjs';

export async function executeSource(source, host = {}) {
  const runtimeHost = {
    print: host.print ?? (() => {}),
    input: host.input ?? (async () => ''),
  };

  const ast = parse(source ?? '');
  await interpret(ast, runtimeHost);
  return ast;
}

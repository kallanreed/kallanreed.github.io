# Kar-Basic Grammar

This document is the authoritative EBNF-style grammar for the current kar-basic language surface.

Whitespace notes:
- Newlines terminate statements.
- Indentation is allowed for readability but has no syntactic meaning.
- Keywords are case-insensitive at the lexer level and normalized to uppercase.

## Lexical Elements

```ebnf
identifier      = letter, { letter | digit | "_" } ;
label           = identifier, ":" ;

number          = digit, { digit }, [ ".", digit, { digit } ] ;
string          = '"', { character | '""' }, '"' ;
boolean         = "TRUE" | "FALSE" ;

letter          = "A"…"Z" ;
digit           = "0"…"9" ;
newline         = "\n" ;
```

## Program Structure

```ebnf
program         = { blank-line | statement-line }, EOF ;
blank-line      = newline ;

statement-line  = [ labels ], [ statement ], newline ;
labels          = label, { label } ;
```

## Statements

```ebnf
statement       = print-statement
                | input-statement
                | var-statement
                | dim-statement
                | assignment-statement
                | seed-statement
                | goto-statement
                | if-statement
                | while-statement
                | for-statement ;

print-statement = "PRINT", expression, { ",", expression } ;

input-statement = "INPUT", [ input-prompt ], identifier ;
input-prompt    = string | identifier ;

var-statement   = "VAR", identifier, "=", expression ;
dim-statement   = "DIM", identifier, "(", expression, ")" ;

assignment-statement
                = assignment-target, "=", expression ;
assignment-target
                = identifier
                | identifier, "(", expression, ")" ;

seed-statement  = "SEED", numeric-expression ;
goto-statement  = "GOTO", identifier ;

if-statement    = inline-if-statement | block-if-statement ;
inline-if-statement
                = "IF", expression, "THEN", statement ;
block-if-statement
                = "IF", expression, "THEN", newline,
                  statement-block,
                  { "ELSE", "IF", expression, "THEN", newline, statement-block },
                  [ "ELSE", newline, statement-block ],
                  "END", "IF" ;

while-statement = "WHILE", expression, newline,
                  statement-block,
                  "END", "WHILE" ;

for-statement   = "FOR", identifier, "=", numeric-expression,
                  "TO", numeric-expression,
                  [ "STEP", numeric-expression ],
                  newline,
                  statement-block,
                  "END", "FOR" ;

statement-block = { blank-line | statement-line }, terminator-lookahead ;
terminator-lookahead
                = "END"
                | "ELSE"
                | EOF ;
```

## Expressions

```ebnf
expression      = or-expression ;

or-expression   = and-expression, { "OR", and-expression } ;
and-expression  = not-expression, { "AND", not-expression } ;
not-expression  = [ "NOT" ], comparison-expression ;

comparison-expression
                = additive-expression,
                  { comparison-operator, additive-expression } ;
comparison-operator
                = "=" | "==" | "!=" | "<>" | "<" | "<=" | ">" | ">=" ;

additive-expression
                = multiplicative-expression,
                  { additive-operator, multiplicative-expression } ;
additive-operator
                = "+" | "-" ;

multiplicative-expression
                = unary-expression,
                  { multiplicative-operator, unary-expression } ;
multiplicative-operator
                = "*" | "/" | "DIV" | "MOD" ;

unary-expression
                = [ "+" | "-" ], unary-expression
                | prefix-builtin, unary-expression
                | primary-expression ;

primary-expression
                = number
                | string
                | boolean
                | variable-reference
                | indexed-reference
                | "(", expression, ")"
                | rnd-expression
                | "TIMER" ;

variable-reference
                = identifier ;

indexed-reference
                = identifier, "(", expression, ")" ;

rnd-expression  = "RND", [ expression, [ ",", expression ] ] ;
```

## Builtins

```ebnf
prefix-builtin  = "ABS"
                | "ASC"
                | "CHR"
                | "INT"
                | "LEN"
                | "MID"
                | "SIGN"
                | "STR"
                | "VAL" ;
```

## Semantic Notes

- `+` supports `number + number` and `string + string`.
- `indexed-reference` reads from arrays and strings.
- String indexing is read-only.
- `ASC` accepts a non-empty string and returns the codepoint of its first character.
- `MID text, start` returns the substring from `start` to the end of the string.
- `MID text, start, length` returns the 0-based substring beginning at `start` with `length` characters.
- `LEN` accepts strings and arrays.
- `STR` converts a value into its printable string form.
- `VAL` parses a numeric string into a number.
- `RND` supports zero-arg, one-arg, and two-arg forms:
  - `RND`
  - `RND max`
  - `RND min, max`

#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
BAS_DIR="$ROOT/bas"
DIST_DIR="$ROOT/dist"

mkdir -p "$DIST_DIR"

echo "Compiling bas to WASM with Emscripten..."

# Generate token.c from flex source if needed
if [ ! -f "$BAS_DIR/token.c" ]; then
  echo "Generating token.c from token.l..."
  flex -o "$BAS_DIR/token.c" "$BAS_DIR/token.l"
fi

# Source files (statement.c is #included by bas.c, not compiled separately)
SOURCES="$BAS_DIR/main.c $BAS_DIR/bas.c $BAS_DIR/auto.c $BAS_DIR/fs.c \
         $BAS_DIR/global.c $BAS_DIR/token.c $BAS_DIR/program.c \
         $BAS_DIR/str.c $BAS_DIR/value.c $BAS_DIR/var.c \
         $ROOT/src/bas-wasm-io.c"

emcc $SOURCES \
  -I "$BAS_DIR" \
  -o "$DIST_DIR/bas.js" \
  -D__EMSCRIPTEN_BUILD__ \
  -s WASM=1 \
  -s ASYNCIFY=1 \
  -s ASYNCIFY_IMPORTS='["bas_wasm_read_line"]' \
  -s EXPORTED_FUNCTIONS='["_main"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","FS","callMain"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s ENVIRONMENT=web \
  -s MODULARIZE=1 \
  -s EXPORT_NAME=createBasModule \
  -s NO_EXIT_RUNTIME=0 \
  --pre-js "$ROOT/src/io-bridge-pre.js" \
  -O2

echo "WASM build complete: $DIST_DIR/bas.js + $DIST_DIR/bas.wasm"

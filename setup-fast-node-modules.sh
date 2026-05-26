#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# Relocate node_modules to WSL's native Linux filesystem for fast startup.
#
# WHY: This project lives on /mnt/c (the Windows filesystem). Under WSL2,
# reading the many small files in node_modules across that boundary is very
# slow — slow enough that loading dependencies takes 20-200+ seconds, and the
# MCP server exceeds Claude Code's 30s startup timeout ("connection timed out").
#
# Installing node_modules on the Linux filesystem (ext4) and symlinking it back
# drops module-load time from minutes to ~1 second. The project source, dist,
# and .env all stay where they are — only node_modules moves.
#
# WHEN TO RUN: once after cloning, and AGAIN any time you run `npm install`
# (npm replaces the symlink with a real folder, re-introducing the slowness).
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT4_DIR="$HOME/.local/share/gmail-send-mcp"

echo "→ Installing dependencies on fast Linux storage: $EXT4_DIR"
mkdir -p "$EXT4_DIR"
cp "$PROJECT_DIR/package.json" "$EXT4_DIR/"
[ -f "$PROJECT_DIR/package-lock.json" ] && cp "$PROJECT_DIR/package-lock.json" "$EXT4_DIR/"
( cd "$EXT4_DIR" && npm install )

echo "→ Pointing node_modules at the fast copy"
if [ -e "$PROJECT_DIR/node_modules" ] && [ ! -L "$PROJECT_DIR/node_modules" ]; then
  BAK="$PROJECT_DIR/node_modules.old.$$"
  mv "$PROJECT_DIR/node_modules" "$BAK"
  ( rm -rf "$BAK" >/dev/null 2>&1 & )  # slow delete on /mnt/c — run in background
fi
ln -sfn "$EXT4_DIR/node_modules" "$PROJECT_DIR/node_modules"

echo "✓ node_modules -> $(readlink "$PROJECT_DIR/node_modules")"
echo "  Now rebuild:  npm run build"

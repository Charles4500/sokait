#!/usr/bin/env bash
# Assembles the Space from the committed source into $1 (default: a temp dir):
# the Dockerfile, start script and Space card here, plus agents/, voice/ and web/.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git -C "$here" rev-parse --show-toplevel)"
out="${1:-$(mktemp -d)}"
mkdir -p "$out"
git -C "$root" archive HEAD agents voice web | tar -x -C "$out"
cp "$here/Dockerfile" "$here/start.sh" "$here/README.md" "$out/"
echo "$out"

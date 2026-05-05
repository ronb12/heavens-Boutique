#!/usr/bin/env bash
# Resize App Store **6.5-inch display** screenshots to exact pixels Apple accepts.
#
# iPhone 15/16 Pro Max simulators often save **1290 × 2796** (or similar). App Store Connect
# only accepts: **1242 × 2688**, **1284 × 2778**, and the landscape swaps — see ASC “Learn more”.
#
# This script outputs **1284 × 2778** portrait PNGs (suffix `-asc1284.png`) next to each input.
#
# Usage:
#   ./scripts/fix-appstore-6-5-screenshot-size.sh ~/Desktop/*.png
#   ./scripts/fix-appstore-6-5-screenshot-size.sh --legacy ~/Desktop/*.png   # 1242 × 2688 instead
#
set -euo pipefail

MODE="1284"
if [[ "${1:-}" == "--legacy" ]]; then
  MODE="1242"
  shift
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 [--legacy] <screenshot.png> [more.png ...]" >&2
  exit 1
fi

for f in "$@"; do
  [[ -f "$f" ]] || { echo "Skip (not a file): $f" >&2; continue; }
  base=$(basename "$f")
  name="${base%.*}"
  dir=$(dirname "$f")
  if [[ "$MODE" == "1242" ]]; then
    # Portrait 1242 × 2688 — sips -z is height then width
    out="$dir/${name}-asc1242.png"
    sips -z 2688 1242 "$f" -o "$out" >/dev/null
    echo "$out (1242×2688)"
  else
    out="$dir/${name}-asc1284.png"
    sips -z 2778 1284 "$f" -o "$out" >/dev/null
    echo "$out (1284×2778)"
  fi
done

echo "Upload the *-asc*.png files to App Store Connect."

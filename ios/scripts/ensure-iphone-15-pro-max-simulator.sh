#!/usr/bin/env bash
# Creates an **iPhone 15 Pro Max** simulator if you don’t already have one (6.7" / App Store 6.5" class screenshots).
# Requires an installed iOS 18.x (or 17.x) simulator runtime from Xcode → Settings → Platforms.
#
set -euo pipefail

if xcrun simctl list devices available 2>/dev/null | grep -F "iPhone 15 Pro Max" | grep -qE '\([A-F0-9-]{36}\)'; then
  echo "iPhone 15 Pro Max simulator is already available:"
  xcrun simctl list devices available 2>/dev/null | grep -F "iPhone 15 Pro Max" || true
  exit 0
fi

for rid in \
  com.apple.CoreSimulator.SimRuntime.iOS-18-3 \
  com.apple.CoreSimulator.SimRuntime.iOS-18-2 \
  com.apple.CoreSimulator.SimRuntime.iOS-18-1 \
  com.apple.CoreSimulator.SimRuntime.iOS-18-0 \
  com.apple.CoreSimulator.SimRuntime.iOS-17-5 \
  com.apple.CoreSimulator.SimRuntime.iOS-17-4; do
  if xcrun simctl list runtimes 2>/dev/null | grep -q "$rid"; then
    xcrun simctl create "iPhone 15 Pro Max" "iPhone 15 Pro Max" "$rid"
    echo "Created iPhone 15 Pro Max using runtime $rid"
    xcrun simctl list devices available 2>/dev/null | grep -F "iPhone 15 Pro Max" || true
    exit 0
  fi
done

echo "Could not find an iOS 17/18 simulator runtime. Install one in Xcode → Settings → Platforms → iOS." >&2
exit 1

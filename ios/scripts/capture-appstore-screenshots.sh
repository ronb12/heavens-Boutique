#!/usr/bin/env bash
# Capture 5 App Store–style PNGs via UI tests (welcome/shop/home/profile/orders).
#
# For App Store Connect **6.5-inch display** screenshots, prefer **iPhone 15 Pro Max**.
# If it’s missing locally, run: `./scripts/ensure-iphone-15-pro-max-simulator.sh`
# (needs an iOS 17/18 simulator runtime from Xcode → Settings → Platforms).
#
# Usage:
#   ./scripts/capture-appstore-screenshots.sh
#   DESTINATION='platform=iOS Simulator,name=iPhone 15 Pro Max,OS=18.3' ./scripts/capture-appstore-screenshots.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$IOS_ROOT"

RESULT_DIR="${RESULT_DIR:-$IOS_ROOT/AppStoreScreenshotOutput}"
mkdir -p "$RESULT_DIR"
BUNDLE_PATH="$RESULT_DIR/HeavensBoutiqueScreenshots.xcresult"

# Prefer a 6.5"–class device; fall back to any Pro Max / Plus in your Xcode install.
if [[ -z "${DESTINATION:-}" ]]; then
  for name in "iPhone 15 Pro Max" "iPhone 16 Plus" "iPhone 14 Plus" "iPhone 11 Pro Max" "iPhone 16 Pro Max"; do
    if xcodebuild -project HeavensBoutique.xcodeproj -scheme HeavensBoutique -showdestinations 2>/dev/null | grep -q "$name"; then
      DESTINATION="platform=iOS Simulator,name=$name"
      break
    fi
  done
fi
if [[ -z "${DESTINATION:-}" ]]; then
  echo "No 6.5\"-class simulator found in -showdestinations." >&2
  echo "Run: ./scripts/ensure-iphone-15-pro-max-simulator.sh" >&2
  echo "Or set DESTINATION, e.g.:" >&2
  echo '  DESTINATION="platform=iOS Simulator,name=iPhone 17 Pro,OS=26.3" '"$0" >&2
  exit 1
fi

echo "Using destination: $DESTINATION"
echo "Result bundle: $BUNDLE_PATH"
echo ""

xcodebuild test \
  -project HeavensBoutique.xcodeproj \
  -scheme HeavensBoutique \
  -destination "$DESTINATION" \
  -only-testing:HeavensBoutiqueUITests/AppStoreScreenshotUITests/testCaptureAppStoreScreenshots_mainJourney \
  -resultBundlePath "$BUNDLE_PATH"

echo ""
echo "Done. Open the bundle in Xcode (double-click the .xcresult file), select the test, then open the **Attachments**"
echo "section and save **01_welcome_or_main** … **05_orders** as PNG for App Store Connect."
echo "Apple’s 6.5\" iPhone slot requires exact pixels (e.g. 1284×2778). Simulator PNGs are often 1290×2796 — run:"
echo "  ./scripts/fix-appstore-6-5-screenshot-size.sh <your-exported-pngs>"

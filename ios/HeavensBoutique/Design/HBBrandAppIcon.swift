import SwiftUI

/// Renders the boutique app artwork in-app. The `AppIcon` appiconset cannot be referenced with `Image("AppIcon")`;
/// this uses a duplicate `BrandAppIcon` imageset (same artwork as the store icon).
struct HBBrandAppIcon: View {
    var size: CGFloat = 88
    /// Approximates the iOS app-icon squircle (~22.37% of side).
    var cornerRadius: CGFloat? = nil
    var showShadow: Bool = true

    private var radius: CGFloat {
        if let cornerRadius { return cornerRadius }
        return size * 0.2237
    }

    var body: some View {
        Image("BrandAppIcon")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .shadow(
                color: showShadow ? HBColors.gold.opacity(0.32) : .clear,
                radius: showShadow ? 12 : 0,
                x: 0,
                y: showShadow ? 6 : 0
            )
            .accessibilityLabel("Heaven's Boutique")
    }
}

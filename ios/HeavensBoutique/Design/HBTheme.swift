import SwiftUI

/// Pink & Gold Boutique — luxury palette (spec)
enum HBColors {
    static let softPink = Color(hex: 0xF7D6E0)
    static let cream = Color(hex: 0xFFF8F2)
    static let gold = Color(hex: 0xD4AF37)
    static let rosePink = Color(hex: 0xE8A9B5)
    static let charcoal = Color(hex: 0x2B2B2B)
    static let mutedGray = Color(hex: 0x8A8A8A)
    static let goldLight = Color(hex: 0xF1E5AC)
}

enum HBShadow {
    static let cardRadius: CGFloat = 8
    static let cardOpacity: Double = 0.08
    static func card() -> some View {
        Color.black.opacity(cardOpacity)
            .blur(radius: cardRadius)
    }
}

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}

extension View {
    func hbCardStyle() -> some View {
        self
            .background(HBColors.cream)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .shadow(color: .black.opacity(HBShadow.cardOpacity), radius: HBShadow.cardRadius, x: 0, y: 4)
    }

    func hbScreenBackground() -> some View {
        self.background(HBColors.cream.ignoresSafeArea())
    }

    func hbAppearTransition(_ shown: Bool) -> some View {
        self
            .opacity(shown ? 1 : 0)
            .offset(y: shown ? 0 : 12)
            .animation(.easeOut(duration: 0.35), value: shown)
    }
}

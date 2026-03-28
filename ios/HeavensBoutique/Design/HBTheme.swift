import SwiftUI
import UIKit

extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: alpha
        )
    }
}

/// Pink & gold boutique palette — adapts to light / dark using the active `ColorScheme` (including app override).
enum HBColors {
    private static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { tc in
            let hex = tc.userInterfaceStyle == .dark ? dark : light
            return UIColor(hex: hex)
        })
    }

    static var cream: Color { adaptive(light: 0xFFF8F2, dark: 0x12100E) }
    /// List rows, cards on the main background.
    static var surface: Color { adaptive(light: 0xFFF8F2, dark: 0x1F1D1B) }
    static var charcoal: Color { adaptive(light: 0x2B2B2B, dark: 0xEAE3DC) }
    static var mutedGray: Color { adaptive(light: 0x8A8A8A, dark: 0x8C8680) }
    static var softPink: Color { adaptive(light: 0xEBC6D4, dark: 0xBC96A3) }
    static var rosePink: Color { adaptive(light: 0xDC9BA8, dark: 0xC68B9A) }
    static var gold: Color { adaptive(light: 0xD4AF37, dark: 0xE0C25A) }
    static var goldLight: Color { adaptive(light: 0xF1E5AC, dark: 0xC4B896) }

    /// Category / variant chips, incoming chat bubble, etc.
    static var chipIdleBackground: Color { adaptive(light: 0xFFFFFF, dark: 0x2E2B28) }

    static var heroGradientTop: Color { adaptive(light: 0xFFFFFF, dark: 0x2A2624) }

    static var glassDiscFill: Color {
        Color(UIColor { tc in
            if tc.userInterfaceStyle == .dark {
                return UIColor(red: 0.22, green: 0.20, blue: 0.19, alpha: 0.94)
            }
            return UIColor(white: 1, alpha: 0.92)
        })
    }

    static var gradientCardStroke: Color {
        Color(UIColor { tc in
            if tc.userInterfaceStyle == .dark {
                return UIColor(white: 1, alpha: 0.12)
            }
            return UIColor(white: 1, alpha: 0.5)
        })
    }

    static var bannerWatermark: Color {
        Color(UIColor { tc in
            if tc.userInterfaceStyle == .dark {
                return UIColor(white: 1, alpha: 0.12)
            }
            return UIColor(white: 1, alpha: 0.2)
        })
    }
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

private struct HBCardStyleModifier: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        let shadowOpacity = colorScheme == .dark ? 0.45 : HBShadow.cardOpacity
        content
            .background(HBColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .shadow(color: .black.opacity(shadowOpacity), radius: HBShadow.cardRadius, x: 0, y: 4)
    }
}

private struct HBScreenBackgroundModifier: ViewModifier {
    func body(content: Content) -> some View {
        content.background(HBColors.cream.ignoresSafeArea())
    }
}

extension View {
    func hbCardStyle() -> some View {
        modifier(HBCardStyleModifier())
    }

    func hbScreenBackground() -> some View {
        modifier(HBScreenBackgroundModifier())
    }

    func hbAppearTransition(_ shown: Bool) -> some View {
        self
            .opacity(shown ? 1 : 0)
            .offset(y: shown ? 0 : 12)
            .animation(.easeOut(duration: 0.35), value: shown)
    }
}

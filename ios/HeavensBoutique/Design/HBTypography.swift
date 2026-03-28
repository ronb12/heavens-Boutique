import SwiftUI
import UIKit

enum HBFont {
    /// Script-style wordmark (e.g. “Heaven’s Boutique”). Snell Roundhand when available on iOS.
    static func wordmark(_ size: CGFloat = 32) -> Font {
        let candidates = ["Snell Roundhand", "SnellRoundhand", "SnellRoundhand-Regular"]
        for name in candidates where UIFont(name: name, size: size) != nil {
            return Font.custom(name, size: size)
        }
        return .system(size: size, weight: .medium, design: .serif)
    }

    static func title(_ size: CGFloat = 28) -> Font {
        .system(size: size, weight: .semibold, design: .serif)
    }

    static func headline() -> Font {
        .system(size: 20, weight: .semibold, design: .serif)
    }

    static func body() -> Font {
        .system(size: 16, weight: .regular, design: .default)
    }

    static func caption() -> Font {
        .system(size: 13, weight: .regular, design: .default)
    }
}

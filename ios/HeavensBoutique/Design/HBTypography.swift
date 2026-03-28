import SwiftUI

enum HBFont {
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

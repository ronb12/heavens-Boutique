import SwiftUI

/// Stylized rose bloom (decorative) — gold or pink gradient petals.
private struct HBRoseBloom: View {
    enum Variant {
        case pink
        case gold
    }

    var variant: Variant
    var size: CGFloat

    private var petalGradient: LinearGradient {
        switch variant {
        case .pink:
            LinearGradient(
                colors: [HBColors.rosePink, HBColors.softPink.opacity(0.92)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .gold:
            LinearGradient(
                colors: [HBColors.goldLight, HBColors.gold],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    private var centerGradient: LinearGradient {
        switch variant {
        case .pink:
            LinearGradient(
                colors: [HBColors.rosePink.opacity(0.95), HBColors.softPink.opacity(0.75)],
                startPoint: .center,
                endPoint: .bottom
            )
        case .gold:
            LinearGradient(
                colors: [HBColors.gold.opacity(0.95), HBColors.goldLight.opacity(0.7)],
                startPoint: .center,
                endPoint: .bottom
            )
        }
    }

    var body: some View {
        let petalW = size * 0.38
        let petalH = size * 0.52
        let inner = size * 0.22

        ZStack {
            ForEach(0 ..< 6, id: \.self) { i in
                Ellipse()
                    .fill(petalGradient)
                    .frame(width: petalW, height: petalH)
                    .rotationEffect(.degrees(Double(i) * 60))
                    .offset(y: -size * 0.08)
            }
            Circle()
                .fill(centerGradient)
                .frame(width: inner, height: inner)
                .shadow(color: .black.opacity(0.12), radius: 1, x: 0, y: 1)
        }
        .frame(width: size, height: size)
        .shadow(color: variant == .gold ? HBColors.gold.opacity(0.25) : HBColors.rosePink.opacity(0.22), radius: 4, x: 0, y: 2)
    }
}

/// Single rose with a gentle sway / breathe animation (respects Reduce Motion).
private struct HBAnimatedRose: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var variant: HBRoseBloom.Variant
    var size: CGFloat
    /// Stagger motion vs. its pair (seconds).
    var phaseDelay: Double = 0

    var body: some View {
        Group {
            if reduceMotion {
                HBRoseBloom(variant: variant, size: size)
            } else {
                TimelineView(.animation(minimumInterval: 1.0 / 30)) { context in
                    let t = context.date.timeIntervalSinceReferenceDate + phaseDelay * 2.5
                    let wobble = sin(t * 1.12) * 7.5
                    let breathe = 0.93 + 0.07 * sin(t * 0.88 + 0.7)
                    let bob = sin(t * 0.95 + 0.35) * 1.4
                    HBRoseBloom(variant: variant, size: size)
                        .rotationEffect(.degrees(wobble))
                        .scaleEffect(breathe)
                        .offset(y: bob)
                }
            }
        }
        .accessibilityHidden(true)
    }
}

/// Pink and gold animated roses flanking the Heaven’s Boutique wordmark.
struct HBWordmarkWithRoses<Wordmark: View>: View {
    var roseSize: CGFloat = 26
    var spacing: CGFloat = 10
    /// Center the row (welcome); use `false` for leading-aligned headers (home).
    var centerInAvailableWidth: Bool = false
    @ViewBuilder var wordmark: () -> Wordmark

    var body: some View {
        HStack(alignment: .center, spacing: spacing) {
            HBAnimatedRose(variant: .pink, size: roseSize, phaseDelay: 0)
            wordmark()
            HBAnimatedRose(variant: .gold, size: roseSize, phaseDelay: 0.45)
        }
        .frame(maxWidth: .infinity, alignment: centerInAvailableWidth ? .center : .leading)
    }
}

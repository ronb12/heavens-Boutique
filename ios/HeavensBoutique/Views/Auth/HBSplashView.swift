import SwiftUI

/// Shown while `SessionViewModel` restores credentials before the main UI or welcome screen.
struct HBSplashView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var showMark = false
    @State private var showWordmark = false
    @State private var showFooter = false

    var body: some View {
        ZStack {
            AuthChromeBackground()

            VStack(spacing: 0) {
                Spacer()

                VStack(spacing: 22) {
                    HBBrandMonogram(size: 84)
                        .scaleEffect(showMark ? 1 : 0.88)
                        .opacity(showMark ? 1 : 0)

                    VStack(spacing: 12) {
                        Rectangle()
                            .fill(
                                LinearGradient(
                                    colors: [
                                        HBColors.gold.opacity(0),
                                        HBColors.gold.opacity(0.5),
                                        HBColors.gold.opacity(0),
                                    ],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(height: 1)
                            .frame(maxWidth: 188)
                            .opacity(showWordmark ? 1 : 0)

                        HBWordmarkWithRoses(roseSize: 28, spacing: 9, centerInAvailableWidth: true) {
                            Text("Heaven's Boutique")
                                .font(HBFont.wordmark(36))
                                .foregroundStyle(HBColors.charcoal)
                                .multilineTextAlignment(.center)
                                .minimumScaleFactor(0.78)
                                .lineLimit(2)
                        }
                        .offset(y: showWordmark ? 0 : 14)
                        .opacity(showWordmark ? 1 : 0)

                        Text("Curated luxury · Soft pink moments")
                            .font(HBFont.body())
                            .foregroundStyle(HBColors.mutedGray)
                            .multilineTextAlignment(.center)
                            .offset(y: showWordmark ? 0 : 10)
                            .opacity(showWordmark ? 1 : 0)
                    }
                }
                .padding(.horizontal, 32)

                Spacer()

                VStack(spacing: 14) {
                    HBSplashProgressBar()
                    Text("Opening your boutique…")
                        .font(HBFont.caption().weight(.medium))
                        .foregroundStyle(HBColors.mutedGray.opacity(0.9))
                        .tracking(0.35)
                }
                .padding(.bottom, 50)
                .opacity(showFooter ? 1 : 0)
                .offset(y: showFooter ? 0 : 14)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Heaven's Boutique, loading")
        .task { await runEntrance() }
    }

    private func runEntrance() async {
        if reduceMotion {
            withAnimation(.easeOut(duration: 0.35)) {
                showMark = true
                showWordmark = true
                showFooter = true
            }
            return
        }

        let spring = Animation.spring(response: 0.55, dampingFraction: 0.82)
        withAnimation(spring) { showMark = true }
        try? await Task.sleep(for: .milliseconds(100))
        withAnimation(.spring(response: 0.5, dampingFraction: 0.88)) { showWordmark = true }
        try? await Task.sleep(for: .milliseconds(95))
        withAnimation(.easeOut(duration: 0.42)) { showFooter = true }
    }
}

// MARK: - Linear progress bar

/// Fills smoothly while the app restores the session (no byte-level progress available).
private struct HBSplashProgressBar: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var progress: CGFloat = 0

    private let trackWidth: CGFloat = 228
    private let barHeight: CGFloat = 6

    var body: some View {
        ZStack(alignment: .leading) {
            Capsule()
                .fill(HBColors.gold.opacity(0.12))
                .frame(width: trackWidth, height: barHeight)
                .overlay {
                    Capsule()
                        .strokeBorder(HBColors.gold.opacity(0.28), lineWidth: 0.5)
                }

            Capsule()
                .fill(
                    LinearGradient(
                        colors: [
                            HBColors.goldLight.opacity(0.95),
                            HBColors.gold,
                            HBColors.gold.opacity(0.88),
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(width: max(barHeight * 1.25, trackWidth * progress), height: barHeight)
                .shadow(color: HBColors.gold.opacity(0.35), radius: 4, x: 0, y: 1)
        }
        .frame(width: trackWidth, height: barHeight)
        .clipShape(Capsule())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading")
        .accessibilityValue(reduceMotion ? "In progress" : "\(Int((progress * 100).rounded())) percent")
        .onAppear { runProgressAnimation() }
    }

    /// Eases toward ~88%, then gently oscillates 88–94% while restore may still be running.
    private func runProgressAnimation() {
        if reduceMotion {
            progress = 0.38
            return
        }
        progress = 0
        withAnimation(.easeInOut(duration: 2.35)) {
            progress = 0.88
        }
        Task {
            try? await Task.sleep(for: .milliseconds(2350))
            withAnimation(.easeInOut(duration: 1.65).repeatForever(autoreverses: true)) {
                progress = 0.94
            }
        }
    }
}

#Preview {
    HBSplashView()
}

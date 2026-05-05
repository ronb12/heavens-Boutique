import SwiftUI
import UIKit

// MARK: - Background

struct AuthChromeBackground: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            HBColors.cream

            if reduceMotion {
                staticPinkBlob
                staticGoldBlob
                staticRoseBlob
            } else {
                TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { context in
                    let t = context.date.timeIntervalSinceReferenceDate
                    ZStack {
                        animatedPinkBlob(t: t)
                        animatedGoldBlob(t: t)
                        animatedRoseBlob(t: t)
                    }
                }
            }

            LinearGradient(
                colors: [HBColors.goldLight.opacity(0.14), Color.clear, HBColors.softPink.opacity(0.06)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
        }
        .ignoresSafeArea()
    }

    private var staticPinkBlob: some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [HBColors.softPink.opacity(0.55), HBColors.softPink.opacity(0)],
                    center: .center,
                    startRadius: 20,
                    endRadius: 180
                )
            )
            .frame(width: 360, height: 360)
            .offset(x: -120, y: -280)
            .blur(radius: 8)
    }

    private var staticRoseBlob: some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [HBColors.rosePink.opacity(0.35), HBColors.rosePink.opacity(0)],
                    center: .center,
                    startRadius: 10,
                    endRadius: 140
                )
            )
            .frame(width: 280, height: 280)
            .offset(x: 140, y: 120)
            .blur(radius: 6)
    }

    private var staticGoldBlob: some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [HBColors.goldLight.opacity(0.38), HBColors.goldLight.opacity(0)],
                    center: .center,
                    startRadius: 14,
                    endRadius: 150
                )
            )
            .frame(width: 300, height: 300)
            .offset(x: 40, y: 200)
            .blur(radius: 14)
    }

    private func animatedPinkBlob(t: TimeInterval) -> some View {
        let dx = sin(t * 0.35) * 14
        let dy = cos(t * 0.28) * 12
        return Circle()
            .fill(
                RadialGradient(
                    colors: [HBColors.softPink.opacity(0.55), HBColors.softPink.opacity(0)],
                    center: .center,
                    startRadius: 20,
                    endRadius: 180
                )
            )
            .frame(width: 360, height: 360)
            .offset(x: -120 + dx, y: -280 + dy)
            .blur(radius: 8)
    }

    private func animatedGoldBlob(t: TimeInterval) -> some View {
        let dx = cos(t * 0.22) * 20
        let dy = sin(t * 0.27) * 14
        return Circle()
            .fill(
                RadialGradient(
                    colors: [HBColors.goldLight.opacity(0.38), HBColors.goldLight.opacity(0)],
                    center: .center,
                    startRadius: 14,
                    endRadius: 150
                )
            )
            .frame(width: 300, height: 300)
            .offset(x: 40 + dx, y: 200 + dy)
            .blur(radius: 14)
    }

    private func animatedRoseBlob(t: TimeInterval) -> some View {
        let dx = cos(t * 0.31) * 18
        let dy = sin(t * 0.26) * 16
        return Circle()
            .fill(
                RadialGradient(
                    colors: [HBColors.rosePink.opacity(0.35), HBColors.rosePink.opacity(0)],
                    center: .center,
                    startRadius: 10,
                    endRadius: 140
                )
            )
            .frame(width: 280, height: 280)
            .offset(x: 140 + dx, y: 120 + dy)
            .blur(radius: 6)
    }
}

// MARK: - Brand mark

struct HBBrandMonogram: View {
    var size: CGFloat = 72

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var breathe = false

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [HBColors.goldLight, HBColors.gold.opacity(0.85)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .shadow(color: HBColors.gold.opacity(0.35), radius: 12 + (breathe && !reduceMotion ? 4 : 0), x: 0, y: 6)

            sparklesIcon
        }
        .scaleEffect(breathe && !reduceMotion ? 1.045 : 1.0)
        .frame(width: size, height: size)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 2.6).repeatForever(autoreverses: true)) {
                breathe = true
            }
        }
    }

    @ViewBuilder
    private var sparklesIcon: some View {
        let icon = Image(systemName: "sparkles")
            .font(.system(size: size * 0.38, weight: .medium))
            .foregroundStyle(HBColors.charcoal.opacity(0.85))
        if reduceMotion {
            icon
        } else {
            icon.symbolEffect(.pulse, options: .repeating)
        }
    }
}

// MARK: - Form shell

struct HBAuthFormCard<Content: View>: View {
    @ViewBuilder let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(22)
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(HBColors.chipIdleBackground)
                    .shadow(color: .black.opacity(0.07), radius: 20, x: 0, y: 10)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .strokeBorder(
                        LinearGradient(
                            colors: [HBColors.softPink.opacity(0.9), HBColors.goldLight.opacity(0.5)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
    }
}

// MARK: - Fields

struct HBAuthTextField: View {
    let title: String
    let placeholder: String
    let icon: String
    @Binding var text: String
    var isSecure: Bool = false
    var keyboard: UIKeyboardType = .default
    var textContent: UITextContentType?
    var autocapitalization: TextInputAutocapitalization = .sentences

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(HBFont.caption().weight(.semibold))
                .foregroundStyle(HBColors.charcoal.opacity(0.65))
                .textCase(.uppercase)
                .tracking(0.6)

            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.body.weight(.medium))
                    .foregroundStyle(HBColors.gold)
                    .frame(width: 22, alignment: .center)

                Group {
                    if isSecure {
                        SecureField(placeholder, text: $text)
                            .textContentType(textContent ?? .password)
                            .textInputAutocapitalization(.never)
                    } else {
                        TextField(placeholder, text: $text)
                            .keyboardType(keyboard)
                            .textContentType(textContent)
                            .textInputAutocapitalization(autocapitalization)
                    }
                }
                .font(HBFont.body())
                .foregroundStyle(HBColors.charcoal)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(HBColors.cream.opacity(0.65))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(HBColors.softPink.opacity(0.55), lineWidth: 1)
            )
        }
    }
}

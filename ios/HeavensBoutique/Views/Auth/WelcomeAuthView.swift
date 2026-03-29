import SwiftUI

/// First screen for guests — shop first, or sign-in / register.
struct WelcomeAuthView: View {
    var onBrowseGuest: () -> Void
    var onSignIn: () -> Void
    var onCreateAccount: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var showLogo = false
    @State private var showCopy = false
    @State private var showCTA = false
    @State private var showFooter = false

    var body: some View {
        ZStack {
            AuthChromeBackground()

            VStack(spacing: 0) {
                Spacer(minLength: 12)

                VStack(spacing: 20) {
                    HBBrandAppIcon(size: 88)
                        .scaleEffect(showLogo ? 1 : 0.82)
                        .rotationEffect(.degrees(showLogo ? 0 : -6))
                        .opacity(showLogo ? 1 : 0)

                    VStack(spacing: 10) {
                        HBWordmarkWithRoses(roseSize: 32, spacing: 10, centerInAvailableWidth: true) {
                            Text("Heaven's Boutique")
                                .font(HBFont.wordmark(40))
                                .foregroundStyle(HBColors.charcoal)
                                .multilineTextAlignment(.center)
                                .minimumScaleFactor(0.75)
                                .lineLimit(2)
                        }

                        Text("Curated luxury.\nSoft pink moments.")
                            .font(HBFont.body())
                            .foregroundStyle(HBColors.mutedGray)
                            .multilineTextAlignment(.center)
                            .lineSpacing(4)
                            .padding(.top, 4)
                    }
                    .offset(y: showCopy ? 0 : 20)
                    .opacity(showCopy ? 1 : 0)
                }
                .padding(.horizontal, 28)

                Spacer()
                Spacer()

                VStack(spacing: 14) {
                    Button(action: onBrowseGuest) {
                        Text("Browse the boutique")
                            .font(.system(size: 17, weight: .semibold, design: .default))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 17)
                            .background(
                                LinearGradient(
                                    colors: [HBColors.gold, HBColors.gold.opacity(0.88)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .shadow(color: HBColors.gold.opacity(0.4), radius: 14, x: 0, y: 8)
                    }
                    .buttonStyle(HBPressScaleButtonStyle())
                    .accessibilityIdentifier("welcome_browse_guest")

                    Button(action: onSignIn) {
                        Text("Sign in")
                            .font(.system(size: 17, weight: .semibold, design: .default))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 17)
                            .background(HBColors.chipIdleBackground)
                            .foregroundStyle(HBColors.charcoal)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .strokeBorder(HBColors.gold.opacity(0.45), lineWidth: 1.5)
                            )
                    }
                    .buttonStyle(HBPressScaleButtonStyle())
                    .accessibilityIdentifier("welcome_sign_in")

                    Button(action: onCreateAccount) {
                        Text("Create an account")
                            .font(.system(size: 17, weight: .semibold, design: .default))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 17)
                            .background(HBColors.chipIdleBackground)
                            .foregroundStyle(HBColors.charcoal)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .strokeBorder(
                                        LinearGradient(
                                            colors: [HBColors.gold.opacity(0.7), HBColors.rosePink.opacity(0.5)],
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        ),
                                        lineWidth: 1.5
                                    )
                            )
                    }
                    .buttonStyle(HBPressScaleButtonStyle())
                    .accessibilityIdentifier("welcome_create_account")

                    Text("Shop first — you can sign in or check out as a guest when you’re ready.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray.opacity(0.95))
                        .multilineTextAlignment(.center)
                        .padding(.top, 4)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 12)
                .offset(y: showCTA ? 0 : 28)
                .opacity(showCTA ? 1 : 0)

                Text("Exclusive drops & styling in Messages")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray.opacity(0.9))
                    .padding(.bottom, 28)
                    .opacity(showFooter ? 1 : 0)
                    .offset(y: showFooter ? 0 : 8)
            }
        }
        .task {
            await runEntrance()
        }
    }

    private func runEntrance() async {
        let spring = Animation.spring(response: 0.52, dampingFraction: 0.82)
        let springSoft = Animation.spring(response: 0.48, dampingFraction: 0.86)
        let quick = Animation.spring(response: 0.42, dampingFraction: 0.88)

        if reduceMotion {
            withAnimation(.easeOut(duration: 0.35)) {
                showLogo = true
                showCopy = true
                showCTA = true
                showFooter = true
            }
            return
        }

        withAnimation(spring) { showLogo = true }
        try? await Task.sleep(for: .milliseconds(95))
        withAnimation(springSoft) { showCopy = true }
        try? await Task.sleep(for: .milliseconds(110))
        withAnimation(quick) { showCTA = true }
        try? await Task.sleep(for: .milliseconds(85))
        withAnimation(.easeOut(duration: 0.45)) { showFooter = true }
    }
}

// MARK: - Button press feedback

private struct HBPressScaleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.18), value: configuration.isPressed)
    }
}

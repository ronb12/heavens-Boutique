import SwiftUI

// MARK: - On-light “foil” (gift card admin) — always dark text

/// Adaptive `HBColors.charcoal` is light in dark mode (for dark screens). These stay dark for always-light card surfaces.
enum HBGiftCardFoil {
    static let textPrimary = Color(white: 0.12)
    static let textSecondary = Color(white: 0.4)
    /// “ISSUE STORE CREDIT” / small caps
    static let labelCaps = Color(red: 0.48, green: 0.26, blue: 0.35)
    static let fieldText = textPrimary
    static let fieldPlaceholder = Color(white: 0.42)
    static let fieldTint = Color(red: 0.5, green: 0.38, blue: 0.2)
}

// MARK: - Customer checkout — pink · gold · black

struct GiftCardCheckoutChrome<Content: View>: View {
    @ViewBuilder let content: () -> Content

    private let blackRose = [
        Color(red: 0.10, green: 0.07, blue: 0.09),
        Color(red: 0.18, green: 0.11, blue: 0.15),
        Color(red: 0.05, green: 0.04, blue: 0.05),
    ]

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(
                    LinearGradient(colors: blackRose, startPoint: .topLeading, endPoint: .bottomTrailing)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(
                            RadialGradient(
                                colors: [
                                    Color(red: 0.92, green: 0.69, blue: 0.78).opacity(0.38),
                                    Color.clear,
                                ],
                                center: .init(x: 0.15, y: 0),
                                startRadius: 0,
                                endRadius: 220
                            )
                        )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(
                            LinearGradient(
                                colors: [
                                    HBColors.gold.opacity(0.75),
                                    Color(red: 0.92, green: 0.69, blue: 0.78).opacity(0.5),
                                    HBColors.gold.opacity(0.55),
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1.5
                        )
                )
                .shadow(color: Color.black.opacity(0.38), radius: 20, y: 12)

            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("HEAVEN'S BOUTIQUE")
                            .font(.system(size: 10, weight: .semibold))
                            .tracking(2.8)
                            .foregroundStyle(HBColors.goldLight.opacity(0.95))

                        Text("Gift card")
                            .font(HBFont.title(22))
                            .foregroundStyle(Color(red: 0.99, green: 0.95, blue: 0.98))

                        Text("Enter the code from your card or email. Applied when you pay — at least $0.50 must remain for processing.")
                            .font(HBFont.caption())
                            .foregroundStyle(Color(red: 0.96, green: 0.82, blue: 0.87).opacity(0.88))
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Spacer(minLength: 8)

                    HBBrandAppIcon(size: 50, showShadow: true)
                }

                Text("REDEMPTION CODE")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.8)
                    .foregroundStyle(HBColors.goldLight.opacity(0.9))
                    .padding(.top, 18)

                content()
                    .padding(.top, 8)
            }
            .padding(18)
        }
    }
}

// MARK: - Admin — certificate (blush + gold)

struct GiftCardIssuedCertificate: View {
    let code: String
    let balanceText: String

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color(red: 1.0, green: 0.98, blue: 0.99),
                            Color(red: 1.0, green: 0.93, blue: 0.96),
                            Color(red: 0.99, green: 0.88, blue: 0.93),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(
                            LinearGradient(
                                colors: [HBColors.gold.opacity(0.85), HBColors.softPink.opacity(0.6)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 2
                        )
                )
                .shadow(color: HBColors.rosePink.opacity(0.25), radius: 24, y: 12)

            VStack(spacing: 14) {
                Text("Heaven's Boutique")
                    .font(HBFont.wordmark(26))
                    .foregroundStyle(HBGiftCardFoil.textPrimary)

                Text("GIFT CARD")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(3.5)
                    .foregroundStyle(HBColors.rosePink.opacity(0.95))

                Text(balanceText)
                    .font(HBFont.title(34))
                    .foregroundStyle(Color(red: 0.17, green: 0.17, blue: 0.17))

                VStack(spacing: 8) {
                    Text("CARD NUMBER")
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(2)
                        .foregroundStyle(Color.black.opacity(0.38))

                    Text(code)
                        .font(.system(.body, design: .monospaced))
                        .fontWeight(.bold)
                        .foregroundStyle(HBGiftCardFoil.textPrimary)
                        .multilineTextAlignment(.center)
                        .textSelection(.enabled)
                }
                .padding(14)
                .frame(maxWidth: .infinity)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color.white.opacity(0.88))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .strokeBorder(
                                    HBColors.gold.opacity(0.45),
                                    style: StrokeStyle(lineWidth: 1, dash: [5, 4])
                                )
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .strokeBorder(HBColors.softPink.opacity(0.35), lineWidth: 1)
                        )
                )

                Text("Copy and send — this full code won't be shown again.")
                    .font(HBFont.caption())
                    .foregroundStyle(Color.black.opacity(0.48))
                    .multilineTextAlignment(.center)
            }
            .padding(22)
        }
    }
}

// MARK: - Admin — balance row (black & rose + gold chip)

struct GiftCardBalanceChipRow: View {
    let balanceText: String
    let active: Bool
    let subtitle: String

    var body: some View {
        ZStack(alignment: .topTrailing) {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color(red: 0.10, green: 0.08, blue: 0.10),
                            Color(red: 0.19, green: 0.12, blue: 0.16),
                            Color(red: 0.06, green: 0.05, blue: 0.06),
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(
                            RadialGradient(
                                colors: [
                                    Color(red: 0.92, green: 0.69, blue: 0.78).opacity(0.32),
                                    Color.clear,
                                ],
                                center: .init(x: 0, y: 0.5),
                                startRadius: 0,
                                endRadius: 180
                            )
                        )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(Color(red: 0.92, green: 0.69, blue: 0.78).opacity(0.22), lineWidth: 1)
                )

            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("REMAINING BALANCE")
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(2)
                        .foregroundStyle(HBColors.softPink.opacity(0.82))

                    Text(balanceText)
                        .font(HBFont.title(26))
                        .foregroundStyle(Color(red: 1.0, green: 0.96, blue: 0.98))

                    Text(subtitle)
                        .font(HBFont.caption())
                        .foregroundStyle(Color(red: 0.94, green: 0.78, blue: 0.86).opacity(0.88))
                }

                Spacer()

                Text(active ? "Active" : "Inactive")
                    .font(HBFont.caption().weight(.semibold))
                    .foregroundStyle(active ? HBColors.goldLight : Color.white.opacity(0.5))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(active ? HBColors.gold.opacity(0.28) : Color.white.opacity(0.1))
                    .overlay(
                        Capsule()
                            .strokeBorder(active ? HBColors.gold.opacity(0.45) : Color.clear, lineWidth: 1)
                    )
                    .clipShape(Capsule())
            }
            .padding(16)
            .padding(.trailing, 56)

            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color(red: 0.99, green: 0.93, blue: 0.96),
                            HBColors.gold,
                            Color(red: 0.35, green: 0.28, blue: 0.14),
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 72, height: 46)
                .overlay(
                    RoundedRectangle(cornerRadius: 5, style: .continuous)
                        .strokeBorder(HBColors.gold.opacity(0.45), lineWidth: 0.5)
                )
                .padding(14)
        }
    }
}

// MARK: - Admin — issue form (blush foil)

struct GiftCardIssueFoilPanel<Content: View>: View {
    let title: String
    let subtitle: String?
    @ViewBuilder let content: () -> Content

    init(title: String, subtitle: String? = nil, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.subtitle = subtitle
        self.content = content
    }

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color.white,
                            Color(red: 1.0, green: 0.96, blue: 0.98),
                            Color(red: 0.99, green: 0.93, blue: 0.96),
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(HBColors.gold.opacity(0.38), lineWidth: 1)
                )
                .shadow(color: Color.black.opacity(0.08), radius: 18, y: 8)

            VStack(alignment: .leading, spacing: 14) {
                Text("ISSUE STORE CREDIT")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(2.8)
                    .foregroundStyle(HBGiftCardFoil.labelCaps)

                Text(title)
                    .font(HBFont.headline())
                    .foregroundStyle(HBGiftCardFoil.textPrimary)

                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(HBFont.caption())
                        .foregroundStyle(HBGiftCardFoil.textSecondary)
                }

                content()
            }
            .padding(18)
        }
    }
}

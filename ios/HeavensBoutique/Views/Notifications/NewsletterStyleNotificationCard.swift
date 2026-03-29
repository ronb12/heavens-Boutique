import SwiftUI

/// Customer-facing promotion / “newsletter” card — shared by Notification Center and admin marketing composer preview.
struct NewsletterStyleNotificationCard: View {
    let title: String
    /// Main copy under the headline (maps to API `body`).
    let detailText: String?
    let badge: String?
    let imageURL: URL?
    /// Shown on the right in the footer row (e.g. relative time); `nil` hides that text.
    let footerTimeText: String?
    /// When true, uses unread gold accent (dot, border, shadow) like a new in-app notification.
    let showUnreadChrome: Bool

    var body: some View {
        let unread = showUnreadChrome
        let heroURL = imageURL

        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topLeading) {
                if let heroURL {
                    AsyncImage(url: heroURL) { phase in
                        switch phase {
                        case .success(let img):
                            img
                                .resizable()
                                .scaledToFill()
                        case .failure:
                            newsletterHeroPlaceholder(compact: false)
                        default:
                            newsletterHeroPlaceholder(compact: false)
                        }
                    }
                    .frame(height: 148)
                    .frame(maxWidth: .infinity)
                    .clipped()
                } else {
                    newsletterHeroPlaceholder(compact: true)
                        .frame(height: 56)
                }

                LinearGradient(
                    colors: [
                        Color.black.opacity(heroURL != nil ? 0.45 : 0),
                        Color.clear,
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: heroURL != nil ? 148 : 56)
                .allowsHitTesting(false)
            }
            .clipShape(
                UnevenRoundedRectangle(
                    topLeadingRadius: 20,
                    bottomLeadingRadius: 0,
                    bottomTrailingRadius: 0,
                    topTrailingRadius: 20,
                    style: .continuous
                )
            )

            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .center, spacing: 10) {
                    if let badge = badge?.trimmingCharacters(in: .whitespacesAndNewlines), !badge.isEmpty {
                        Text(badge.uppercased())
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .tracking(0.8)
                            .foregroundStyle(HBColors.gold)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(
                                Capsule()
                                    .fill(HBColors.gold.opacity(0.14))
                                    .overlay(
                                        Capsule()
                                            .strokeBorder(HBColors.gold.opacity(0.35), lineWidth: 1)
                                    )
                            )
                    }
                    Spacer(minLength: 0)
                    if unread {
                        Circle()
                            .fill(HBColors.gold)
                            .frame(width: 9, height: 9)
                            .accessibilityLabel("Unread")
                    }
                }

                Text(title)
                    .font(.system(size: 22, weight: .semibold, design: .serif))
                    .foregroundStyle(HBColors.charcoal)
                    .fixedSize(horizontal: false, vertical: true)

                if let b = detailText, !b.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(b)
                        .font(HBFont.body())
                        .foregroundStyle(HBColors.mutedGray)
                        .lineSpacing(5)
                        .fixedSize(horizontal: false, vertical: true)
                }

                HStack {
                    Rectangle()
                        .fill(
                            LinearGradient(
                                colors: [HBColors.gold, HBColors.rosePink.opacity(0.85)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: 48, height: 3)
                        .clipShape(Capsule())
                    Spacer()
                }
                .padding(.top, 4)

                HStack(spacing: 8) {
                    HBBrandAppIcon(size: 24, showShadow: false)
                        .accessibilityHidden(true)
                    Text("Heaven’s Boutique")
                        .font(HBFont.caption().weight(.medium))
                        .foregroundStyle(HBColors.mutedGray)
                    Spacer()
                    if let line = footerTimeText, !line.isEmpty {
                        Text(line)
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray.opacity(0.85))
                    }
                }
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(HBColors.surface)
        }
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            HBColors.gold.opacity(unread ? 0.45 : 0.2),
                            HBColors.softPink.opacity(0.35),
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: unread ? 1.25 : 0.75
                )
        )
        .shadow(color: Color.black.opacity(unread ? 0.1 : 0.05), radius: unread ? 14 : 8, x: 0, y: unread ? 6 : 4)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private func newsletterHeroPlaceholder(compact: Bool) -> some View {
        ZStack {
            LinearGradient(
                colors: [
                    HBColors.softPink.opacity(0.55),
                    HBColors.cream,
                    HBColors.goldLight.opacity(0.4),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            HBBrandAppIcon(size: compact ? 40 : 56, showShadow: false)
        }
    }
}

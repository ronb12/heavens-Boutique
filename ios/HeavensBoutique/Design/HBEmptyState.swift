import SwiftUI

struct HBEmptyState: View {
    let systemImage: String
    let title: String
    let message: String
    var retryTitle: String?
    var retry: (() -> Void)?

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: systemImage)
                .font(.system(size: 44, weight: .medium))
                .foregroundStyle(HBColors.gold.opacity(0.9))
                .accessibilityHidden(true)

            Text(title)
                .font(HBFont.headline())
                .foregroundStyle(HBColors.charcoal)
                .multilineTextAlignment(.center)

            Text(message)
                .font(HBFont.body())
                .foregroundStyle(HBColors.mutedGray)
                .multilineTextAlignment(.center)

            if let retryTitle, let retry {
                Button(action: retry) {
                    Text(retryTitle)
                        .font(HBFont.body().weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(HBColors.gold)
                        .foregroundStyle(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .padding(.top, 8)
                .accessibilityHint("Retries loading content")
            }
        }
        .padding(28)
        .frame(maxWidth: .infinity)
    }
}

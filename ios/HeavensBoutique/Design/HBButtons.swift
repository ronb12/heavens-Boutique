import SwiftUI

struct HBPrimaryButton: View {
    let title: String
    var isLoading: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .tint(.white)
                }
                Text(title)
                    .font(.system(size: 16, weight: .semibold, design: .default))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                LinearGradient(
                    colors: [HBColors.gold, HBColors.goldLight],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .disabled(isLoading)
    }
}

struct HBSecondaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(HBFont.body().weight(.medium))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(HBColors.softPink)
                .foregroundStyle(HBColors.charcoal)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
    }
}

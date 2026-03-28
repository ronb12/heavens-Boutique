import SwiftUI

struct ProductCardView: View {
    let product: ProductDTO

    private var displayPrice: String {
        let cents = product.salePriceCents ?? product.priceCents
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = Locale.current
        if let code = Locale.current.currency?.identifier {
            f.currencyCode = code
        } else {
            f.currencyCode = "USD"
        }
        return f.string(from: NSNumber(value: Double(cents) / 100)) ?? "$\(Double(cents) / 100)"
    }

    private var totalStock: Int {
        product.variants.reduce(0) { $0 + $1.stock }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ZStack(alignment: .topLeading) {
                image
                    .frame(height: 200)
                    .frame(maxWidth: .infinity)
                    .clipped()

                if product.salePriceCents != nil {
                    Text("Sale")
                        .font(HBFont.caption().weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(HBColors.softPink)
                        .foregroundStyle(HBColors.charcoal)
                        .clipShape(Capsule())
                        .padding(10)
                        .accessibilityHidden(true)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

            Text(product.name)
                .font(HBFont.headline())
                .foregroundStyle(HBColors.charcoal)
                .lineLimit(2)
                .multilineTextAlignment(.leading)

            HStack {
                Text(displayPrice)
                    .font(.system(size: 16, weight: .semibold, design: .default))
                    .foregroundStyle(HBColors.charcoal)
                if product.salePriceCents != nil {
                    Text(strikethroughPrice)
                        .strikethrough()
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                }
                Spacer()
                if totalStock > 0, totalStock < 6 {
                    Text("Only \(totalStock) left")
                        .font(HBFont.caption().weight(.medium))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(HBColors.gold.opacity(0.2))
                        .foregroundStyle(HBColors.charcoal)
                        .clipShape(Capsule())
                        .accessibilityLabel("Low stock, \(totalStock) remaining")
                }
            }
        }
        .hbCardStyle()
        .task {
            await ProductImagePrefetcher.shared.prefetch(urlStrings: product.images)
        }
    }

    private var strikethroughPrice: String {
        NumberFormatter.localizedString(from: NSNumber(value: Double(product.priceCents) / 100), number: .currency)
    }

    @ViewBuilder
    private var image: some View {
        if let urlStr = product.images.first, let url = URL(string: urlStr) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let img):
                    img.resizable().scaledToFill()
                case .failure:
                    HBColors.softPink.opacity(0.4)
                default:
                    HBColors.softPink.opacity(0.35)
                }
            }
        } else {
            HBColors.softPink.opacity(0.35)
        }
    }
}

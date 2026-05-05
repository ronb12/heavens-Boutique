import SwiftUI

private let productPriceFormatter: NumberFormatter = {
    let f = NumberFormatter()
    f.numberStyle = .currency
    f.locale = Locale.current
    f.currencyCode = Locale.current.currency?.identifier ?? "USD"
    return f
}()

struct ProductCardView: View {
    let product: ProductDTO

    private var displayPrice: String {
        let cents = product.salePriceCents ?? product.priceCents
        return productPriceFormatter.string(from: NSNumber(value: Double(cents) / 100))
            ?? "$\(Double(cents) / 100)"
    }

    private var totalStock: Int {
        product.variants.reduce(0) { $0 + $1.stock }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Slightly shorter image + inner inset so the tile reads clearly even if the parent grid is tight to the lead edge.
            ZStack(alignment: .topTrailing) {
                image
                    .frame(height: 148)
                    .frame(maxWidth: .infinity)
                    .clipped()
                    .padding(.horizontal, 4)

                if product.salePriceCents != nil {
                    Text("Sale")
                        .font(HBFont.caption().weight(.semibold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .background(HBColors.softPink)
                        .foregroundStyle(HBColors.charcoal)
                        .clipShape(Capsule())
                        .padding(8)
                        .accessibilityHidden(true)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

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
        .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
        .padding(6)
        .hbCardStyle()
        .accessibilityElement(children: .combine)
        .accessibilityLabel(cardAccessibilityLabel)
        .task {
            await ProductImagePrefetcher.shared.prefetch(urlStrings: product.images)
        }
    }

    private var cardAccessibilityLabel: String {
        var parts = [product.name, displayPrice]
        if product.salePriceCents != nil { parts.append("On sale") }
        if totalStock > 0, totalStock < 6 { parts.append("Only \(totalStock) left") }
        return parts.joined(separator: ", ")
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

import SwiftUI

struct ProductDetailView: View {
    let product: ProductDTO

    @EnvironmentObject private var cart: CartStore
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var session: SessionViewModel
    @EnvironmentObject private var appModel: AppModel
    @State private var selectedVariant: ProductVariantDTO?
    @State private var selectedQuantity: Int = 1
    @State private var wishlisted = false
    @State private var showCheckout = false
    @State private var isBackInStockSubscribed = false
    @State private var backInStockError: String?
    @State private var reviewsSummary: ProductReviewsSummaryDTO?
    @State private var reviews: [ProductReviewDTO] = []
    @State private var isLoadingReviews = false
    @State private var reviewsError: String?
    @State private var showWriteReview = false
    @State private var selectedImageIndex = 0

    private var displayImageURLs: [String] {
        let urls = product.images.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        return urls.isEmpty ? [""] : urls
    }

    /// Selling price (what the customer pays).
    private var effectivePriceCents: Int {
        product.salePriceCents ?? product.priceCents
    }

    /// Compare-at / list price when a sale is active.
    private var compareAtPriceCents: Int? {
        guard product.salePriceCents != nil else { return nil }
        return product.priceCents
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                imagePager
                thumbnailStrip
                productHeaderBlock

                if let desc = product.description?.trimmingCharacters(in: .whitespacesAndNewlines), !desc.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Description")
                            .font(HBFont.headline())
                            .foregroundStyle(HBColors.charcoal)
                        Text(desc)
                            .font(HBFont.body())
                            .foregroundStyle(HBColors.charcoal.opacity(0.85))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                sizeSection
                quantitySection

                if let v = selectedVariant, v.stock <= 0 {
                    backInStockSection(variant: v)
                }

                HStack(spacing: 12) {
                    HBPrimaryButton(title: "Add to bag", isLoading: false) {
                        addToCart()
                    }
                    .accessibilityHint("Adds selected size to your shopping bag")

                    Button {
                        Task { await toggleWishlist() }
                    } label: {
                        Image(systemName: wishlisted ? "heart.fill" : "heart")
                            .font(.title2)
                            .foregroundStyle(wishlisted ? HBColors.rosePink : HBColors.charcoal)
                            .padding(16)
                            .background(HBColors.softPink.opacity(0.5))
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .accessibilityLabel(wishlisted ? "Remove from wishlist" : "Add to wishlist")
                }

                if !product.variants.filter({ $0.stock > 0 }).isEmpty {
                    HBSecondaryButton(title: "Checkout") {
                        addToCart()
                        showCheckout = true
                    }
                    .accessibilityHint("Adds to bag then opens checkout")
                }

                reviewsSection
            }
            .padding(20)
        }
        .hbScreenBackground()
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await ProductImagePrefetcher.shared.prefetch(urlStrings: product.images)
        }
        .onAppear {
            selectedVariant = product.variants.first(where: { $0.stock > 0 }) ?? product.variants.first
            selectedImageIndex = 0
        }
        .onChange(of: selectedVariant?.id) { _, _ in
            isBackInStockSubscribed = false
            backInStockError = nil
        }
        .task {
            await loadWishlistState()
        }
        .task {
            await loadReviews()
        }
        .sheet(isPresented: $showCheckout) {
            NavigationStack {
                CheckoutView()
            }
        }
        .sheet(isPresented: $showWriteReview, onDismiss: { Task { await loadReviews() } }) {
            NavigationStack {
                ReviewComposerView(productId: product.id)
            }
        }
        .userActivity("com.heavensboutique.product") { activity in
            activity.title = product.name
            activity.isEligibleForSearch = true
            activity.isEligibleForPrediction = true
            activity.userInfo = ["productId": product.id]
            activity.keywords = [product.name, product.category]
        }
    }

    private var imagePager: some View {
        TabView(selection: $selectedImageIndex) {
            ForEach(Array(displayImageURLs.enumerated()), id: \.offset) { idx, urlStr in
                Group {
                    if let u = URL(string: urlStr), !urlStr.isEmpty {
                        AsyncImage(url: u) { phase in
                            switch phase {
                            case .success(let img):
                                img
                                    .resizable()
                                    .scaledToFit()
                                    .frame(maxWidth: .infinity)
                            case .failure:
                                HBColors.softPink.opacity(0.35)
                                    .overlay {
                                        Image(systemName: "photo")
                                            .font(.largeTitle)
                                            .foregroundStyle(HBColors.mutedGray)
                                    }
                            case .empty:
                                ProgressView()
                                    .tint(HBColors.gold)
                            @unknown default:
                                HBColors.softPink.opacity(0.35)
                            }
                        }
                    } else {
                        HBColors.softPink.opacity(0.35)
                            .overlay {
                                Image(systemName: "tshirt.fill")
                                    .font(.largeTitle)
                                    .foregroundStyle(HBColors.mutedGray.opacity(0.6))
                            }
                    }
                }
                .tag(idx)
            }
        }
        .frame(minHeight: 380)
        .tabViewStyle(.page(indexDisplayMode: displayImageURLs.filter { !$0.isEmpty }.count > 1 ? .always : .never))
        .background(HBColors.softPink.opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: .black.opacity(0.08), radius: 8, x: 0, y: 4)
        .accessibilityLabel("Product photos")
    }

    /// Thumbnail strip under the hero gallery (indexes match the main gallery).
    @ViewBuilder
    private var thumbnailStrip: some View {
        let indexed = Array(displayImageURLs.enumerated()).filter { !$0.element.isEmpty }
        if indexed.count <= 1 {
            EmptyView()
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(indexed, id: \.offset) { pair in
                        let idx = pair.offset
                        let urlStr = pair.element
                        Button {
                            selectedImageIndex = idx
                            HBFeedback.light()
                        } label: {
                            ZStack {
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(HBColors.surface)
                                    .frame(width: 72, height: 72)
                                    .overlay {
                                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                                            .strokeBorder(
                                                selectedImageIndex == idx ? HBColors.gold : Color.black.opacity(0.08),
                                                lineWidth: selectedImageIndex == idx ? 2 : 1
                                            )
                                    }
                                if let u = URL(string: urlStr) {
                                    AsyncImage(url: u) { phase in
                                        if case .success(let img) = phase {
                                            img.resizable().scaledToFill()
                                        } else {
                                            HBColors.softPink.opacity(0.25)
                                        }
                                    }
                                    .frame(width: 68, height: 68)
                                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                }
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Photo \(idx + 1) of \(indexed.count)")
                    }
                }
            }
        }
    }

    private var productHeaderBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    if !product.category.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Text(product.category.uppercased())
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(HBColors.mutedGray)
                            .tracking(0.8)
                    }
                    Text(product.name)
                        .font(HBFont.title(24))
                        .foregroundStyle(HBColors.charcoal)
                        .accessibilityAddTraits(.isHeader)
                    priceDisplay
                    if effectivePriceCents > 0, selectedQuantity > 0 {
                        Text("Line total: \(formatMoney(effectivePriceCents * selectedQuantity))")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                    }
                }
                Spacer(minLength: 8)
                if let webURL = Config.productPageURL(productId: product.id) {
                    ShareLink(
                        item: webURL,
                        subject: Text(product.name),
                        message: Text("Shop at Heaven’s Boutique")
                    ) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.title3)
                            .foregroundStyle(HBColors.gold)
                            .padding(10)
                            .background(HBColors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .accessibilityLabel("Share product link")
                } else if let appURL = URL(string: "heavensboutique://product/\(product.id)") {
                    ShareLink(item: appURL) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.title3)
                            .foregroundStyle(HBColors.gold)
                            .padding(10)
                            .background(HBColors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .accessibilityLabel("Share product")
                }
            }
        }
    }

    private var priceDisplay: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            // Put the price you pay first; compare-at (higher) second with strikethrough — otherwise
            // “~~$60~~ $20” reads as if $60 is the product price in left-to-right layouts.
            Text(formatMoney(effectivePriceCents))
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(HBColors.charcoal)
            if let compare = compareAtPriceCents, compare > effectivePriceCents {
                Text(formatMoney(compare))
                    .font(HBFont.body())
                    .strikethrough()
                    .foregroundStyle(HBColors.mutedGray)
            }
            if product.salePriceCents != nil {
                Text("Sale")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(HBColors.charcoal)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(HBColors.gold.opacity(0.35))
                    .clipShape(Capsule())
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityPriceLabel)
    }

    private var accessibilityPriceLabel: String {
        var parts: [String] = [formatMoney(effectivePriceCents)]
        if let c = compareAtPriceCents, c > effectivePriceCents {
            parts.append("was \(formatMoney(c))")
        }
        return parts.joined(separator: ", ")
    }

    private func formatMoney(_ cents: Int) -> String {
        NumberFormatter.localizedString(from: NSNumber(value: Double(cents) / 100), number: .currency)
    }

    private var sizeSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Size")
                .font(HBFont.headline())
                .foregroundStyle(HBColors.charcoal)
            FlowLayout(spacing: 8) {
                ForEach(product.variants) { v in
                    Button {
                        selectedVariant = v
                        HBFeedback.light()
                    } label: {
                        Text(v.size)
                            .font(HBFont.caption().weight(.medium))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(selectedVariant?.id == v.id ? HBColors.gold : HBColors.chipIdleBackground)
                            .foregroundStyle(selectedVariant?.id == v.id ? Color.white : HBColors.charcoal)
                            .clipShape(Capsule())
                            .opacity(v.stock <= 0 ? 0.4 : 1)
                    }
                    .disabled(v.stock <= 0)
                    .buttonStyle(.plain)
                    .animation(nil, value: selectedVariant?.id == v.id)
                    .accessibilityLabel("Size \(v.size)")
                    .accessibilityAddTraits(selectedVariant?.id == v.id ? .isSelected : [])
                }
            }
            if let v = selectedVariant {
                Text(v.stock <= 0 ? "Out of stock" : "\(v.stock) in stock")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
                if let sku = v.sku?.trimmingCharacters(in: .whitespacesAndNewlines), !sku.isEmpty {
                    Text("SKU: \(sku)")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                }
            }
        }
    }

    private var quantitySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Quantity")
                .font(HBFont.headline())
                .foregroundStyle(HBColors.charcoal)

            let maxQty = max(1, min(20, selectedVariant?.stock ?? 1))

            Stepper(value: $selectedQuantity, in: 1...maxQty) {
                HStack(spacing: 10) {
                    Text("\(selectedQuantity)")
                        .font(HBFont.body().weight(.semibold))
                        .foregroundStyle(HBColors.charcoal)
                    Spacer()
                    Text(maxQty == 1 ? "Max 1" : "Max \(maxQty)")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                }
            }
            .onChange(of: selectedVariant?.id) { _, _ in
                selectedQuantity = 1
            }
        }
    }

    private func backInStockSection(variant: ProductVariantDTO) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Out of stock")
                .font(HBFont.caption().weight(.semibold))
                .foregroundStyle(HBColors.charcoal)
            Text("Want a heads up when it’s available again?")
                .font(HBFont.caption())
                .foregroundStyle(HBColors.mutedGray)

            if let backInStockError {
                Text(backInStockError)
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.rosePink)
            }

            Button {
                Task { await toggleBackInStock(variantId: variant.id) }
            } label: {
                HStack {
                    Image(systemName: isBackInStockSubscribed ? "checkmark.circle.fill" : "bell.fill")
                    Text(isBackInStockSubscribed ? "Subscribed" : "Notify me when back in stock")
                }
                .font(HBFont.caption().weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(isBackInStockSubscribed ? HBColors.gold.opacity(0.15) : HBColors.surface)
                .foregroundStyle(HBColors.charcoal)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(HBColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func toggleBackInStock(variantId: String) async {
        guard session.isLoggedIn else {
            appModel.presentAuth(.login)
            return
        }
        backInStockError = nil
        do {
            if isBackInStockSubscribed {
                try await api.requestVoid("/back-in-stock?variantId=\(variantId)", method: "DELETE")
                isBackInStockSubscribed = false
            } else {
                try await api.requestVoid("/back-in-stock", method: "POST", jsonBody: ["variantId": variantId])
                isBackInStockSubscribed = true
            }
            HBFeedback.light()
        } catch {
            backInStockError = error.localizedDescription
            HBFeedback.warning()
        }
    }

    private func addToCart() {
        guard let v = selectedVariant, v.stock > 0 else { return }
        cart.add(product: product, variant: v, quantity: max(1, min(selectedQuantity, v.stock)))
        HBFeedback.success()
    }

    private func toggleWishlist() async {
        guard session.isLoggedIn else {
            appModel.presentAuth(.register)
            return
        }
        do {
            if wishlisted {
                try await api.requestVoid("/wishlist?productId=\(product.id)", method: "DELETE")
            } else {
                try await api.requestVoid("/wishlist?productId=\(product.id)", method: "POST")
            }
            wishlisted.toggle()
            HBFeedback.light()
        } catch {
            HBFeedback.warning()
        }
    }

    private func loadWishlistState() async {
        guard session.isLoggedIn else {
            wishlisted = false
            return
        }
        do {
            let r: ProductsResponse = try await api.request("/wishlist", method: "GET")
            wishlisted = r.products.contains { $0.id == product.id }
        } catch { }
    }

    private var reviewsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Reviews")
                    .font(HBFont.headline())
                    .foregroundStyle(HBColors.charcoal)
                Spacer()
                if isLoadingReviews {
                    ProgressView().tint(HBColors.gold).scaleEffect(0.8)
                } else {
                    Button("Refresh") { Task { await loadReviews() } }
                        .font(HBFont.caption().weight(.semibold))
                        .foregroundStyle(HBColors.gold)
                }
            }

            if let s = reviewsSummary {
                HStack(spacing: 10) {
                    RatingStars(rating: s.average)
                    Text(String(format: "%.1f", s.average))
                        .font(HBFont.caption().weight(.semibold))
                        .foregroundStyle(HBColors.charcoal)
                    Text("(\(s.count))")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                    Spacer()
                    Button("Write a review") {
                        guard session.isLoggedIn else {
                            appModel.presentAuth(.login)
                            return
                        }
                        showWriteReview = true
                        HBFeedback.light()
                    }
                    .font(HBFont.caption().weight(.semibold))
                    .foregroundStyle(HBColors.gold)
                }
            }

            if let reviewsError {
                Text(reviewsError)
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.rosePink)
            } else if reviews.isEmpty {
                Text("No reviews yet. Be the first to share how it fits and feels.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            } else {
                ForEach(reviews.prefix(6)) { r in
                    ReviewRow(review: r)
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(HBColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func loadReviews() async {
        isLoadingReviews = true
        reviewsError = nil
        defer { isLoadingReviews = false }
        do {
            let r: ProductReviewsResponse = try await api.request("/products/\(product.id)/reviews", method: "GET")
            reviewsSummary = r.summary
            reviews = r.reviews
        } catch {
            reviewsError = error.localizedDescription
        }
    }
}

private struct RatingStars: View {
    let rating: Double
    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<5, id: \.self) { i in
                Image(systemName: i < Int(round(rating)) ? "star.fill" : "star")
                    .font(.caption)
                    .foregroundStyle(HBColors.gold)
            }
        }
        .accessibilityLabel("\(String(format: "%.1f", rating)) out of 5 stars")
    }
}

private struct ReviewRow: View {
    let review: ProductReviewDTO
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                RatingStars(rating: Double(review.rating))
                Spacer()
                if review.verifiedPurchase {
                    Text("Verified")
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(HBColors.gold.opacity(0.15))
                        .foregroundStyle(HBColors.gold)
                        .clipShape(Capsule())
                }
            }
            if let t = review.title, !t.isEmpty {
                Text(t)
                    .font(HBFont.caption().weight(.semibold))
                    .foregroundStyle(HBColors.charcoal)
            }
            if let b = review.body, !b.isEmpty {
                Text(b)
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            }
        }
        .padding(.vertical, 8)
        .overlay(Divider().opacity(0.4), alignment: .bottom)
    }
}

private struct ReviewComposerView: View {
    let productId: String
    @EnvironmentObject private var api: APIClient
    @Environment(\.dismiss) private var dismiss

    @State private var rating: Int = 5
    @State private var title: String = ""
    @State private var reviewBody: String = ""
    @State private var isSaving = false
    @State private var error: String?

    var body: some View {
        Form {
            Section("Rating") {
                Picker("Rating", selection: $rating) {
                    ForEach(1...5, id: \.self) { n in
                        Text("\(n) star\(n == 1 ? "" : "s")").tag(n)
                    }
                }
            }
            Section("Title (optional)") {
                TextField("Short summary", text: $title)
            }
            Section("Review (optional)") {
                TextField("Share fit, fabric, and styling notes…", text: $reviewBody, axis: .vertical)
                    .lineLimit(3...8)
            }
            if let error {
                Section {
                    Text(error).font(HBFont.caption()).foregroundStyle(HBColors.rosePink)
                }
            }
            Section {
                Button(isSaving ? "Saving…" : "Submit review") {
                    Task { await submit() }
                }
                .disabled(isSaving)
            }
        }
        .navigationTitle("Write a review")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
    }

    private func submit() async {
        isSaving = true
        error = nil
        defer { isSaving = false }
        do {
            let _: ProductReviewResponse = try await api.request(
                "/products/\(productId)/reviews",
                method: "POST",
                jsonBody: [
                    "rating": rating,
                    "title": title.trimmingCharacters(in: .whitespacesAndNewlines),
                    "body": reviewBody.trimmingCharacters(in: .whitespacesAndNewlines),
                ]
            )
            HBFeedback.success()
            dismiss()
        } catch {
            HBFeedback.warning()
            self.error = error.localizedDescription
        }
    }
}

/// Simple wrapping flow for size chips
private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (i, pos) in result.positions.enumerated() {
            subviews[i].place(at: CGPoint(x: bounds.minX + pos.x, y: bounds.minY + pos.y), proposal: .unspecified)
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, positions: [CGPoint]) {
        let maxW = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowH: CGFloat = 0
        var positions: [CGPoint] = []

        for sub in subviews {
            let s = sub.sizeThatFits(.unspecified)
            if x + s.width > maxW, x > 0 {
                x = 0
                y += rowH + spacing
                rowH = 0
            }
            positions.append(CGPoint(x: x, y: y))
            rowH = max(rowH, s.height)
            x += s.width + spacing
        }
        return (CGSize(width: maxW, height: y + rowH), positions)
    }
}

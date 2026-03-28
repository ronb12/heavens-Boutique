import SwiftUI

struct ProductDetailView: View {
    let product: ProductDTO

    @EnvironmentObject private var cart: CartStore
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var session: SessionViewModel
    @EnvironmentObject private var appModel: AppModel
    @State private var selectedVariant: ProductVariantDTO?
    @State private var wishlisted = false
    @State private var showCheckout = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                imagePager
                Text(product.name)
                    .font(HBFont.title(24))
                    .foregroundStyle(HBColors.charcoal)
                    .accessibilityAddTraits(.isHeader)
                Text(product.description ?? "")
                    .font(HBFont.body())
                    .foregroundStyle(HBColors.mutedGray)

                sizeSection

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
        }
        .task {
            await loadWishlistState()
        }
        .sheet(isPresented: $showCheckout) {
            NavigationStack {
                CheckoutView()
            }
        }
    }

    private var imagePager: some View {
        TabView {
            ForEach(product.images.isEmpty ? [""] : product.images, id: \.self) { urlStr in
                if let u = URL(string: urlStr), !urlStr.isEmpty {
                    AsyncImage(url: u) { phase in
                        if case .success(let img) = phase {
                            img.resizable().scaledToFill()
                        } else {
                            HBColors.softPink.opacity(0.3)
                        }
                    }
                } else {
                    HBColors.softPink.opacity(0.35)
                }
            }
        }
        .frame(height: 360)
        .tabViewStyle(.page(indexDisplayMode: .always))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: .black.opacity(0.08), radius: 8, x: 0, y: 4)
        .accessibilityLabel("Product photos")
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
                    .accessibilityLabel("Size \(v.size)")
                    .accessibilityAddTraits(selectedVariant?.id == v.id ? .isSelected : [])
                }
            }
            if let v = selectedVariant {
                Text(v.stock <= 0 ? "Out of stock" : "\(v.stock) in stock")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            }
        }
    }

    private func addToCart() {
        guard let v = selectedVariant, v.stock > 0 else { return }
        cart.add(product: product, variant: v, quantity: 1)
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

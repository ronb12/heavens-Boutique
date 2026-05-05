import SwiftUI

struct CartView: View {
    @EnvironmentObject private var cart: CartStore
    @EnvironmentObject private var appModel: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var showCheckout = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if cart.lines.isEmpty {
                Spacer()
                HBEmptyState(
                    systemImage: "bag",
                    title: "Your bag is ready for something lovely",
                    message: "Browse the shop and tap Add to bag on pieces you adore.",
                    retryTitle: "Browse the shop",
                    retry: {
                        dismiss()
                        Task {
                            try? await Task.sleep(nanoseconds: 150_000_000)
                            appModel.openShopTab()
                        }
                    }
                )
                Spacer()
            } else {
                List {
                    ForEach(cart.lines) { line in
                        HStack(alignment: .top, spacing: 12) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(line.product.name)
                                    .font(HBFont.headline())
                                    .foregroundStyle(HBColors.charcoal)
                                Text("Size \(line.variant.size)")
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.mutedGray)
                                HStack(spacing: 16) {
                                    // `.borderless` is required in `List` rows or +/− (and other adjacent buttons) can
                                    // get the wrong hit target (e.g. minus adds).
                                    Button {
                                        HBFeedback.light()
                                        cart.adjustQuantity(variantId: line.variant.id, delta: -1)
                                    } label: {
                                        Image(systemName: "minus.circle.fill")
                                            .foregroundStyle(HBColors.gold)
                                    }
                                    .buttonStyle(.borderless)
                                    .contentShape(Circle())
                                    .accessibilityLabel("Decrease quantity")
                                    Text("\(line.quantity)")
                                        .font(.system(size: 16, weight: .medium, design: .default))
                                        .frame(minWidth: 24)
                                    Button {
                                        HBFeedback.light()
                                        cart.adjustQuantity(variantId: line.variant.id, delta: 1)
                                    } label: {
                                        Image(systemName: "plus.circle.fill")
                                            .foregroundStyle(HBColors.gold)
                                    }
                                    .buttonStyle(.borderless)
                                    .contentShape(Circle())
                                    .accessibilityLabel("Increase quantity")
                                }
                            }
                            Spacer(minLength: 8)
                            VStack(alignment: .trailing, spacing: 8) {
                                Button {
                                    HBFeedback.light()
                                    cart.removeVariant(id: line.variant.id)
                                } label: {
                                    Image(systemName: "trash")
                                        .font(.body)
                                        .foregroundStyle(HBColors.mutedGray)
                                }
                                .buttonStyle(.borderless)
                                .contentShape(Rectangle())
                                .accessibilityLabel("Remove from bag")
                                Text(formatCents((line.product.salePriceCents ?? line.product.priceCents) * line.quantity))
                                    .font(.system(size: 16, weight: .semibold, design: .default))
                                    .foregroundStyle(HBColors.charcoal)
                                    .accessibilityLabel("Line total \(formatCents((line.product.salePriceCents ?? line.product.priceCents) * line.quantity))")
                            }
                        }
                        .listRowBackground(HBColors.surface)
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button("Remove", role: .destructive) {
                                HBFeedback.light()
                                cart.removeVariant(id: line.variant.id)
                            }
                        }
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)

                VStack(spacing: 12) {
                    HStack {
                        Text("Subtotal")
                            .font(HBFont.body())
                            .foregroundStyle(HBColors.mutedGray)
                        Spacer()
                        Text(formatCents(cart.subtotalCents))
                            .font(HBFont.headline())
                            .foregroundStyle(HBColors.charcoal)
                    }
                    HBPrimaryButton(title: "Checkout", isLoading: false) {
                        showCheckout = true
                    }
                    .accessibilityHint("Opens secure payment")
                }
                .padding()
            }
        }
        .hbScreenBackground()
        .navigationTitle("Bag")
        .task {
            if !cart.lines.isEmpty {
                await cart.refreshLinePrices()
            }
        }
        .sheet(isPresented: $showCheckout) {
            NavigationStack {
                CheckoutView()
            }
        }
    }

    private func formatCents(_ cents: Int) -> String {
        NumberFormatter.localizedString(from: NSNumber(value: Double(cents) / 100), number: .currency)
    }
}

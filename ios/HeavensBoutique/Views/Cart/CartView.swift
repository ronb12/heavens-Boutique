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
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
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
                                    Button {
                                        HBFeedback.light()
                                        cart.setQuantity(line: line, qty: line.quantity - 1)
                                    } label: {
                                        Image(systemName: "minus.circle.fill")
                                            .foregroundStyle(HBColors.gold)
                                    }
                                    .accessibilityLabel("Decrease quantity")
                                    Text("\(line.quantity)")
                                        .font(.system(size: 16, weight: .medium, design: .default))
                                        .frame(minWidth: 24)
                                    Button {
                                        HBFeedback.light()
                                        cart.setQuantity(line: line, qty: line.quantity + 1)
                                    } label: {
                                        Image(systemName: "plus.circle.fill")
                                            .foregroundStyle(HBColors.gold)
                                    }
                                    .accessibilityLabel("Increase quantity")
                                }
                            }
                            Spacer()
                            Text(formatCents((line.product.salePriceCents ?? line.product.priceCents) * line.quantity))
                                .font(.system(size: 16, weight: .semibold, design: .default))
                                .foregroundStyle(HBColors.charcoal)
                                .accessibilityLabel("Line total \(formatCents((line.product.salePriceCents ?? line.product.priceCents) * line.quantity))")
                        }
                        .listRowBackground(HBColors.surface)
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

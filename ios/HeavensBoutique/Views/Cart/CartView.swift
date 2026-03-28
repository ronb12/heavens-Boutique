import SwiftUI

struct CartView: View {
    @EnvironmentObject private var cart: CartStore
    @State private var showCheckout = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if cart.lines.isEmpty {
                Spacer()
                Text("Your bag is quiet — add something lovely.")
                    .font(HBFont.body())
                    .foregroundStyle(HBColors.mutedGray)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
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
                                        cart.setQuantity(line: line, qty: line.quantity - 1)
                                    } label: {
                                        Image(systemName: "minus.circle.fill")
                                            .foregroundStyle(HBColors.gold)
                                    }
                                    Text("\(line.quantity)")
                                        .font(.system(size: 16, weight: .medium, design: .default))
                                        .frame(minWidth: 24)
                                    Button {
                                        cart.setQuantity(line: line, qty: line.quantity + 1)
                                    } label: {
                                        Image(systemName: "plus.circle.fill")
                                            .foregroundStyle(HBColors.gold)
                                    }
                                }
                            }
                            Spacer()
                            Text(formatCents((line.product.salePriceCents ?? line.product.priceCents) * line.quantity))
                                .font(.system(size: 16, weight: .semibold, design: .default))
                                .foregroundStyle(HBColors.charcoal)
                        }
                        .listRowBackground(HBColors.cream)
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

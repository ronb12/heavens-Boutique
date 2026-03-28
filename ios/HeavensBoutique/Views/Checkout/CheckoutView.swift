import SwiftUI
import StripePaymentSheet

struct CheckoutView: View {
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var cart: CartStore
    @Environment(\.dismiss) private var dismiss

    @State private var promoCode = ""
    @State private var isLoading = false
    @State private var error: String?
    @State private var paymentSheet: PaymentSheet?
    @State private var success = false

    var body: some View {
        ZStack {
            HBColors.cream.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Checkout")
                        .font(HBFont.title(28))
                        .foregroundStyle(HBColors.charcoal)

                    Text("Secure payment with Stripe — Apple Pay appears when available on your device.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)

                    TextField("Promo code (optional)", text: $promoCode)
                        .textInputAutocapitalization(.characters)
                        .padding()
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    HStack {
                        Text("Subtotal")
                        Spacer()
                        Text(formatCents(cart.subtotalCents))
                            .font(HBFont.headline())
                    }
                    .foregroundStyle(HBColors.charcoal)

                    if let error {
                        Text(error)
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.rosePink)
                    }

                    HBPrimaryButton(title: success ? "Paid" : "Pay securely", isLoading: isLoading) {
                        Task { await pay() }
                    }
                    .disabled(success || cart.lines.isEmpty)

                    if success {
                        Text("Thank you — your order is confirmed once payment completes.")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                        Button("Done") {
                            dismiss()
                        }
                        .padding(.top, 8)
                    }
                }
                .padding(24)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Close") { dismiss() }
            }
        }
    }

    private func formatCents(_ cents: Int) -> String {
        NumberFormatter.localizedString(from: NSNumber(value: Double(cents) / 100), number: .currency)
    }

    @MainActor
    private func pay() async {
        guard !cart.lines.isEmpty else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }

        let items = cart.lines.map { ["variantId": $0.variant.id, "quantity": $0.quantity] }
        var body: [String: Any] = ["items": items]
        let p = promoCode.trimmingCharacters(in: .whitespacesAndNewlines)
        if !p.isEmpty { body["promoCode"] = p }

        do {
            let r: PaymentIntentResponse = try await api.request("/payments/intent", method: "POST", jsonBody: body)
            var config = PaymentSheet.Configuration()
            config.merchantDisplayName = "Heaven's Boutique"
            // Add Apple Pay: set `config.applePay` with your merchant ID + enable the capability in Xcode.
            let sheet = PaymentSheet(paymentIntentClientSecret: r.clientSecret, configuration: config)
            paymentSheet = sheet

            PaymentPresenter.present(sheet) { result in
                Task { @MainActor in
                    switch result {
                    case .completed:
                        success = true
                        cart.clear()
                    case .canceled:
                        break
                    case .failed(let err):
                        error = err.localizedDescription
                    }
                }
            }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

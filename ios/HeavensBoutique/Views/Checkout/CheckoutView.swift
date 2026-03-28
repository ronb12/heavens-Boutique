import SwiftUI
import StripePaymentSheet

struct CheckoutView: View {
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var cart: CartStore
    @EnvironmentObject private var session: SessionViewModel
    @EnvironmentObject private var appModel: AppModel
    @Environment(\.dismiss) private var dismiss

    @State private var promoCode = ""
    @State private var guestEmail = ""
    @State private var isLoading = false
    @State private var error: String?
    @State private var paymentSheet: PaymentSheet?
    @State private var success = false

    private var isGuestCheckout: Bool { !session.isLoggedIn }

    var body: some View {
        ZStack {
            HBColors.cream.ignoresSafeArea()
            if success {
                successContent
            } else {
                checkoutForm
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Close") { dismiss() }
            }
        }
    }

    private var checkoutForm: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Checkout")
                    .font(HBFont.title(28))
                    .foregroundStyle(HBColors.charcoal)
                    .accessibilityAddTraits(.isHeader)

                Text("Secure payment with Stripe — Apple Pay appears when available on your device.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)

                if isGuestCheckout {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Account")
                            .font(HBFont.headline())
                            .foregroundStyle(HBColors.charcoal)
                        Text("Sign in to save orders and earn loyalty points, or continue as a guest with your email below.")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)

                        HStack(spacing: 10) {
                            Button {
                                appModel.presentAuth(.login)
                            } label: {
                                Text("Sign in")
                                    .font(HBFont.caption().weight(.semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .background(HBColors.chipIdleBackground)
                                    .foregroundStyle(HBColors.charcoal)
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                                            .strokeBorder(HBColors.gold.opacity(0.4), lineWidth: 1)
                                    )
                            }
                            Button {
                                appModel.presentAuth(.register)
                            } label: {
                                Text("Create account")
                                    .font(HBFont.caption().weight(.semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .background(HBColors.gold.opacity(0.2))
                                    .foregroundStyle(HBColors.charcoal)
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            }
                        }
                        .accessibilityElement(children: .contain)

                        TextField("Email (required for guest checkout)", text: $guestEmail)
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .padding()
                            .background(HBColors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .accessibilityHint("Used for your receipt and order updates")
                    }
                }

                TextField("Promo code (optional)", text: $promoCode)
                    .textInputAutocapitalization(.characters)
                    .padding()
                    .background(HBColors.surface)
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
                        .accessibilityLabel("Error: \(error)")
                }

                HBPrimaryButton(title: "Pay securely", isLoading: isLoading) {
                    Task { await pay() }
                }
                .disabled(cart.lines.isEmpty)
                .accessibilityHint("Opens Stripe payment sheet")
            }
            .padding(24)
        }
    }

    private var successContent: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 72, weight: .medium))
                .foregroundStyle(HBColors.gold)
                .accessibilityHidden(true)

            Text("Order confirmed")
                .font(HBFont.title(26))
                .foregroundStyle(HBColors.charcoal)
                .accessibilityAddTraits(.isHeader)

            Text(
                session.isLoggedIn
                    ? "Thank you — payment went through. We’ll send updates in Notifications when your order moves."
                    : "Thank you — payment went through. We’ll email your receipt; sign in anytime to track orders in the app."
            )
            .font(HBFont.body())
            .foregroundStyle(HBColors.mutedGray)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 8)

            HBPrimaryButton(title: "Done", isLoading: false) {
                dismiss()
            }
            .padding(.horizontal, 24)
            .padding(.top, 8)
            Spacer()
        }
        .padding(24)
    }

    private func formatCents(_ cents: Int) -> String {
        NumberFormatter.localizedString(from: NSNumber(value: Double(cents) / 100), number: .currency)
    }

    private func isValidEmail(_ s: String) -> Bool {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return false }
        return t.range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#, options: .regularExpression) != nil
    }

    @MainActor
    private func pay() async {
        guard !cart.lines.isEmpty else { return }
        if isGuestCheckout {
            guard isValidEmail(guestEmail) else {
                error = "Enter a valid email so we can send your receipt and order updates."
                HBFeedback.warning()
                return
            }
        }
        isLoading = true
        error = nil
        defer { isLoading = false }

        let items = cart.lines.map { ["variantId": $0.variant.id, "quantity": $0.quantity] }
        var body: [String: Any] = ["items": items]
        let p = promoCode.trimmingCharacters(in: .whitespacesAndNewlines)
        if !p.isEmpty { body["promoCode"] = p }
        if isGuestCheckout {
            body["email"] = guestEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        do {
            let r: PaymentIntentResponse = try await api.request("/payments/intent", method: "POST", jsonBody: body)
            var config = PaymentSheet.Configuration()
            config.merchantDisplayName = "Heaven's Boutique"
            let sheet = PaymentSheet(paymentIntentClientSecret: r.clientSecret, configuration: config)
            paymentSheet = sheet

            PaymentPresenter.present(sheet) { result in
                Task { @MainActor in
                    switch result {
                    case .completed:
                        success = true
                        HBFeedback.success()
                        cart.clear()
                    case .canceled:
                        break
                    case .failed(let err):
                        error = err.localizedDescription
                        HBFeedback.warning()
                    }
                }
            }
        } catch {
            self.error = error.localizedDescription
            HBFeedback.warning()
        }
    }
}

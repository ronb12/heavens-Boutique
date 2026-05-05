import SwiftUI
import StripePaymentSheet

struct CheckoutView: View {
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var cart: CartStore
    @EnvironmentObject private var session: SessionViewModel
    @EnvironmentObject private var appModel: AppModel
    @Environment(\.dismiss) private var dismiss

    @State private var promoCode = ""
    @State private var giftCardCode = ""
    @State private var guestEmail = ""
    @State private var shippingTier = "standard"

    // Logged-in: select from address book
    @State private var addresses: [AddressDTO] = []
    @State private var selectedAddressId: String?
    @State private var showAddressBook = false

    // Guest (or fallback): enter an address
    @State private var shipName = ""
    @State private var shipLine1 = ""
    @State private var shipLine2 = ""
    @State private var shipCity = ""
    @State private var shipState = ""
    @State private var shipPostal = ""
    @State private var shipCountry = "US"

    @State private var isLoading = false
    @State private var error: String?
    @State private var paymentSheet: PaymentSheet?
    @State private var success = false

    private var isGuestCheckout: Bool { !session.isLoggedIn }
    private var selectedAddress: AddressDTO? { addresses.first(where: { $0.id == selectedAddressId }) }
    private var availablePoints: Int { session.user?.loyaltyPoints ?? 0 }
    @State private var redeemPointsText: String = ""

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
        .sheet(isPresented: $showAddressBook, onDismiss: { Task { await loadAddresses() } }) {
            NavigationStack {
                AddressBookView()
            }
        }
        .task {
            if !cart.lines.isEmpty {
                await cart.refreshLinePrices()
            }
            if session.isLoggedIn {
                await loadAddresses()
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

                shippingSection

                TextField("Promo code (optional)", text: $promoCode)
                    .textInputAutocapitalization(.characters)
                    .padding()
                    .background(HBColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                GiftCardCheckoutChrome {
                    TextField("HB-XXXXXXXX", text: $giftCardCode)
                        .textInputAutocapitalization(.characters)
                        .font(.system(.body, design: .monospaced))
                        .tracking(1.2)
                        .padding(12)
                        .background(Color(red: 0.04, green: 0.03, blue: 0.04).opacity(0.92))
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .strokeBorder(
                                    LinearGradient(
                                        colors: [
                                            HBColors.softPink.opacity(0.55),
                                            HBColors.gold.opacity(0.5),
                                        ],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    ),
                                    lineWidth: 1
                                )
                        )
                        .foregroundStyle(Color(red: 0.99, green: 0.96, blue: 0.98))
                        .tint(HBColors.gold)
                        .accessibilityHint("Applied before card payment if the code is valid.")
                }

                if session.isLoggedIn {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Loyalty")
                            .font(HBFont.headline())
                            .foregroundStyle(HBColors.charcoal)
                        Text("You have \(availablePoints) points. Use up to 25% of your subtotal as a credit.")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                        TextField("Redeem points (optional)", text: $redeemPointsText)
                            .keyboardType(.numberPad)
                            .padding()
                            .background(HBColors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                }

                HStack {
                    Text("Subtotal (items)")
                    Spacer()
                    Text(formatCents(cart.subtotalCents))
                        .font(HBFont.headline())
                }
                .foregroundStyle(HBColors.charcoal)

                Text("Shipping, tax, and the final total are shown in the secure Stripe payment screen after you continue.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
                    .fixedSize(horizontal: false, vertical: true)

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

    private var shippingSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text("Shipping")
                    .font(HBFont.headline())
                    .foregroundStyle(HBColors.charcoal)
                Spacer()
                if session.isLoggedIn {
                    Button("Address book") {
                        showAddressBook = true
                    }
                    .font(HBFont.caption().weight(.semibold))
                    .foregroundStyle(HBColors.gold)
                }
            }

            // Address selection (logged-in) or address entry (guest)
            if session.isLoggedIn, !addresses.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Ship to")
                        .font(HBFont.caption().weight(.semibold))
                        .foregroundStyle(HBColors.charcoal)

                    Picker("Shipping address", selection: Binding(
                        get: { selectedAddressId ?? addresses.first?.id ?? "" },
                        set: { selectedAddressId = $0 }
                    )) {
                        ForEach(addresses) { a in
                            Text(addressPickerLabel(a)).tag(a.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .padding()
                    .background(HBColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    TextField("Full name (for shipping label)", text: $shipName)
                        .textContentType(.name)
                        .padding()
                        .background(HBColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    TextField("Street address *", text: $shipLine1)
                        .textContentType(.streetAddressLine1)
                        .padding()
                        .background(HBColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    TextField("Apt, suite, etc. (optional)", text: $shipLine2)
                        .textContentType(.streetAddressLine2)
                        .padding()
                        .background(HBColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    TextField("City *", text: $shipCity)
                        .textContentType(.addressCity)
                        .padding()
                        .background(HBColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    Picker("Country", selection: $shipCountry) {
                        ForEach(AddressRegionOptions.countryChoices(forSelectedCode: shipCountry), id: \.code) { item in
                            Text(item.name).tag(item.code)
                        }
                    }
                    .pickerStyle(.menu)
                    .padding()
                    .background(HBColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .font(HBFont.body())
                    .onChange(of: shipCountry) { _, new in
                        if new == "US" {
                            shipState = AddressRegionOptions.coerceUsStateCode(shipState)
                        }
                    }

                    HStack(spacing: 12) {
                        Group {
                            if AddressRegionOptions.normalizedCountryCode(shipCountry) == "US" {
                                Picker("State", selection: $shipState) {
                                    Text("Select state").tag("")
                                    ForEach(AddressRegionOptions.usStates, id: \.code) { s in
                                        Text(s.name).tag(s.code)
                                    }
                                }
                                .pickerStyle(.menu)
                                .padding()
                                .background(HBColors.surface)
                                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                                .font(HBFont.body())
                            } else {
                                TextField("State / region", text: $shipState)
                                    .textContentType(.addressState)
                                    .padding()
                                    .background(HBColors.surface)
                                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            }
                        }
                        .frame(maxWidth: .infinity)

                        TextField("ZIP *", text: $shipPostal)
                            .textContentType(.postalCode)
                            .keyboardType(.numbersAndPunctuation)
                            .padding()
                            .background(HBColors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Shipping speed")
                    .font(HBFont.caption().weight(.semibold))
                    .foregroundStyle(HBColors.charcoal)

                Picker("Shipping tier", selection: $shippingTier) {
                    Text("Standard").tag("standard")
                    Text("Express").tag("express")
                    Text("Priority").tag("priority")
                }
                .pickerStyle(.segmented)
            }
        }
    }

    private func addressPickerLabel(_ a: AddressDTO) -> String {
        let name = (a.label?.isEmpty == false ? a.label! : "Address")
        let detail = a.toShippingAddress.singleLine
        return "\(name) · \(detail)"
    }

    private func resolveShippingAddress() -> ShippingAddressDTO? {
        if session.isLoggedIn, let a = selectedAddress {
            return a.toShippingAddress
        }
        let line1 = shipLine1.trimmingCharacters(in: .whitespacesAndNewlines)
        let city = shipCity.trimmingCharacters(in: .whitespacesAndNewlines)
        let postal = shipPostal.trimmingCharacters(in: .whitespacesAndNewlines)
        if line1.isEmpty || city.isEmpty || postal.isEmpty { return nil }
        let cc = AddressRegionOptions.normalizedCountryCode(shipCountry)
        let stateOut: String? = {
            if cc == "US" {
                let s = AddressRegionOptions.coerceUsStateCode(shipState)
                return s.isEmpty ? nil : s
            }
            let t = shipState.trimmingCharacters(in: .whitespacesAndNewlines)
            return t.isEmpty ? nil : t
        }()

        return ShippingAddressDTO(
            name: shipName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : shipName.trimmingCharacters(in: .whitespacesAndNewlines),
            line1: line1,
            line2: shipLine2.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : shipLine2.trimmingCharacters(in: .whitespacesAndNewlines),
            city: city,
            state: stateOut,
            postal: postal,
            country: cc
        )
    }

    @MainActor
    private func loadAddresses() async {
        guard session.isLoggedIn else { return }
        do {
            let r: AddressesResponse = try await api.request("/users/addresses", method: "GET")
            addresses = r.addresses
            if selectedAddressId == nil {
                selectedAddressId = r.addresses.first(where: { $0.isDefault })?.id ?? r.addresses.first?.id
            }
        } catch {
            // Address book is optional; errors show when paying.
        }
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
        guard let ship = resolveShippingAddress() else {
            error = "Add a shipping address to continue."
            HBFeedback.warning()
            return
        }
        isLoading = true
        error = nil
        defer { isLoading = false }

        let items = cart.lines.map { ["variantId": $0.variant.id, "quantity": $0.quantity] }
        var body: [String: Any] = [
            "items": items,
            "shippingTier": shippingTier,
            "shippingAddress": [
                "name": ship.name ?? "",
                "line1": ship.line1,
                "line2": ship.line2 ?? "",
                "city": ship.city,
                "state": ship.state ?? "",
                "postal": ship.postal,
                "country": ship.country,
            ],
        ]
        let p = promoCode.trimmingCharacters(in: .whitespacesAndNewlines)
        if !p.isEmpty { body["promoCode"] = p }
        let gc = giftCardCode.trimmingCharacters(in: .whitespacesAndNewlines)
        if !gc.isEmpty { body["giftCardCode"] = gc }
        if isGuestCheckout {
            body["email"] = guestEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        } else {
            if let n = Int(redeemPointsText.trimmingCharacters(in: .whitespacesAndNewlines)), n > 0 {
                body["redeemPoints"] = n
            }
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

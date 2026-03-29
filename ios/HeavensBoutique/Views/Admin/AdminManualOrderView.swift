import SwiftUI

private struct ManualOrderLineDraft: Identifiable {
    let id = UUID()
    let productId: String
    let variantId: String
    let title: String
    var quantity: Int
    var unitPriceCents: Int
}

private enum ManualOrderPickSheet: Identifiable {
    case chooseProduct
    case chooseVariant(productId: String)

    var id: String {
        switch self {
        case .chooseProduct: return "pick-product"
        case .chooseVariant(let pid): return "pick-variant-\(pid)"
        }
    }
}

/// Admin-only: record an order for a registered customer or guest (in-store / phone / manual entry).
struct AdminManualOrderView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var api: APIClient

    let products: [ProductDTO]
    var onCreated: (() -> Void)?

    @State private var linkRegistered = true
    @State private var userId = ""
    @State private var guestEmail = ""
    @State private var customerName = ""
    @State private var customerPhone = ""
    @State private var shipLine1 = ""
    @State private var shipLine2 = ""
    @State private var shipCity = ""
    @State private var shipState = ""
    @State private var shipPostal = ""
    @State private var shipCountry = "US"
    @State private var status = "paid"
    @State private var lines: [ManualOrderLineDraft] = []
    @State private var discountDollars = "0"
    @State private var taxDollars = "0"
    @State private var shippingDollars = "0"
    @State private var decrementStock = true
    @State private var pickSheet: ManualOrderPickSheet?
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let statuses = ["pending", "paid", "shipped", "delivered", "cancelled", "refunded"]

    var body: some View {
        Form {
            Section {
                Toggle("Registered customer", isOn: $linkRegistered)
                if linkRegistered {
                    TextField("Customer user ID (UUID)", text: $userId)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } else {
                    TextField("Guest email", text: $guestEmail)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                }
                TextField("Customer name", text: $customerName)
                    .textContentType(.name)
                TextField("Phone", text: $customerPhone)
                    .keyboardType(.phonePad)
                    .textContentType(.telephoneNumber)
            } header: {
                Text("Who is this order for?")
            } footer: {
                Text(linkRegistered
                    ? "Name and phone are optional for registered customers but recommended for pickup slips and follow-up."
                    : "Name and phone are required for guest orders. Shipping address below is optional for in-store or pickup.")
                    .font(HBFont.caption())
            }

            Section {
                TextField("Street address", text: $shipLine1)
                    .textContentType(.streetAddressLine1)
                TextField("Apt, suite (optional)", text: $shipLine2)
                    .textContentType(.streetAddressLine2)
                TextField("City", text: $shipCity)
                    .textContentType(.addressCity)
                TextField("State / province", text: $shipState)
                    .textContentType(.addressState)
                TextField("ZIP / postal code", text: $shipPostal)
                    .textContentType(.postalCode)
                    .textInputAutocapitalization(.characters)
                TextField("Country (ISO, e.g. US)", text: $shipCountry)
                    .textInputAutocapitalization(.characters)
            } header: {
                Text("Shipping address")
            } footer: {
                Text("Leave all blank if there is no ship-to. If you enter any part, include line 1, city, and postal code. Country defaults to US when empty.")
                    .font(HBFont.caption())
            }

            Section {
                Picker("Status", selection: $status) {
                    ForEach(statuses, id: \.self) { s in
                        Text(s.replacingOccurrences(of: "_", with: " ").capitalized).tag(s)
                    }
                }
                Toggle("Reduce inventory (paid, shipped, or delivered only)", isOn: $decrementStock)
            }

            Section {
                ForEach($lines) { $line in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(line.title)
                            .font(HBFont.headline())
                            .foregroundStyle(HBColors.charcoal)
                        HStack(alignment: .firstTextBaseline) {
                            Stepper("Qty \(line.quantity)", value: $line.quantity, in: 1...999)
                            Spacer()
                            Text("Unit ¢")
                                .font(HBFont.caption())
                                .foregroundStyle(HBColors.mutedGray)
                            TextField("Cents", value: $line.unitPriceCents, format: .number)
                                .keyboardType(.numberPad)
                                .multilineTextAlignment(.trailing)
                                .frame(width: 72)
                        }
                    }
                }
                .onDelete { lines.remove(atOffsets: $0) }

                Button {
                    pickSheet = .chooseProduct
                } label: {
                    Label("Add line item", systemImage: "plus.circle.fill")
                }
            } header: {
                Text("Line items")
            }

            Section {
                TextField("Discount ($)", text: $discountDollars)
                    .keyboardType(.decimalPad)
                TextField("Tax ($)", text: $taxDollars)
                    .keyboardType(.decimalPad)
                TextField("Shipping ($)", text: $shippingDollars)
                    .keyboardType(.decimalPad)
                Text("Subtotal: \(Self.formatMoney(cents: subtotalCents))")
                Text("Total: \(Self.formatMoney(cents: computedTotalCents))")
                    .fontWeight(.semibold)
            } header: {
                Text("Totals")
            }

            if let err = errorMessage {
                Section {
                    Text(err)
                        .foregroundStyle(.red)
                        .font(HBFont.caption())
                }
            }

            Section {
                HBPrimaryButton(title: "Create order", isLoading: isSaving) {
                    Task { await submit() }
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }
        }
        .scrollContentBackground(.hidden)
        .background(HBColors.cream.ignoresSafeArea())
        .navigationTitle("Add order")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $pickSheet) { sheet in
            NavigationStack {
                switch sheet {
                case .chooseProduct:
                    List(products) { p in
                        Button {
                            pickSheet = .chooseVariant(productId: p.id)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(p.name)
                                    .foregroundStyle(HBColors.charcoal)
                                Text(p.category)
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.mutedGray)
                            }
                        }
                    }
                    .navigationTitle("Product")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") { pickSheet = nil }
                        }
                    }
                case .chooseVariant(let productId):
                    if let p = products.first(where: { $0.id == productId }) {
                        List(p.variants) { v in
                            Button {
                                addLine(product: p, variant: v)
                                pickSheet = nil
                            } label: {
                                HStack {
                                    Text(v.size)
                                        .foregroundStyle(HBColors.charcoal)
                                    Spacer()
                                    Text(Self.formatMoney(cents: p.salePriceCents ?? p.priceCents))
                                        .foregroundStyle(HBColors.gold)
                                }
                            }
                        }
                        .navigationTitle("Size")
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Back") { pickSheet = .chooseProduct }
                            }
                        }
                    } else {
                        Text("Product not found")
                            .navigationTitle("Size")
                    }
                }
            }
        }
    }

    private var subtotalCents: Int {
        lines.reduce(0) { $0 + $1.unitPriceCents * $1.quantity }
    }

    private var computedTotalCents: Int {
        let disc = parseDollarsToCents(discountDollars) ?? 0
        let tax = parseDollarsToCents(taxDollars) ?? 0
        let ship = parseDollarsToCents(shippingDollars) ?? 0
        return max(0, subtotalCents - disc + tax + ship)
    }

    private func addLine(product: ProductDTO, variant: ProductVariantDTO) {
        let cents = product.salePriceCents ?? product.priceCents
        let label = "\(product.name) · \(variant.size)"
        lines.append(ManualOrderLineDraft(
            productId: product.id,
            variantId: variant.id,
            title: label,
            quantity: 1,
            unitPriceCents: cents
        ))
    }

    private enum ShippingAddressPayload {
        case none
        case some([String: String])
        case invalid(String)
    }

    private func buildShippingAddressPayload() -> ShippingAddressPayload {
        let l1 = shipLine1.trimmingCharacters(in: .whitespacesAndNewlines)
        let l2 = shipLine2.trimmingCharacters(in: .whitespacesAndNewlines)
        let city = shipCity.trimmingCharacters(in: .whitespacesAndNewlines)
        let state = shipState.trimmingCharacters(in: .whitespacesAndNewlines)
        let postal = shipPostal.trimmingCharacters(in: .whitespacesAndNewlines)
        let countryRaw = shipCountry.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let country = countryRaw.isEmpty ? "US" : countryRaw

        // Do not treat default country alone as “has address” (avoids sending `{}` vs `{country:US}` confusion).
        let anyFilled = !l1.isEmpty || !l2.isEmpty || !city.isEmpty || !state.isEmpty || !postal.isEmpty
        if !anyFilled { return .none }

        let coreOk = !l1.isEmpty && !city.isEmpty && !postal.isEmpty
        if !coreOk {
            return .invalid("Shipping address: enter line 1, city, and postal code (or clear all address fields).")
        }

        var addr: [String: String] = [
            "line1": l1,
            "city": city,
            "postal": postal,
            "country": country,
        ]
        if !l2.isEmpty { addr["line2"] = l2 }
        if !state.isEmpty { addr["state"] = state }
        return .some(addr)
    }

    private func parseDollarsToCents(_ s: String) -> Int? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "$", with: "")
        if t.isEmpty { return 0 }
        guard let d = Double(t) else { return nil }
        return Int((d * 100).rounded())
    }

    private func submit() async {
        errorMessage = nil
        guard !lines.isEmpty else {
            errorMessage = "Add at least one line item."
            return
        }
        let uid = userId.trimmingCharacters(in: .whitespacesAndNewlines)
        let guest = guestEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if linkRegistered {
            guard !uid.isEmpty else {
                errorMessage = "Enter the customer’s user ID (from Customers)."
                return
            }
        } else {
            guard guest.contains("@") else {
                errorMessage = "Enter a valid guest email."
                return
            }
        }

        let nameTrim = customerName.trimmingCharacters(in: .whitespacesAndNewlines)
        let phoneTrim = customerPhone.trimmingCharacters(in: .whitespacesAndNewlines)
        if !linkRegistered {
            guard !nameTrim.isEmpty else {
                errorMessage = "Enter the customer’s name."
                return
            }
            guard !phoneTrim.isEmpty else {
                errorMessage = "Enter the customer’s phone number."
                return
            }
        }

        guard let discountCents = parseDollarsToCents(discountDollars),
              let taxCents = parseDollarsToCents(taxDollars),
              let shippingCents = parseDollarsToCents(shippingDollars) else {
            errorMessage = "Enter valid numbers for discount, tax, and shipping."
            return
        }

        let itemsPayload: [[String: Any]] = lines.map { line in
            [
                "productId": line.productId,
                "variantId": line.variantId,
                "quantity": line.quantity,
                "unitPriceCents": line.unitPriceCents,
            ]
        }

        var body: [String: Any] = [
            "status": status,
            "items": itemsPayload,
            "discountCents": discountCents,
            "taxCents": taxCents,
            "shippingCents": shippingCents,
            "decrementStock": decrementStock,
        ]
        if linkRegistered {
            body["userId"] = uid
        } else {
            body["guestEmail"] = guest
        }

        var shippingPayload: [String: String] = [:]
        switch buildShippingAddressPayload() {
        case .invalid(let message):
            errorMessage = message
            return
        case .none:
            break
        case .some(let addr):
            shippingPayload = addr
        }
        if !nameTrim.isEmpty { shippingPayload["name"] = nameTrim }
        if !phoneTrim.isEmpty { shippingPayload["phone"] = phoneTrim }
        if !shippingPayload.isEmpty {
            body["shippingAddress"] = shippingPayload
        }

        isSaving = true
        defer { isSaving = false }
        do {
            let _: AdminCreateOrderResponse = try await api.request("/admin/orders", method: "POST", jsonBody: body)
            HBFeedback.success()
            onCreated?()
            dismiss()
        } catch let e as APIError {
            errorMessage = e.localizedDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private static func formatMoney(cents: Int) -> String {
        NumberFormatter.localizedString(from: NSNumber(value: Double(cents) / 100), number: .currency)
    }
}

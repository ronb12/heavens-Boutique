import SwiftUI

/// Admin-only: create a customer with Shopify Admin–style sections (customer, security, marketing, default address).
struct AdminAddCustomerView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var api: APIClient

    var onCreated: (() -> Void)?

    // Customer
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var phone = ""

    @State private var password = ""
    @State private var marketingEmails = false

    // Default address (optional; saved when line1, city, postal, and country are filled)
    @State private var company = ""
    @State private var addressCountry = "US"
    @State private var addressLine1 = ""
    @State private var addressLine2 = ""
    @State private var addressCity = ""
    @State private var addressProvince = ""
    @State private var addressZip = ""

    @State private var isSaving = false
    @State private var errorMessage: String?

    private var trimmedEmail: String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private var canSave: Bool {
        !trimmedEmail.isEmpty
            && trimmedEmail.contains("@")
            && password.count >= 8
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                shopifySection(title: "Customer") {
                    VStack(alignment: .leading, spacing: 14) {
                        labeledField("First name", subtitle: "Legal or preferred first name") {
                            TextField("First name", text: $firstName)
                                .textContentType(.givenName)
                                .textInputAutocapitalization(.words)
                                .font(.body)
                        }
                        labeledField("Last name", subtitle: "Legal or preferred last name") {
                            TextField("Last name", text: $lastName)
                                .textContentType(.familyName)
                                .textInputAutocapitalization(.words)
                                .font(.body)
                        }
                        labeledField("Email", subtitle: "They’ll use this to sign in and for order updates") {
                            TextField("email@example.com", text: $email)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .font(.body)
                        }
                        labeledField("Phone", subtitle: "Optional — mobile or best contact number") {
                            TextField("Phone", text: $phone)
                                .textContentType(.telephoneNumber)
                                .keyboardType(.phonePad)
                                .font(.body)
                        }
                    }
                }

                shopifySection(title: "Security") {
                    labeledField("Temporary password", subtitle: "Minimum 8 characters. Ask them to change it after first sign-in.") {
                        SecureField("Password", text: $password)
                            .textContentType(.newPassword)
                            .font(.body)
                    }
                }

                shopifySection(title: "Marketing") {
                    Toggle(isOn: $marketingEmails) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Customer agreed to receive marketing emails")
                                .font(.body)
                            Text("You’re responsible for consent that matches your policy and local laws.")
                                .font(HBFont.caption())
                                .foregroundStyle(HBColors.mutedGray)
                        }
                    }
                    .tint(HBColors.gold)
                }

                shopifySection(title: "Default address") {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Optional. If you fill address, country, city, and ZIP/postal code are required to save it.")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                            .fixedSize(horizontal: false, vertical: true)

                        labeledField("Company", subtitle: "Optional — shown with the street line") {
                            TextField("Company", text: $company)
                                .textInputAutocapitalization(.words)
                                .font(.body)
                        }
                        labeledField("Country / region", subtitle: "ISO country code, e.g. US, CA, GB") {
                            TextField("US", text: $addressCountry)
                                .textInputAutocapitalization(.characters)
                                .autocorrectionDisabled()
                                .font(.body.monospaced())
                        }
                        labeledField("Address", subtitle: "Street and number") {
                            TextField("Address", text: $addressLine1)
                                .textContentType(.streetAddressLine1)
                                .textInputAutocapitalization(.words)
                                .font(.body)
                        }
                        labeledField("Apartment, suite, etc.", subtitle: "Optional") {
                            TextField("Apartment, suite, etc.", text: $addressLine2)
                                .textContentType(.streetAddressLine2)
                                .textInputAutocapitalization(.words)
                                .font(.body)
                        }
                        labeledField("City", subtitle: "") {
                            TextField("City", text: $addressCity)
                                .textContentType(.addressCity)
                                .textInputAutocapitalization(.words)
                                .font(.body)
                        }
                        labeledField("Province / state", subtitle: "Optional in some countries") {
                            TextField("Province", text: $addressProvince)
                                .textContentType(.addressState)
                                .textInputAutocapitalization(.words)
                                .font(.body)
                        }
                        labeledField("ZIP / postal code", subtitle: "") {
                            TextField("ZIP or postal code", text: $addressZip)
                                .textContentType(.postalCode)
                                .textInputAutocapitalization(.characters)
                                .autocorrectionDisabled()
                                .font(.body)
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 20)
            .padding(.bottom, 32)
        }
        .scrollContentBackground(.hidden)
        .background(ShopifyCustomerChrome.background)
        .navigationTitle("Add customer")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task { await createCustomer() }
                }
                .fontWeight(.semibold)
                .disabled(isSaving || !canSave)
            }
        }
        .overlay {
            if isSaving {
                ProgressView()
                    .scaleEffect(1.2)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.black.opacity(0.12))
            }
        }
        .alert("Something went wrong", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
                .textSelection(.enabled)
        }
    }

    // MARK: - Shopify chrome (matches AdminProductEditorView)

    private func shopifySection<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title.uppercased())
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(HBColors.mutedGray)
                .tracking(0.6)
            content()
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(ShopifyCustomerChrome.cardFill)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(Color.black.opacity(0.06), lineWidth: 1)
                )
        }
    }

    private func labeledField<Content: View>(_ title: String, subtitle: String, @ViewBuilder field: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(HBColors.charcoal)
            field()
                .padding(12)
                .background(ShopifyCustomerChrome.fieldFill)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(Color.black.opacity(0.06), lineWidth: 1)
                )
            if !subtitle.isEmpty {
                Text(subtitle)
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            }
        }
    }

    private func createCustomer() async {
        errorMessage = nil
        let em = trimmedEmail
        guard !em.isEmpty, em.contains("@") else {
            errorMessage = "Enter a valid email."
            return
        }
        guard password.count >= 8 else {
            errorMessage = "Password must be at least 8 characters."
            return
        }

        var json: [String: Any] = [
            "email": em,
            "password": password,
            "firstName": firstName.trimmingCharacters(in: .whitespacesAndNewlines),
            "lastName": lastName.trimmingCharacters(in: .whitespacesAndNewlines),
            "phone": phone.trimmingCharacters(in: .whitespacesAndNewlines),
        ]
        if marketingEmails {
            json["marketingEmails"] = true
        }

        let c1 = addressLine1.trimmingCharacters(in: .whitespacesAndNewlines)
        let city = addressCity.trimmingCharacters(in: .whitespacesAndNewlines)
        let zip = addressZip.trimmingCharacters(in: .whitespacesAndNewlines)
        let country = addressCountry.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if !c1.isEmpty || !city.isEmpty || !zip.isEmpty || !country.isEmpty {
            if c1.isEmpty || city.isEmpty || zip.isEmpty || country.isEmpty {
                errorMessage = "To save the default address, fill address, city, ZIP/postal code, and country."
                return
            }
            var addr: [String: Any] = [
                "line1": c1,
                "city": city,
                "postal": zip,
                "country": country,
            ]
            let comp = company.trimmingCharacters(in: .whitespacesAndNewlines)
            let l2 = addressLine2.trimmingCharacters(in: .whitespacesAndNewlines)
            let prov = addressProvince.trimmingCharacters(in: .whitespacesAndNewlines)
            if !comp.isEmpty {
                addr["company"] = comp
            }
            if !l2.isEmpty {
                addr["line2"] = l2
            }
            if !prov.isEmpty {
                addr["state"] = prov
            }
            json["defaultAddress"] = addr
        }

        isSaving = true
        defer { isSaving = false }
        do {
            let r: AdminCreateCustomerResponse = try await api.request(
                "/admin/customers",
                method: "POST",
                jsonBody: json
            )
            password = ""
            onCreated?()
            HBFeedback.success()
            try? await Task.sleep(for: .milliseconds(450))
            dismiss()
        } catch let e as APIError {
            errorMessage = e.localizedDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private enum ShopifyCustomerChrome {
    static var background: Color { HBColors.cream.opacity(0.45) }
    static var cardFill: Color { HBColors.surface }
    static var fieldFill: Color { Color(uiColor: .secondarySystemGroupedBackground) }
}

#Preview {
    NavigationStack {
        AdminAddCustomerView()
            .environmentObject(APIClient())
    }
}

import SwiftUI

struct AddressFormView: View {
    let existingAddress: AddressDTO?
    @EnvironmentObject private var api: APIClient
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var label = ""
    @State private var line1 = ""
    @State private var line2 = ""
    @State private var city = ""
    @State private var state = ""
    @State private var postal = ""
    @State private var country = "US"
    @State private var isDefault = false

    @State private var isSaving = false
    @State private var error: String?

    private var isEditing: Bool { existingAddress != nil }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HBTextField(placeholder: "Full name (for shipping label)", text: $name)
                        .textContentType(.name)

                    HBTextField(placeholder: "Label (e.g. Home, Work)", text: $label)

                    HBTextField(placeholder: "Street address *", text: $line1)
                        .textContentType(.streetAddressLine1)

                    HBTextField(placeholder: "Apt, suite, etc. (optional)", text: $line2)
                        .textContentType(.streetAddressLine2)

                    HBTextField(placeholder: "City *", text: $city)
                        .textContentType(.addressCity)

                    Picker("Country", selection: $country) {
                        ForEach(AddressRegionOptions.countryChoices(forSelectedCode: country), id: \.code) { item in
                            Text(item.name).tag(item.code)
                        }
                    }
                    .pickerStyle(.menu)
                    .padding()
                    .background(HBColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .font(HBFont.body())
                    .onChange(of: country) { _, new in
                        if new == "US" {
                            state = AddressRegionOptions.coerceUsStateCode(state)
                        }
                    }

                    HStack(spacing: 12) {
                        Group {
                            if AddressRegionOptions.normalizedCountryCode(country) == "US" {
                                Picker("State", selection: $state) {
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
                                HBTextField(placeholder: "State / region", text: $state)
                                    .textContentType(.addressState)
                            }
                        }
                        .frame(maxWidth: .infinity)

                        HBTextField(placeholder: "ZIP *", text: $postal)
                            .textContentType(.postalCode)
                            .keyboardType(.numbersAndPunctuation)
                            .frame(maxWidth: .infinity)
                    }
                    .padding(.vertical, 4)

                    Toggle("Set as default address", isOn: $isDefault)
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.charcoal)
                        .tint(HBColors.gold)

                    if let error {
                        Text(error)
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.rosePink)
                    }

                    HBPrimaryButton(title: isEditing ? "Save changes" : "Add address", isLoading: isSaving) {
                        Task { await save() }
                    }
                }
                .padding(24)
            }
            .hbScreenBackground()
            .navigationTitle(isEditing ? "Edit address" : "New address")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .onAppear { prefill() }
        }
    }

    private func prefill() {
        guard let addr = existingAddress else { return }
        name = addr.name ?? ""
        label = addr.label ?? ""
        line1 = addr.line1
        line2 = addr.line2 ?? ""
        city = addr.city
        postal = addr.postal
        country = AddressRegionOptions.normalizedCountryCode(addr.country)
        if country == "US" {
            state = AddressRegionOptions.coerceUsStateCode(addr.state)
        } else {
            state = addr.state ?? ""
        }
        isDefault = addr.isDefault
    }

    private func save() async {
        let l1 = line1.trimmingCharacters(in: .whitespacesAndNewlines)
        let cty = city.trimmingCharacters(in: .whitespacesAndNewlines)
        let pst = postal.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !l1.isEmpty else { error = "Street address is required."; return }
        guard !cty.isEmpty else { error = "City is required."; return }
        guard !pst.isEmpty else { error = "ZIP / postal code is required."; return }

        isSaving = true
        error = nil
        defer { isSaving = false }

        let cc = AddressRegionOptions.normalizedCountryCode(country)
        let stateOut: String = {
            if cc == "US" {
                return AddressRegionOptions.coerceUsStateCode(state)
            }
            return state.trimmingCharacters(in: .whitespacesAndNewlines)
        }()

        let body: [String: Any] = [
            "name": name.trimmingCharacters(in: .whitespacesAndNewlines),
            "label": label.trimmingCharacters(in: .whitespacesAndNewlines),
            "line1": l1,
            "line2": line2.trimmingCharacters(in: .whitespacesAndNewlines),
            "city": cty,
            "state": stateOut,
            "postal": pst,
            "country": cc,
            "isDefault": isDefault,
        ]

        do {
            if let addr = existingAddress {
                let _: AddressResponse = try await api.request("/users/addresses/\(addr.id)", method: "PATCH", jsonBody: body)
            } else {
                let _: AddressResponse = try await api.request("/users/addresses", method: "POST", jsonBody: body)
            }
            HBFeedback.success()
            dismiss()
        } catch {
            self.error = error.localizedDescription
            HBFeedback.warning()
        }
    }
}

private struct HBTextField: View {
    let placeholder: String
    @Binding var text: String

    var body: some View {
        TextField(placeholder, text: $text)
            .padding()
            .background(HBColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .font(HBFont.body())
    }
}

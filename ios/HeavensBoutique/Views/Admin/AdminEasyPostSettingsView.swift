import SwiftUI

/// Admin-only: EasyPost API key + origin address for shipping and return labels (stored in Postgres; Vercel env overrides when set).
struct AdminEasyPostSettingsView: View {
    @EnvironmentObject private var api: APIClient

    @State private var apiKeyDraft = ""
    @State private var hasApiKey = false
    @State private var envOverridesApiKey = false

    @State private var fromName = ""
    @State private var fromStreet1 = ""
    @State private var fromStreet2 = ""
    @State private var fromCity = ""
    @State private var fromState = ""
    @State private var fromZip = ""
    @State private var fromPhone = ""
    @State private var fromEmail = ""

    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var showError = false
    @State private var showSaved = false

    var body: some View {
        Form {
            if envOverridesApiKey {
                Section {
                    Text("A Vercel environment variable is overriding the EasyPost API key. Unset it there to use the key saved below.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.gold)
                }
            }

            Section("EasyPost API key") {
                SecureField(hasApiKey ? "New key (optional)" : "EZAK…", text: $apiKeyDraft)
                    .textContentType(.none)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)

                Text("Leave blank to keep the current key. This is never shown again after saving.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)

                if hasApiKey {
                    Button("Remove stored API key", role: .destructive) {
                        Task { await savePartial(apiKey: "") }
                    }
                    .disabled(isSaving || envOverridesApiKey)
                }
            }

            Section("Origin address (from)") {
                TextField("Name", text: $fromName)
                TextField("Street 1", text: $fromStreet1)
                TextField("Street 2 (optional)", text: $fromStreet2)
                TextField("City", text: $fromCity)
                TextField("State", text: $fromState)
                TextField("ZIP", text: $fromZip)
                TextField("Phone", text: $fromPhone)
                TextField("Email", text: $fromEmail)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)

                Text("These fields are used on shipping labels and prepaid return labels.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            }

            Section {
                Button("Save") { Task { await save() } }
                    .disabled(isSaving)
            }
        }
        .scrollContentBackground(.hidden)
        .hbScreenBackground()
        .navigationTitle("EasyPost settings")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .alert("Couldn’t update", isPresented: $showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .alert("Saved", isPresented: $showSaved) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("EasyPost settings were updated.")
        }
    }

    private func load() async {
        do {
            let r: AdminEasyPostSettingsResponse = try await api.request("/admin/easypost-settings", method: "GET")
            hasApiKey = r.hasApiKey
            envOverridesApiKey = r.envOverrides.apiKey
            apiKeyDraft = ""

            fromName = r.from.name
            fromStreet1 = r.from.street1
            fromStreet2 = r.from.street2
            fromCity = r.from.city
            fromState = r.from.state
            fromZip = r.from.zip
            fromPhone = r.from.phone
            fromEmail = r.from.email
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    private func savePartial(apiKey: String? = nil) async {
        var body: [String: Any] = [:]
        if let apiKey { body["apiKey"] = apiKey }
        await post(body: body)
    }

    private func save() async {
        var body: [String: Any] = [
            "fromName": fromName.trimmingCharacters(in: .whitespacesAndNewlines),
            "fromStreet1": fromStreet1.trimmingCharacters(in: .whitespacesAndNewlines),
            "fromStreet2": fromStreet2.trimmingCharacters(in: .whitespacesAndNewlines),
            "fromCity": fromCity.trimmingCharacters(in: .whitespacesAndNewlines),
            "fromState": fromState.trimmingCharacters(in: .whitespacesAndNewlines),
            "fromZip": fromZip.trimmingCharacters(in: .whitespacesAndNewlines),
            "fromPhone": fromPhone.trimmingCharacters(in: .whitespacesAndNewlines),
            "fromEmail": fromEmail.trimmingCharacters(in: .whitespacesAndNewlines),
        ]
        if !apiKeyDraft.isEmpty { body["apiKey"] = apiKeyDraft }
        await post(body: body)
    }

    private func post(body: [String: Any]) async {
        isSaving = true
        defer { isSaving = false }
        do {
            try await api.requestVoid("/admin/easypost-settings", method: "POST", jsonBody: body)
            apiKeyDraft = ""
            await load()
            showSaved = true
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }
}


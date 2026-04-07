import SwiftUI

/// Admin-only: Stripe publishable, secret, and webhook signing keys (stored in Postgres; Vercel env overrides when set).
struct AdminStripeSettingsView: View {
    @EnvironmentObject private var api: APIClient

    @State private var publishableKey = ""
    @State private var secretKeyDraft = ""
    @State private var webhookSecretDraft = ""
    @State private var hasSecretKey = false
    @State private var hasWebhookSecret = false
    @State private var envOverridesSecret = false
    @State private var envOverridesWebhook = false
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var showError = false
    @State private var showSaved = false

    var body: some View {
        Form {
            if envOverridesSecret || envOverridesWebhook {
                Section {
                    Text(
                        "Vercel environment variables override stored keys for the secret and webhook. Unset them there to use the keys saved below."
                    )
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.gold)
                }
            }

            Section("Publishable key") {
                TextField("pk_live_… or pk_test_…", text: $publishableKey)
                    .textContentType(.none)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
            }

            Section("Secret key") {
                SecureField(
                    hasSecretKey ? "New key (optional)" : "sk_live_… or sk_test_…",
                    text: $secretKeyDraft
                )
                .textContentType(.none)
                .autocorrectionDisabled()
                Text("Leave blank to keep the current secret. This is never shown again after saving.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
                if hasSecretKey {
                    Button("Remove stored secret key", role: .destructive) {
                        Task { await savePartial(secretKey: "") }
                    }
                    .disabled(isSaving || envOverridesSecret)
                }
            }

            Section("Webhook signing secret") {
                SecureField(
                    hasWebhookSecret ? "New secret (optional)" : "whsec_…",
                    text: $webhookSecretDraft
                )
                Text("From Stripe Dashboard → Developers → Webhooks → your endpoint signing secret.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
                if hasWebhookSecret {
                    Button("Remove stored webhook secret", role: .destructive) {
                        Task { await savePartial(webhookSecret: "") }
                    }
                    .disabled(isSaving || envOverridesWebhook)
                }
            }

            Section {
                Button("Save") {
                    Task { await save() }
                }
                .disabled(isSaving)
            }
        }
        .scrollContentBackground(.hidden)
        .hbScreenBackground()
        .navigationTitle("Stripe settings")
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
            Text("Stripe settings were updated.")
        }
    }

    private func load() async {
        do {
            let r: AdminStripeSettingsResponse = try await api.request("/admin/settings/stripe", method: "GET")
            publishableKey = r.publishableKey ?? ""
            hasSecretKey = r.hasSecretKey
            hasWebhookSecret = r.hasWebhookSecret
            envOverridesSecret = r.envOverridesSecret
            envOverridesWebhook = r.envOverridesWebhook
            secretKeyDraft = ""
            webhookSecretDraft = ""
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    private func savePartial(secretKey: String? = nil, webhookSecret: String? = nil) async {
        var body: [String: Any] = [:]
        if let secretKey { body["secretKey"] = secretKey }
        if let webhookSecret { body["webhookSecret"] = webhookSecret }
        await post(body: body)
    }

    private func save() async {
        var body: [String: Any] = [
            "publishableKey": publishableKey.trimmingCharacters(in: .whitespacesAndNewlines),
        ]
        if !secretKeyDraft.isEmpty { body["secretKey"] = secretKeyDraft }
        if !webhookSecretDraft.isEmpty { body["webhookSecret"] = webhookSecretDraft }
        await post(body: body)
    }

    private func post(body: [String: Any]) async {
        isSaving = true
        defer { isSaving = false }
        do {
            try await api.requestVoid("/admin/settings/stripe", method: "POST", jsonBody: body)
            secretKeyDraft = ""
            webhookSecretDraft = ""
            await load()
            showSaved = true
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }
}

import SwiftUI

struct AccountDetailsView: View {
    @EnvironmentObject private var session: SessionViewModel
    @EnvironmentObject private var api: APIClient
    @Environment(\.dismiss) private var dismiss

    @State private var fullName: String = ""
    @State private var phone: String = ""
    @State private var email: String = ""

    @State private var currentPassword: String = ""
    @State private var newPassword: String = ""

    @State private var isSaving = false
    @State private var message: String?
    @State private var error: String?

    var body: some View {
        Form {
            Section("Profile") {
                TextField("Full name", text: $fullName)
                TextField("Phone", text: $phone)
                    .keyboardType(.phonePad)
            }

            Section {
                TextField("Email", text: $email)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
            } header: {
                Text("Email")
            } footer: {
                Text("Changing your email updates receipts and order notifications.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            }

            Section {
                SecureField("Current password (if set)", text: $currentPassword)
                SecureField("New password (min 8 chars)", text: $newPassword)
            } header: {
                Text("Change password")
            } footer: {
                Text("If you signed up with Apple, you can set a password here.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            }

            if let message {
                Section {
                    Text(message).font(HBFont.caption()).foregroundStyle(HBColors.gold)
                }
            }
            if let error {
                Section {
                    Text(error).font(HBFont.caption()).foregroundStyle(HBColors.rosePink)
                }
            }

            Section {
                Button(isSaving ? "Saving…" : "Save changes") {
                    Task { await save() }
                }
                .disabled(isSaving)
            }
        }
        .navigationTitle("Account")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { prefill() }
    }

    private func prefill() {
        fullName = session.user?.fullName ?? ""
        phone = "" // phone not in UserDTO currently; allow user to enter/update
        email = session.user?.email ?? ""
    }

    private func save() async {
        isSaving = true
        message = nil
        error = nil
        defer { isSaving = false }

        var body: [String: Any] = [
            "fullName": fullName.trimmingCharacters(in: .whitespacesAndNewlines),
            "phone": phone.trimmingCharacters(in: .whitespacesAndNewlines),
            "email": email.trimmingCharacters(in: .whitespacesAndNewlines),
        ]

        let np = newPassword.trimmingCharacters(in: .whitespacesAndNewlines)
        if !np.isEmpty {
            body["newPassword"] = np
            let cp = currentPassword.trimmingCharacters(in: .whitespacesAndNewlines)
            if !cp.isEmpty { body["currentPassword"] = cp }
        }

        do {
            try await api.requestVoid("/users/me", method: "PATCH", jsonBody: body)
            await session.refreshProfile()
            currentPassword = ""
            newPassword = ""
            HBFeedback.success()
            message = "Saved."
        } catch {
            HBFeedback.warning()
            self.error = error.localizedDescription
        }
    }
}


import SwiftUI

/// Admin-only: create a registered customer account (same as self-serve signup; role is always customer).
struct AdminAddCustomerView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var api: APIClient

    var onCreated: (() -> Void)?

    @State private var email = ""
    @State private var password = ""
    @State private var fullName = ""
    @State private var phone = ""
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var createdSummary: String?

    var body: some View {
        Form {
            Section {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                SecureField("Temporary password (8+ characters)", text: $password)
                    .textContentType(.newPassword)
                TextField("Full name (optional)", text: $fullName)
                TextField("Phone (optional)", text: $phone)
                    .keyboardType(.phonePad)
            } header: {
                Text("New customer")
            } footer: {
                Text("They can sign in with this email and password. Ask them to change the password after first login.")
                    .font(HBFont.caption())
            }

            if let err = errorMessage {
                Section {
                    Text(err)
                        .foregroundStyle(.red)
                        .font(HBFont.caption())
                }
            }

            if let s = createdSummary {
                Section {
                    Text(s)
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.gold)
                }
            }

            Section {
                HBPrimaryButton(title: "Create customer", isLoading: isSaving) {
                    Task { await createCustomer() }
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }
        }
        .scrollContentBackground(.hidden)
        .background(HBColors.cream.ignoresSafeArea())
        .navigationTitle("Add customer")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func createCustomer() async {
        errorMessage = nil
        let em = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !em.isEmpty, em.contains("@") else {
            errorMessage = "Enter a valid email."
            return
        }
        guard password.count >= 8 else {
            errorMessage = "Password must be at least 8 characters."
            return
        }
        isSaving = true
        defer { isSaving = false }
        do {
            let r: AdminCreateCustomerResponse = try await api.request(
                "/admin/customers",
                method: "POST",
                jsonBody: [
                    "email": em,
                    "password": password,
                    "fullName": fullName.trimmingCharacters(in: .whitespacesAndNewlines),
                    "phone": phone.trimmingCharacters(in: .whitespacesAndNewlines),
                ]
            )
            createdSummary = "Created \(r.customer.email). ID: \(r.customer.id)"
            password = ""
            onCreated?()
            HBFeedback.success()
            try? await Task.sleep(for: .milliseconds(600))
            dismiss()
        } catch let e as APIError {
            errorMessage = e.localizedDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    NavigationStack {
        AdminAddCustomerView()
            .environmentObject(APIClient())
    }
}

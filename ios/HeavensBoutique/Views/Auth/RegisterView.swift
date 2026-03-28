import SwiftUI

struct RegisterView: View {
    @Binding var mode: AuthMode
    @EnvironmentObject private var session: SessionViewModel
    @EnvironmentObject private var api: APIClient

    @State private var fullName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        ZStack {
            HBColors.cream.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text("Join Heaven's")
                        .font(HBFont.title(32))
                        .foregroundStyle(HBColors.charcoal)

                    Text("Create an account for orders, loyalty, and personal styling.")
                        .font(HBFont.body())
                        .foregroundStyle(HBColors.mutedGray)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Name")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                        TextField("Your name", text: $fullName)
                            .textContentType(.name)
                            .padding()
                            .background(Color.white)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Email")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                        TextField("you@email.com", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .padding()
                            .background(Color.white)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Password (8+ characters)")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                        SecureField("Password", text: $password)
                            .padding()
                            .background(Color.white)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }

                    if let error {
                        Text(error)
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.rosePink)
                    }

                    HBPrimaryButton(title: "Register", isLoading: isLoading) {
                        Task { await register() }
                    }

                    HBSecondaryButton(title: "Already have an account?") {
                        mode = .login
                    }
                }
                .padding(28)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    private func register() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let r: AuthResponse = try await api.request(
                "/auth/register",
                method: "POST",
                jsonBody: ["email": email, "password": password, "fullName": fullName]
            )
            session.applyAuth(r)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

import SwiftUI

struct LoginView: View {
    @Binding var mode: AuthMode
    @EnvironmentObject private var session: SessionViewModel
    @EnvironmentObject private var api: APIClient

    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        ZStack {
            HBColors.cream.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text("Welcome back")
                        .font(HBFont.title(32))
                        .foregroundStyle(HBColors.charcoal)

                    Text("Sign in to continue your boutique journey.")
                        .font(HBFont.body())
                        .foregroundStyle(HBColors.mutedGray)

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
                        Text("Password")
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

                    HBPrimaryButton(title: "Sign in", isLoading: isLoading) {
                        Task { await login() }
                    }
                    .padding(.top, 8)

                    HBSecondaryButton(title: "Create an account") {
                        mode = .register
                    }
                }
                .padding(28)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    private func login() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let r: AuthResponse = try await api.request(
                "/auth/login",
                method: "POST",
                jsonBody: ["email": email, "password": password]
            )
            session.applyAuth(r)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

import SwiftUI

struct LoginView: View {
    @Binding var mode: AuthMode
    var backTitle: String = "Welcome"
    var onBack: () -> Void
    @EnvironmentObject private var session: SessionViewModel
    @EnvironmentObject private var api: APIClient

    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        ZStack {
            AuthChromeBackground()

            ScrollView {
                VStack(spacing: 0) {
                    VStack(spacing: 16) {
                        HBBrandAppIcon(size: 88)
                        VStack(spacing: 6) {
                            Text("Welcome back")
                                .font(HBFont.title(30))
                                .foregroundStyle(HBColors.charcoal)
                            Text("Sign in to continue your boutique journey.")
                                .font(HBFont.body())
                                .foregroundStyle(HBColors.mutedGray)
                                .multilineTextAlignment(.center)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 8)
                    .padding(.bottom, 28)

                    HBAuthFormCard {
                        VStack(alignment: .leading, spacing: 20) {
                            HBAuthTextField(
                                title: "Email",
                                placeholder: "you@email.com",
                                icon: "envelope.fill",
                                text: $email,
                                isSecure: false,
                                keyboard: .emailAddress,
                                textContent: .emailAddress,
                                autocapitalization: .never
                            )

                            HBAuthTextField(
                                title: "Password",
                                placeholder: "Your password",
                                icon: "lock.fill",
                                text: $password,
                                isSecure: true,
                                keyboard: .default,
                                textContent: .password,
                                autocapitalization: .never
                            )

                            if let error {
                                Text(error)
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.rosePink)
                                    .fixedSize(horizontal: false, vertical: true)
                            }

                            HBPrimaryButton(title: "Sign in", isLoading: isLoading) {
                                Task { await login() }
                            }
                            .padding(.top, 4)

                            HBAuthOrDivider()
                                .padding(.top, 8)

                            HBSignInWithAppleRow(isLoading: $isLoading, error: $error)
                                .padding(.top, 4)

                            HBSecondaryButton(title: "Create an account") {
                                mode = .register
                            }
                                .padding(.top, 12)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 32)
                }
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button(action: onBack) {
                    HStack(spacing: 6) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 14, weight: .semibold))
                        Text(backTitle)
                            .font(HBFont.body().weight(.medium))
                    }
                    .foregroundStyle(HBColors.gold)
                }
            }
        }
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

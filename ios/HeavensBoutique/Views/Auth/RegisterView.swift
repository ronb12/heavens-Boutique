import SwiftUI

struct RegisterView: View {
    @Binding var mode: AuthMode
    var backTitle: String = "Welcome"
    var onBack: () -> Void
    @EnvironmentObject private var session: SessionViewModel
    @EnvironmentObject private var api: APIClient

    @State private var fullName = ""
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
                        HBBrandMonogram(size: 56)
                        VStack(spacing: 6) {
                            (Text("Join ")
                                .font(HBFont.title(30))
                                + Text("Heaven's")
                                .font(HBFont.wordmark(34)))
                                .foregroundStyle(HBColors.charcoal)
                                .multilineTextAlignment(.center)
                            Text("Orders, loyalty notes, and styling—tailored to you.")
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
                                title: "Name",
                                placeholder: "Your name",
                                icon: "person.fill",
                                text: $fullName,
                                isSecure: false,
                                keyboard: .default,
                                textContent: .name,
                                autocapitalization: .words
                            )

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
                                placeholder: "8+ characters",
                                icon: "lock.fill",
                                text: $password,
                                isSecure: true,
                                keyboard: .default,
                                textContent: .newPassword,
                                autocapitalization: .never
                            )

                            if let error {
                                Text(error)
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.rosePink)
                                    .fixedSize(horizontal: false, vertical: true)
                            }

                            HBPrimaryButton(title: "Create account", isLoading: isLoading) {
                                Task { await register() }
                            }

                            HBAuthOrDivider()
                                .padding(.top, 8)

                            HBSignInWithAppleRow(isLoading: $isLoading, error: $error)
                                .padding(.top, 4)

                            HBSecondaryButton(title: "Already have an account?") {
                                mode = .login
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

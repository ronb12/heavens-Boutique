import SwiftUI

enum AuthMode {
    case login, register
}

enum GuestStep {
    case welcome
    case auth
}

struct RootView: View {
    @EnvironmentObject private var session: SessionViewModel
    @State private var mode: AuthMode = .login
    @State private var guestStep: GuestStep = .welcome

    var body: some View {
        Group {
            if session.isRestoring {
                ZStack {
                    AuthChromeBackground()
                    VStack(spacing: 20) {
                        HBBrandMonogram(size: 64)
                        ProgressView()
                            .scaleEffect(1.05)
                            .tint(HBColors.gold)
                    }
                }
            } else if session.isLoggedIn {
                MainTabView()
            } else if guestStep == .welcome {
                WelcomeAuthView(
                    onSignIn: {
                        mode = .login
                        withAnimation(.easeInOut(duration: 0.28)) { guestStep = .auth }
                    },
                    onCreateAccount: {
                        mode = .register
                        withAnimation(.easeInOut(duration: 0.28)) { guestStep = .auth }
                    }
                )
                .transition(.asymmetric(insertion: .opacity, removal: .move(edge: .leading).combined(with: .opacity)))
            } else {
                NavigationStack {
                    Group {
                        if mode == .login {
                            LoginView(mode: $mode, onBackToWelcome: backToWelcome)
                        } else {
                            RegisterView(mode: $mode, onBackToWelcome: backToWelcome)
                        }
                    }
                }
                .transition(.move(edge: .trailing).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.28), value: guestStep)
        .onChange(of: session.isLoggedIn) { _, loggedIn in
            if !loggedIn {
                guestStep = .welcome
                mode = .login
            }
        }
        .task {
            await session.restore()
        }
    }

    private func backToWelcome() {
        withAnimation(.easeInOut(duration: 0.28)) {
            guestStep = .welcome
        }
    }
}

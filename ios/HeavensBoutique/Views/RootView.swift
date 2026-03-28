import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: SessionViewModel
    @State private var mode: AuthMode = .login

    var body: some View {
        Group {
            if session.isRestoring {
                ZStack {
                    HBColors.cream.ignoresSafeArea()
                    ProgressView()
                        .tint(HBColors.gold)
                }
            } else if session.isLoggedIn {
                MainTabView()
            } else {
                NavigationStack {
                    if mode == .login {
                        LoginView(mode: $mode)
                    } else {
                        RegisterView(mode: $mode)
                    }
                }
            }
        }
        .task {
            await session.restore()
        }
    }
}

enum AuthMode {
    case login, register
}

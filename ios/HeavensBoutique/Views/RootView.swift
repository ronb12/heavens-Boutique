import SwiftUI

enum AuthMode {
    case login, register
}

struct RootView: View {
    @EnvironmentObject private var appModel: AppModel
    @EnvironmentObject private var session: SessionViewModel
    @State private var guestBrowsing = false

    var body: some View {
        Group {
            if session.isRestoring {
                HBSplashView()
            } else if session.isLoggedIn {
                MainTabView()
            } else if guestBrowsing {
                MainTabView()
            } else {
                WelcomeAuthView(
                    onBrowseGuest: {
                        guestBrowsing = true
                    },
                    onSignIn: {
                        appModel.presentAuth(.login)
                    },
                    onCreateAccount: {
                        appModel.presentAuth(.register)
                    }
                )
            }
        }
        .animation(.easeInOut(duration: 0.28), value: guestBrowsing)
        .animation(.easeInOut(duration: 0.28), value: session.isLoggedIn)
        .sheet(isPresented: $appModel.showAuthSheet) {
            NavigationStack {
                Group {
                    if appModel.authSheetMode == .login {
                        LoginView(
                            mode: $appModel.authSheetMode,
                            backTitle: "Close",
                            onBack: { appModel.showAuthSheet = false }
                        )
                    } else {
                        RegisterView(
                            mode: $appModel.authSheetMode,
                            backTitle: "Close",
                            onBack: { appModel.showAuthSheet = false }
                        )
                    }
                }
            }
        }
        .onChange(of: session.isLoggedIn) { _, loggedIn in
            if loggedIn {
                appModel.showAuthSheet = false
            } else {
                guestBrowsing = false
                appModel.showAuthSheet = false
            }
        }
        .task {
            await session.restore()
        }
        .onReceive(NotificationCenter.default.publisher(for: .hbFCMRegistrationToken)) { note in
            guard let token = note.object as? String else { return }
            Task { await appModel.pushNotificationCoordinator.handleRegistrationToken(token) }
        }
    }
}

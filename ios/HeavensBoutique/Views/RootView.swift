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
        .onReceive(NotificationCenter.default.publisher(for: .hbPushNotificationTapped)) { note in
            if let userInfo = note.object as? [AnyHashable: Any] {
                handlePushTap(userInfo)
            }
        }
        .onOpenURL { url in
            handleDeepLink(url)
        }
        .onContinueUserActivity("com.heavensboutique.product") { activity in
            if let id = activity.userInfo?["productId"] as? String {
                appModel.pendingProductIdToOpen = id
                appModel.openShopTab()
                guestBrowsing = true
            }
        }
    }

    private func handleDeepLink(_ url: URL) {
        // Supports:
        // - heavensboutique://product/<uuid>
        // - heavensboutique://order/<uuid>
        // Also tolerates https links by reading path components.
        let host = (url.host ?? "").lowercased()
        let parts = url.pathComponents.filter { $0 != "/" }

        func firstId() -> String? {
            if parts.count >= 1 { return parts.last }
            return nil
        }

        if url.scheme?.lowercased() == "heavensboutique" {
            if host == "product", let id = firstId() {
                appModel.pendingProductIdToOpen = id
                appModel.openShopTab()
                guestBrowsing = true
                return
            }
            if host == "order", let id = firstId() {
                appModel.pendingOrderIdToOpen = id
                appModel.openOrdersTab()
                guestBrowsing = true
                return
            }
        }
    }

    private func handlePushTap(_ userInfo: [AnyHashable: Any]) {
        // Firebase data payloads arrive as top-level keys.
        let type = (userInfo["type"] as? String) ?? (userInfo["gcm.notification.type"] as? String)
        if type == "order", let orderId = (userInfo["orderId"] as? String) ?? (userInfo["gcm.notification.orderId"] as? String) {
            appModel.pendingOrderIdToOpen = orderId
            appModel.openOrdersTab()
            guestBrowsing = true
            return
        }
        if type == "message", let conversationId = (userInfo["conversationId"] as? String) ?? (userInfo["gcm.notification.conversationId"] as? String) {
            appModel.pendingConversationIdToOpen = conversationId
            appModel.openMessagesTab()
            guestBrowsing = true
            return
        }
        if type == "back_in_stock", let productId = (userInfo["productId"] as? String) ?? (userInfo["gcm.notification.productId"] as? String) {
            appModel.pendingProductIdToOpen = productId
            appModel.openShopTab()
            guestBrowsing = true
            return
        }
    }
}

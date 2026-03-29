import FirebaseMessaging
import Foundation
import UIKit
import UserNotifications

/// Registers for APNs + FCM after sign-in and syncs `fcmToken` with `PATCH /users/me`. Clears token on sign-out.
@MainActor
final class PushNotificationCoordinator {
    private weak var api: APIClient?
    private weak var session: SessionViewModel?
    private var lastSentToken: String?

    func attach(api: APIClient, session: SessionViewModel) {
        self.api = api
        self.session = session
    }

    func sessionDidAuthenticate() async {
        guard HBFirebaseBootstrap.isConfigured else { return }
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            break
        case .notDetermined:
            do {
                let ok = try await center.requestAuthorization(options: [.alert, .badge, .sound])
                guard ok else { return }
            } catch {
                return
            }
        case .denied:
            return
        @unknown default:
            return
        }

        UIApplication.shared.registerForRemoteNotifications()

        if let token = try? await Messaging.messaging().token() {
            await uploadTokenIfNeeded(token)
        }
    }

    /// Call before clearing the JWT so the server can null out `fcm_token`.
    func sessionWillEnd() async {
        lastSentToken = nil
        guard let api, api.currentToken() != nil else { return }
        try? await api.requestVoid("/users/me", method: "PATCH", jsonBody: ["fcmToken": NSNull()])
    }

    func handleRegistrationToken(_ token: String) async {
        await uploadTokenIfNeeded(token)
    }

    private func uploadTokenIfNeeded(_ token: String) async {
        guard let api, let session, session.isLoggedIn else { return }
        guard token != lastSentToken else { return }
        do {
            try await api.requestVoid("/users/me", method: "PATCH", jsonBody: ["fcmToken": token])
            lastSentToken = token
        } catch {}
    }
}

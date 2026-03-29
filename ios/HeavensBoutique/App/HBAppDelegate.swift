import FirebaseCore
import FirebaseMessaging
import UIKit
import UserNotifications

extension Notification.Name {
    static let hbPushNotificationTapped = Notification.Name("hbPushNotificationTapped")
    /// Posted on main when FCM registration token changes; `object` is `String` token.
    static let hbFCMRegistrationToken = Notification.Name("hbFCMRegistrationToken")
}

/// Configures Firebase (if `GoogleService-Info.plist` is present), APNs → FCM, and notification presentation / taps.
final class HBAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        if HBFirebaseBootstrap.configureIfNeeded() {
            Messaging.messaging().delegate = self
        }
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        #if DEBUG
        print("APNs registration failed: \(error.localizedDescription)")
        #endif
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken, !token.isEmpty else { return }
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: .hbFCMRegistrationToken, object: token)
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: .hbPushNotificationTapped, object: userInfo)
        }
        completionHandler()
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .list])
    }
}

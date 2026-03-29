import FirebaseCore
import Foundation

/// Configures Firebase only when a real `GoogleService-Info.plist` is present (not the `.example` template).
enum HBFirebaseBootstrap {
    private(set) static var isConfigured = false

    @discardableResult
    static func configureIfNeeded() -> Bool {
        guard !isConfigured else { return true }
        guard let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
              let dict = NSDictionary(contentsOfFile: path) as? [String: Any],
              let appId = dict["GOOGLE_APP_ID"] as? String
        else {
            return false
        }
        let trimmed = appId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        let upper = trimmed.uppercased()
        if upper.contains("REPLACE") || upper.contains("YOUR_") || trimmed == "1:000000000000:ios:0000000000000000000000" {
            return false
        }
        FirebaseApp.configure()
        isConfigured = true
        return true
    }
}

import Foundation

enum Config {
    /// Base URL for REST calls. Must end with `/api` for this backend (paths are like `/auth/register`).
    static var apiBaseURL: String {
        var s = (Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        while s.last == "/" { s.removeLast() }
        guard !s.isEmpty else { return "" }
        if !s.lowercased().hasSuffix("/api") {
            s += "/api"
        }
        return s
    }

    static var stripePublishableKey: String {
        (Bundle.main.object(forInfoDictionaryKey: "STRIPE_PUBLISHABLE_KEY") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }
}

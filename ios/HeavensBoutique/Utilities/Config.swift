import Foundation
import StripePayments

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

    /// Site origin from API base (e.g. `https://project.vercel.app`).
    private static var websiteOrigin: String? {
        let api = apiBaseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !api.isEmpty, api.lowercased().hasSuffix("/api") else { return nil }
        var origin = String(api.dropLast(4))
        while origin.last == "/" { origin.removeLast() }
        return origin.isEmpty ? nil : origin
    }

    /// Marketing / legal pages (e.g. `https://project.vercel.app/terms.html`).
    static var termsOfServiceURL: URL? {
        guard let o = websiteOrigin else { return nil }
        return URL(string: o + "/terms.html")
    }

    static var privacyPolicyURL: URL? {
        guard let o = websiteOrigin else { return nil }
        return URL(string: o + "/privacy.html")
    }

    /// Replace with `https://apps.apple.com/app/idYOUR_ID` when the app is listed.
    static var appStoreListingURL: URL? {
        URL(string: "https://apps.apple.com/us/search?term=Heavens%20Boutique")
    }

    static var stripePublishableKey: String {
        (Bundle.main.object(forInfoDictionaryKey: "STRIPE_PUBLISHABLE_KEY") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    /// Optional: Cloudinary cloud name for admin previews of pasted public IDs. Vercel Blob URLs need no cloud name.
    static var cloudinaryCloudName: String {
        (Bundle.main.object(forInfoDictionaryKey: "CLOUDINARY_CLOUD_NAME") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    static func cloudinaryDeliveryURL(publicId: String) -> URL? {
        let trimmed = publicId.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.lowercased().hasPrefix("http://") || trimmed.lowercased().hasPrefix("https://") {
            return URL(string: trimmed)
        }
        let cloud = cloudinaryCloudName
        guard !cloud.isEmpty else { return nil }
        let encoded = trimmed
            .split(separator: "/")
            .map { String($0).addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? "" }
            .joined(separator: "/")
        return URL(string: "https://res.cloudinary.com/\(cloud)/image/upload/f_auto,q_auto/\(encoded)")
    }

    static var appMarketingVersion: String {
        (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String) ?? "—"
    }

    static var appBuildNumber: String {
        (Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String) ?? "—"
    }

    static let supportEmail = "heavenbowie0913@gmail.com"

    static var supportEmailURL: URL? {
        URL(string: "mailto:\(supportEmail)?subject=Heaven%27s%20Boutique%20support")
    }

    /// E.164-style digits for `tel:` (US).
    static var supportPhoneURL: URL? {
        URL(string: "tel:+17062618323")
    }

    static let supportPhoneDisplay = "706-261-8323"

    /// Settings → About: developer credit.
    static let builtByName = "Ronell Bradley"

    /// Settings → About: owning company (separate from developer credit).
    static let productOfCompany = "Bradley Virtual Solutions, LLC"

    /// If the API has a publishable key in Admin → Settings, prefer it over Info.plist after fetch.
    @MainActor
    static func applyServerStripePublishableKeyIfAvailable() async {
        let base = apiBaseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !base.isEmpty else { return }
        let client = APIClient()
        do {
            let r: PublicStripeConfigResponse = try await client.request("/config/stripe", method: "GET")
            let k = r.publishableKey.trimmingCharacters(in: .whitespacesAndNewlines)
            if !k.isEmpty {
                STPAPIClient.shared.publishableKey = k
            }
        } catch {
            /* keep Info.plist value */
        }
    }
}

import SwiftUI
import StripePayments

@main
struct HeavensBoutiqueApp: App {
    @UIApplicationDelegateAdaptor(HBAppDelegate.self) private var appDelegate
    @StateObject private var appModel = AppModel()
    @AppStorage(HBAppearancePreference.storageKey) private var appearanceRaw: String = HBAppearancePreference.system.rawValue

    init() {
        HBURLCache.configureSharedCache()
        STPAPIClient.shared.publishableKey = Config.stripePublishableKey
        Task { @MainActor in
            await Config.applyServerStripePublishableKeyIfAvailable()
        }
    }

    private var preferredColorScheme: ColorScheme? {
        HBAppearancePreference(rawValue: appearanceRaw)?.preferredColorScheme
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appModel)
                .environmentObject(appModel.api)
                .environmentObject(appModel.session)
                .environmentObject(appModel.cart)
                .preferredColorScheme(preferredColorScheme)
        }
    }
}

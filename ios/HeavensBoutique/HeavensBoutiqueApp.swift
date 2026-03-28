import SwiftUI
import StripePayments

@main
struct HeavensBoutiqueApp: App {
    @StateObject private var appModel = AppModel()

    init() {
        STPAPIClient.shared.publishableKey = Config.stripePublishableKey
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appModel.api)
                .environmentObject(appModel.session)
                .environmentObject(appModel.cart)
        }
    }
}

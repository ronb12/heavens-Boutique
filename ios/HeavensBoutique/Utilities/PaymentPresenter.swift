import UIKit
import StripePaymentSheet

enum PaymentPresenter {
    @MainActor
    static func rootViewController() -> UIViewController? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first(where: { $0.activationState == .foregroundActive })?
            .keyWindow?
            .rootViewController
            ?? UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first?
            .keyWindow?
            .rootViewController
    }

    /// Walks navigation/tab containers so `PaymentSheet` is presented above checkout sheets and other modals.
    @MainActor
    private static func topMostViewController(from root: UIViewController?) -> UIViewController? {
        guard let root else { return nil }
        if let presented = root.presentedViewController {
            return topMostViewController(from: presented)
        }
        if let nav = root as? UINavigationController {
            return topMostViewController(from: nav.visibleViewController)
        }
        if let tab = root as? UITabBarController {
            return topMostViewController(from: tab.selectedViewController)
        }
        return root
    }

    @MainActor
    static func present(_ sheet: PaymentSheet, completion: @escaping (PaymentSheetResult) -> Void) {
        guard let anchor = topMostViewController(from: rootViewController()) else { return }
        sheet.present(from: anchor, completion: completion)
    }
}

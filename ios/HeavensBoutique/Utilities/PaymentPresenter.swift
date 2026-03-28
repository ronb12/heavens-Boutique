import UIKit
import StripePaymentSheet

enum PaymentPresenter {
    @MainActor
    static func rootViewController() -> UIViewController? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }?
            .rootViewController
    }

    @MainActor
    static func present(_ sheet: PaymentSheet, completion: @escaping (PaymentSheetResult) -> Void) {
        guard let root = rootViewController() else { return }
        sheet.present(from: root, completion: completion)
    }
}

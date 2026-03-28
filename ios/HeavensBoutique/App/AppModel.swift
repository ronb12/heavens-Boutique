import Foundation

@MainActor
final class AppModel: ObservableObject {
    let api: APIClient
    let session: SessionViewModel
    let cart: CartStore

    init() {
        let a = APIClient()
        api = a
        session = SessionViewModel(api: a)
        cart = CartStore(api: a)
    }
}

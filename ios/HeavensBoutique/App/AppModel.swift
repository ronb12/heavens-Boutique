import Foundation

@MainActor
final class AppModel: ObservableObject {
    /// Modal sign-in / register while browsing as a guest (or from checkout).
    @Published var showAuthSheet = false
    @Published var authSheetMode: AuthMode = .login

    func presentAuth(_ mode: AuthMode) {
        authSheetMode = mode
        showAuthSheet = true
    }
    /// Main `TabView` selection: Home 0, Shop 1, Messages 2, Notifications 3, Profile 4.
    @Published var tabSelection: Int = 0
    /// When set, `ConversationsListView` can push this conversation (e.g. after a notification tap).
    @Published var pendingConversationIdToOpen: String?

    let api: APIClient
    let session: SessionViewModel
    let cart: CartStore

    init() {
        let a = APIClient()
        api = a
        session = SessionViewModel(api: a)
        cart = CartStore(api: a)
    }

    func openShopTab() {
        tabSelection = 1
    }

    func openProfileTab() {
        tabSelection = 4
    }

    func openMessagesTab() {
        tabSelection = 2
    }
}

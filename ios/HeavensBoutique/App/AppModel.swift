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
    /// When set, `ProfileView` pushes order detail (e.g. after an order notification tap).
    @Published var pendingOrderIdToOpen: String?

    /// Admins only: hide admin entry points and use customer APIs (e.g. Messages = my threads only).
    @Published var customerViewPreview = false

    let api: APIClient
    let session: SessionViewModel
    let cart: CartStore
    let pushNotificationCoordinator = PushNotificationCoordinator()

    init() {
        let a = APIClient()
        api = a
        session = SessionViewModel(api: a)
        pushNotificationCoordinator.attach(api: a, session: session)
        session.pushCoordinator = pushNotificationCoordinator
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

    /// Admin toolbar, Profile/Settings admin rows, long-press shortcut, and `?all=1` message list.
    var showAdminChrome: Bool {
        session.isAdmin && !customerViewPreview
    }

    func exitCustomerViewPreview() {
        customerViewPreview = false
    }
}

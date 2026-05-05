import Foundation

@MainActor
final class SessionViewModel: ObservableObject {
    @Published private(set) var user: UserDTO?
    @Published private(set) var isRestoring = true

    private let api: APIClient
    weak var pushCoordinator: PushNotificationCoordinator?

    init(api: APIClient) {
        self.api = api
    }

    var isLoggedIn: Bool { user != nil }
    /// Store owner (`admin` role).
    var isAdmin: Bool { user?.isStoreOwner == true }
    /// Admin or active staff with at least one permission (store team).
    var canOpenAdminPortal: Bool { user?.canOpenAdminPortal == true }

    func restore() async {
        isRestoring = true
        defer { isRestoring = false }
        guard api.currentToken() != nil else {
            user = nil
            return
        }
        do {
            let me: UserDTO = try await api.request("/users/me", method: "GET")
            user = me
            await pushCoordinator?.sessionDidAuthenticate()
        } catch {
            #if DEBUG
            print("[SessionViewModel] restore failed: \(error)")
            #endif
            api.setToken(nil)
            user = nil
        }
    }

    func applyAuth(_ response: AuthResponse) {
        api.setToken(response.token)
        user = response.user
        Task { await pushCoordinator?.sessionDidAuthenticate() }
    }

    func logout() async {
        await pushCoordinator?.sessionWillEnd()
        api.setToken(nil)
        user = nil
    }

    func refreshProfile() async {
        guard isLoggedIn else { return }
        do {
            let me: UserDTO = try await api.request("/users/me", method: "GET")
            user = me
        } catch {
            #if DEBUG
            print("[SessionViewModel] refreshProfile failed: \(error)")
            #endif
        }
    }
}

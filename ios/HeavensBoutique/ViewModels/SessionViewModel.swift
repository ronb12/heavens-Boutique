import Foundation

@MainActor
final class SessionViewModel: ObservableObject {
    @Published private(set) var user: UserDTO?
    @Published private(set) var isRestoring = true

    private let api: APIClient

    init(api: APIClient) {
        self.api = api
    }

    var isLoggedIn: Bool { user != nil }
    /// Matches API `users.role` (Postgres); tolerate any casing.
    var isAdmin: Bool { (user?.role ?? "").lowercased() == "admin" }

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
        } catch {
            api.setToken(nil)
            user = nil
        }
    }

    func applyAuth(_ response: AuthResponse) {
        api.setToken(response.token)
        user = response.user
    }

    func logout() {
        api.setToken(nil)
        user = nil
    }

    func refreshProfile() async {
        guard isLoggedIn else { return }
        do {
            let me: UserDTO = try await api.request("/users/me", method: "GET")
            user = me
        } catch { }
    }
}

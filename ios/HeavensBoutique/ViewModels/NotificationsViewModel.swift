import Foundation

@MainActor
final class NotificationsViewModel: ObservableObject {
    @Published var items: [NotificationDTO] = []
    @Published var isLoading = false
    @Published var error: String?

    func load(api: APIClient) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let r: NotificationsResponse = try await api.request("/notifications", method: "GET")
            items = r.notifications
        } catch {
            self.error = error.localizedDescription
        }
    }

    func markAllRead(api: APIClient) async {
        do {
            try await api.requestVoid("/notifications", method: "PATCH", jsonBody: ["markAll": true])
            await load(api: api)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func markRead(id: String, api: APIClient) async {
        do {
            try await api.requestVoid("/notifications", method: "PATCH", jsonBody: ["ids": [id]])
            await load(api: api)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

import Foundation

@MainActor
final class OrdersViewModel: ObservableObject {
    @Published var orders: [OrderDTO] = []
    @Published var isLoading = false
    @Published var error: String?

    func load(api: APIClient, adminAll: Bool) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let path = adminAll ? "/orders?all=1" : "/orders"
            let r: OrdersResponse = try await api.request(path, method: "GET")
            orders = r.orders
        } catch {
            self.error = error.localizedDescription
        }
    }
}

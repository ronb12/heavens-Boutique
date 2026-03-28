import Foundation

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var featured: [ProductDTO] = []
    @Published var isLoading = false
    @Published var error: String?

    func load(api: APIClient) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let r: ProductsResponse = try await api.request("/products?featured=1", method: "GET")
            featured = r.products
        } catch {
            self.error = error.localizedDescription
        }
    }
}

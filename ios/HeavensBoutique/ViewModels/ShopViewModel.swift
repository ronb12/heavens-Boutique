import Foundation

@MainActor
final class ShopViewModel: ObservableObject {
    @Published var products: [ProductDTO] = []
    @Published var selectedCategory: String?
    @Published var shopTheLookGroup: String?
    @Published var isLoading = false
    @Published var error: String?

    var categories: [String] {
        let c = Set(products.map(\.category))
        return [String](c).sorted()
    }

    func load(api: APIClient) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            var path = "/products"
            if let g = shopTheLookGroup, !g.isEmpty {
                path += "?shopLook=\(g.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? g)"
            } else if let c = selectedCategory, !c.isEmpty {
                path += "?category=\(c.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? c)"
            }
            let r: ProductsResponse = try await api.request(path, method: "GET")
            products = r.products
        } catch {
            self.error = error.localizedDescription
        }
    }
}

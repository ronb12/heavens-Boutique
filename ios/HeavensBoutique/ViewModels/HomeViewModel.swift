import Foundation

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var featured: [ProductDTO] = []
    @Published var homepage: HomepageContentDTO = HomepageContentDTO(banners: [], collections: [], hero: nil)
    @Published var collectionProducts: [String: [ProductDTO]] = [:]
    @Published var isLoading = false
    @Published var error: String?

    func load(api: APIClient) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let hp: HomepageResponse = try await api.request("/homepage", method: "GET")
            homepage = hp.content

            // Featured still used as a fallback / first section.
            let r: ProductsResponse = try await api.request("/products?featured=1", method: "GET")
            featured = r.products

            var out: [String: [ProductDTO]] = [:]
            for c in hp.content.collections {
                let q = (c.query ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                let path = q.isEmpty ? "/products" : "/products?\(q)"
                if let pr: ProductsResponse = try? await api.request(path, method: "GET") {
                    out[c.title] = pr.products
                }
            }
            collectionProducts = out
        } catch {
            self.error = error.localizedDescription
        }
    }
}

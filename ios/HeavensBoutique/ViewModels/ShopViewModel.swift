import Foundation

@MainActor
final class ShopViewModel: ObservableObject {
    @Published var products: [ProductDTO] = []
    @Published var selectedCategory: String?
    @Published var shopTheLookGroup: String?
    @Published var searchQuery: String = ""
    @Published var selectedSize: String?
    @Published var minPriceCents: Int?
    @Published var maxPriceCents: Int?
    @Published var sort: Sort = .newest
    @Published var isLoading = false
    @Published var error: String?

    var categories: [String] {
        let c = Set(products.map(\.category))
        return [String](c).sorted()
    }

    var availableSizes: [String] {
        let sizes = products.flatMap(\.variants).map(\.size)
        return Array(Set(sizes)).sorted()
    }

    enum Sort: String, CaseIterable, Identifiable {
        case newest = "newest"
        case priceAsc = "price_asc"
        case priceDesc = "price_desc"

        var id: String { rawValue }
        var title: String {
            switch self {
            case .newest: return "Newest"
            case .priceAsc: return "Price: Low → High"
            case .priceDesc: return "Price: High → Low"
            }
        }
    }

    func load(api: APIClient) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            var items: [URLQueryItem] = []
            if let g = shopTheLookGroup, !g.isEmpty {
                items.append(URLQueryItem(name: "shopLook", value: g))
            } else if let c = selectedCategory, !c.isEmpty {
                items.append(URLQueryItem(name: "category", value: c))
            }
            let q = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
            if !q.isEmpty {
                items.append(URLQueryItem(name: "q", value: q))
            }
            if let s = selectedSize, !s.isEmpty {
                items.append(URLQueryItem(name: "size", value: s))
            }
            if let min = minPriceCents {
                items.append(URLQueryItem(name: "minPrice", value: String(min)))
            }
            if let max = maxPriceCents {
                items.append(URLQueryItem(name: "maxPrice", value: String(max)))
            }
            items.append(URLQueryItem(name: "sort", value: sort.rawValue))

            var path = "/products"
            if !items.isEmpty {
                var comps = URLComponents()
                comps.queryItems = items
                if let q = comps.percentEncodedQuery, !q.isEmpty {
                    path += "?\(q)"
                }
            }
            let r: ProductsResponse = try await api.request(path, method: "GET")
            products = r.products
        } catch {
            self.error = error.localizedDescription
        }
    }
}

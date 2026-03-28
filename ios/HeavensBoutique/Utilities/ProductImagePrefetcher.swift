import Foundation

/// Warms `URLCache` for product image URLs when rows appear.
actor ProductImagePrefetcher {
    static let shared = ProductImagePrefetcher()

    private var seen = Set<String>()

    func prefetch(urlStrings: [String]) async {
        for s in urlStrings {
            guard !s.isEmpty, !seen.contains(s), let url = URL(string: s) else { continue }
            seen.insert(s)
            var req = URLRequest(url: url)
            req.httpMethod = "GET"
            req.cachePolicy = .returnCacheDataElseLoad
            _ = try? await URLSession.shared.data(for: req)
        }
    }
}

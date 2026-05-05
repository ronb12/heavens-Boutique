import Foundation

@MainActor
final class CartStore: ObservableObject {
    @Published private(set) var lines: [CartLine] = []

    private let api: APIClient
    private var syncTask: Task<Void, Never>?

    init(api: APIClient) {
        self.api = api
        if let data = UserDefaults.standard.data(forKey: "hb_cart"),
           let decoded = try? JSONDecoder().decode([CartLineSnapshot].self, from: data) {
            lines = decoded.map(\.asLine)
        }
    }

    func add(product: ProductDTO, variant: ProductVariantDTO, quantity: Int = 1) {
        if let i = lines.firstIndex(where: { $0.variant.id == variant.id }) {
            lines[i].quantity += quantity
        } else {
            lines.append(CartLine(product: product, variant: variant, quantity: quantity))
        }
        persist()
        scheduleSync()
    }

    func setQuantity(line: CartLine, qty: Int) {
        guard let i = lines.firstIndex(where: { $0.id == line.id }) else { return }
        if qty <= 0 {
            lines.remove(at: i)
        } else {
            lines[i].quantity = qty
        }
        persist()
        scheduleSync()
    }

    /// Reads the current line from the store by variant id so List row reuse can’t apply the wrong delta to another row.
    func adjustQuantity(variantId: String, delta: Int) {
        guard let i = lines.firstIndex(where: { $0.variant.id == variantId }) else { return }
        let next = lines[i].quantity + delta
        if next <= 0 {
            lines.remove(at: i)
        } else {
            lines[i].quantity = next
        }
        persist()
        scheduleSync()
    }

    func remove(_ line: CartLine) {
        removeVariant(id: line.variant.id)
    }

    func removeVariant(id: String) {
        lines.removeAll { $0.variant.id == id }
        persist()
        scheduleSync()
    }

    func clear() {
        lines = []
        persist()
        scheduleSync()
    }

    var subtotalCents: Int {
        lines.reduce(0) { partial, line in
            let unit = line.product.salePriceCents ?? line.product.priceCents
            return partial + unit * line.quantity
        }
    }

    /// Re-fetch each product from the API so list/sale prices match the server (what you pay at checkout).
    /// The bag stores a snapshot from when the item was added; admin or web price changes won’t show until this runs.
    func refreshLinePrices() async {
        guard !lines.isEmpty else { return }
        let productIds = Array(Set(lines.map(\.product.id)))
        for pid in productIds {
            do {
                let r: ProductSingleResponse = try await api.request("/products/\(pid)", method: "GET")
                let fresh = r.product
                for i in lines.indices where lines[i].product.id == fresh.id {
                    let variantId = lines[i].variant.id
                    let newVariant = fresh.variants.first(where: { $0.id == variantId }) ?? lines[i].variant
                    lines[i] = CartLine(product: fresh, variant: newVariant, quantity: lines[i].quantity)
                }
            } catch {
                #if DEBUG
                print("[CartStore] refreshLinePrices failed for \(pid): \(error)")
                #endif
            }
        }
        persist()
    }

    private func persist() {
        let snaps = lines.map(CartLineSnapshot.init)
        if let data = try? JSONEncoder().encode(snaps) {
            UserDefaults.standard.set(data, forKey: "hb_cart")
        }
    }

    private func scheduleSync() {
        syncTask?.cancel()
        syncTask = Task {
            try? await Task.sleep(nanoseconds: 800_000_000)
            await syncToServer()
        }
    }

    private func syncToServer() async {
        guard api.currentToken() != nil else { return }
        let items = lines.map {
            ["variantId": $0.variant.id, "quantity": $0.quantity]
        }
        do {
            try await api.requestVoid("/cart", method: "POST", jsonBody: ["items": items])
        } catch {
            #if DEBUG
            print("[CartStore] syncToServer failed: \(error)")
            #endif
        }
    }
}

private struct CartLineSnapshot: Codable {
    let product: ProductDTO
    let variant: ProductVariantDTO
    var quantity: Int

    var asLine: CartLine {
        CartLine(product: product, variant: variant, quantity: quantity)
    }
}

extension CartLineSnapshot {
    init(_ line: CartLine) {
        self.product = line.product
        self.variant = line.variant
        self.quantity = line.quantity
    }
}

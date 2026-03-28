import Foundation

struct CartLine: Identifiable, Hashable {
    var id: String { "\(product.id)-\(variant.id)" }
    let product: ProductDTO
    let variant: ProductVariantDTO
    var quantity: Int
}

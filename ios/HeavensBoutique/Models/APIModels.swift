import Foundation

struct AuthResponse: Decodable {
    let token: String
    let user: UserDTO
}

struct UserDTO: Codable, Identifiable {
    let id: String
    let email: String
    let fullName: String?
    let role: String
    let loyaltyPoints: Int?
}

struct ProductsResponse: Decodable {
    let products: [ProductDTO]
}

struct ProductDTO: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let slug: String
    let description: String?
    let category: String
    let priceCents: Int
    let salePriceCents: Int?
    let isFeatured: Bool
    let shopLookGroup: String?
    let images: [String]
    let variants: [ProductVariantDTO]
}

struct ProductVariantDTO: Codable, Identifiable, Hashable {
    let id: String
    let size: String
    let sku: String?
    let stock: Int
}

struct ProductSingleResponse: Decodable {
    let product: ProductDTO
}

struct PaymentIntentResponse: Decodable {
    let clientSecret: String
    let amountCents: Int
    let subtotalCents: Int
    let discountCents: Int
}

struct OrdersResponse: Decodable {
    let orders: [OrderDTO]
}

struct OrderDTO: Decodable, Identifiable {
    let id: String
    let status: String
    let subtotalCents: Int?
    let discountCents: Int?
    let totalCents: Int
    let trackingNumber: String?
    /// Present on paid orders; use in Stripe Dashboard to find the PaymentIntent for refunds.
    let stripePaymentIntentId: String?
    let createdAt: String?
    let userEmail: String?
    let userName: String?
    let items: [OrderItemDTO]?
}

struct OrderDetailResponse: Decodable {
    let order: OrderDTO
}

struct OrderItemDTO: Decodable, Identifiable {
    let id: String
    let productId: String
    let variantId: String
    let quantity: Int
    let unitPriceCents: Int
    let productName: String?
}

struct ConversationsResponse: Decodable {
    let conversations: [ConversationDTO]
}

struct ConversationDTO: Decodable, Identifiable {
    let id: String
    let userId: String?
    let orderId: String?
    let title: String?
    let lastMessageAt: String?
    let customerEmail: String?
    let customerName: String?
}

struct MessagesResponse: Decodable {
    let messages: [MessageDTO]
}

struct MessageDTO: Decodable, Identifiable {
    let id: String
    let senderId: String
    let senderName: String?
    let body: String?
    let imageUrl: String?
    let readAt: String?
    let createdAt: String?
}

struct NotificationsResponse: Decodable {
    let notifications: [NotificationDTO]
}

struct NotificationDataPayload: Decodable, Hashable {
    let orderId: String?
    let status: String?
    let type: String?
    let conversationId: String?
}

struct NotificationDTO: Decodable, Identifiable {
    let id: String
    let type: String
    let title: String
    let body: String?
    let readAt: String?
    let createdAt: String?
    /// Best-effort decode so one malformed `data` JSON object does not drop the whole notifications list.
    let data: NotificationDataPayload?

    enum CodingKeys: String, CodingKey {
        case id, type, title, body, readAt, createdAt, data
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        type = try c.decode(String.self, forKey: .type)
        title = try c.decode(String.self, forKey: .title)
        body = try c.decodeIfPresent(String.self, forKey: .body)
        readAt = try c.decodeIfPresent(String.self, forKey: .readAt)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        data = try? c.decodeIfPresent(NotificationDataPayload.self, forKey: .data)
    }
}

struct APIErrorBody: Decodable {
    let error: String?
}

struct EmptyResponse: Decodable {}

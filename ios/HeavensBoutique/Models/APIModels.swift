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
    /// Admin-only in API when fetching with an admin token; always omitted from public list responses.
    let costCents: Int?
    let isFeatured: Bool
    let shopLookGroup: String?
    let images: [String]
    let variants: [ProductVariantDTO]

    enum CodingKeys: String, CodingKey {
        case id, name, slug, description, category, priceCents, salePriceCents, costCents, isFeatured, shopLookGroup, images, variants
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        slug = try c.decode(String.self, forKey: .slug)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        category = try c.decode(String.self, forKey: .category)
        priceCents = try c.decode(Int.self, forKey: .priceCents)
        salePriceCents = try c.decodeIfPresent(Int.self, forKey: .salePriceCents)
        costCents = try c.decodeIfPresent(Int.self, forKey: .costCents)
        isFeatured = try c.decode(Bool.self, forKey: .isFeatured)
        shopLookGroup = try c.decodeIfPresent(String.self, forKey: .shopLookGroup)
        images = try c.decodeIfPresent([String].self, forKey: .images) ?? []
        variants = try c.decodeIfPresent([ProductVariantDTO].self, forKey: .variants) ?? []
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(name, forKey: .name)
        try c.encode(slug, forKey: .slug)
        try c.encodeIfPresent(description, forKey: .description)
        try c.encode(category, forKey: .category)
        try c.encode(priceCents, forKey: .priceCents)
        try c.encodeIfPresent(salePriceCents, forKey: .salePriceCents)
        try c.encodeIfPresent(costCents, forKey: .costCents)
        try c.encode(isFeatured, forKey: .isFeatured)
        try c.encodeIfPresent(shopLookGroup, forKey: .shopLookGroup)
        try c.encode(images, forKey: .images)
        try c.encode(variants, forKey: .variants)
    }
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

// MARK: - Admin customers (`GET /admin/customers`, `GET/PATCH /admin/customers/:id`)

struct AdminCustomersListResponse: Decodable {
    let customers: [AdminCustomerSummaryDTO]
}

struct AdminCreateCustomerResponse: Decodable {
    let customer: AdminCreatedCustomerDTO
}

struct AdminCreatedCustomerDTO: Decodable {
    let id: String
    let email: String
    let fullName: String?
    let phone: String?
    let role: String
    let loyaltyPoints: Int
}

struct AdminCreateOrderResponse: Decodable {
    let orderId: String
}

struct AdminCustomerSummaryDTO: Decodable, Identifiable, Hashable {
    let id: String
    let email: String
    let fullName: String?
    let phone: String?
    let role: String
    let loyaltyPoints: Int
    let tags: [String]
    let createdAt: String?
    let orderCount: Int
    let spentCents: Int
}

struct AdminCustomerDetailResponse: Decodable {
    let user: AdminCustomerDetailUserDTO
    let addresses: [AdminCustomerAddressDTO]
    let recentOrders: [AdminCustomerOrderRowDTO]

    init(user: AdminCustomerDetailUserDTO, addresses: [AdminCustomerAddressDTO], recentOrders: [AdminCustomerOrderRowDTO]) {
        self.user = user
        self.addresses = addresses
        self.recentOrders = recentOrders
    }
}

struct AdminCustomerDetailUserDTO: Decodable {
    let id: String
    let email: String
    let fullName: String?
    let phone: String?
    let role: String
    let loyaltyPoints: Int
    let tags: [String]
    let createdAt: String?
    let updatedAt: String?
    let pushEnabled: Bool
}

struct AdminCustomerAddressDTO: Decodable, Identifiable {
    let id: String
    let label: String?
    let line1: String
    let line2: String?
    let city: String
    let state: String?
    let postal: String
    let country: String
    let isDefault: Bool
    let createdAt: String?
}

struct AdminCustomerOrderRowDTO: Decodable, Identifiable {
    let id: String
    let status: String
    let totalCents: Int
    let createdAt: String?
    let stripePaymentIntentId: String?
}

struct AdminCustomerPatchResponse: Decodable {
    let user: AdminCustomerDetailUserDTO
}

struct AdminUploadImageResponse: Decodable {
    let publicId: String
    let url: String
    let width: Int?
    let height: Int?
}

// MARK: - Admin financial reports (`GET /admin/reports`)

struct AdminFinancialReportsResponse: Decodable {
    let currency: String
    let asOf: String
    let days: Int
    let summary: AdminFinancialSummary
    let byStatus: [AdminOrderStatusBreakdown]
    let daily: [AdminDailyRevenueRow]
}

struct AdminFinancialSummary: Decodable {
    let grossSalesCents: Int
    let refundedCents: Int
    let netSalesCents: Int
    let discountsCents: Int
    let taxCents: Int
    let shippingCents: Int
    let paidOrderCount: Int
    let averageOrderValueCents: Int
}

struct AdminOrderStatusBreakdown: Decodable, Identifiable {
    var id: String { status }
    let status: String
    let count: Int
    let totalCents: Int
}

struct AdminDailyRevenueRow: Decodable, Identifiable {
    var id: String { date }
    let date: String
    let revenueCents: Int
    let orderCount: Int
}

struct APIErrorBody: Decodable {
    let error: String?
}

struct EmptyResponse: Decodable {}

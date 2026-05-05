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
    /// Present when `role` is `staff`; mirrors backend permission flags.
    let staffPermissions: [String: Bool]?
    let staffActive: Bool?

    func hasStaffPermission(_ key: String) -> Bool {
        if role.lowercased() == "admin" { return true }
        guard role.lowercased() == "staff", staffActive != false else { return false }
        return staffPermissions?[key] == true
    }

    /// True if the user has any of the given staff permissions (admin always true).
    func hasAnyStaffPermission(_ keys: [String]) -> Bool {
        if role.lowercased() == "admin" { return true }
        guard role.lowercased() == "staff", staffActive != false else { return false }
        return keys.contains { staffPermissions?[$0] == true }
    }

    var canOpenAdminPortal: Bool {
        if role.lowercased() == "admin" { return true }
        guard role.lowercased() == "staff", staffActive != false else { return false }
        return staffPermissions?.values.contains(true) ?? false
    }

    var isStoreOwner: Bool { role.lowercased() == "admin" }
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
    /// Admin-only: vendor / reorder context (wholesale, marketplace, rep link, etc.).
    let supplierName: String?
    let supplierUrl: String?
    let supplierNotes: String?
    let isFeatured: Bool
    let shopLookGroup: String?
    /// Included on admin `GET /products/:id` for edits; omitted from typical list responses.
    let cloudinaryIds: [String]?
    let images: [String]
    let variants: [ProductVariantDTO]

    enum CodingKeys: String, CodingKey {
        case id, name, slug, description, category, priceCents, salePriceCents, costCents
        case supplierName, supplierUrl, supplierNotes
        case isFeatured, shopLookGroup, cloudinaryIds, images, variants
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
        supplierName = try c.decodeIfPresent(String.self, forKey: .supplierName)
        supplierUrl = try c.decodeIfPresent(String.self, forKey: .supplierUrl)
        supplierNotes = try c.decodeIfPresent(String.self, forKey: .supplierNotes)
        isFeatured = try c.decode(Bool.self, forKey: .isFeatured)
        shopLookGroup = try c.decodeIfPresent(String.self, forKey: .shopLookGroup)
        cloudinaryIds = try c.decodeIfPresent([String].self, forKey: .cloudinaryIds)
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
        try c.encodeIfPresent(supplierName, forKey: .supplierName)
        try c.encodeIfPresent(supplierUrl, forKey: .supplierUrl)
        try c.encodeIfPresent(supplierNotes, forKey: .supplierNotes)
        try c.encode(isFeatured, forKey: .isFeatured)
        try c.encodeIfPresent(shopLookGroup, forKey: .shopLookGroup)
        try c.encodeIfPresent(cloudinaryIds, forKey: .cloudinaryIds)
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
    let shippingCents: Int
    let taxCents: Int
}

struct ShippingAddressDTO: Codable {
    let name: String?
    let line1: String
    let line2: String?
    let city: String
    let state: String?
    let postal: String
    let country: String

    var singleLine: String {
        [line1, city, state, postal].compactMap { $0?.isEmpty == false ? $0 : nil }.joined(separator: ", ")
    }
}

struct AddressDTO: Codable, Identifiable {
    let id: String
    let name: String?
    let label: String?
    let line1: String
    let line2: String?
    let city: String
    let state: String?
    let postal: String
    let country: String
    let isDefault: Bool
    let createdAt: String?

    var toShippingAddress: ShippingAddressDTO {
        ShippingAddressDTO(name: name, line1: line1, line2: line2, city: city, state: state, postal: postal, country: country)
    }
}

struct AddressesResponse: Decodable {
    let addresses: [AddressDTO]
}

struct AddressResponse: Decodable {
    let address: AddressDTO
}

struct ShippingRateDTO: Decodable, Identifiable {
    let id: String
    let carrier: String
    let service: String
    let rateCents: Int
    let deliveryDays: Int?
    let deliveryDate: String?
}

struct ShippingRatesResponse: Decodable {
    let shipmentId: String
    let rates: [ShippingRateDTO]
}

struct ReturnItemDTO: Codable {
    let variantId: String?
    let productName: String?
    let quantity: Int?
    let reason: String?
}

struct ReturnDTO: Decodable, Identifiable {
    let id: String
    let orderId: String
    let reason: String
    let notes: String?
    let status: String
    let items: [ReturnItemDTO]?
    let returnLabelUrl: String?
    let createdAt: String?
    let updatedAt: String?
}

struct ReturnsResponse: Decodable {
    let returns: [ReturnDTO]
}

struct ReturnResponse: Decodable {
    let `return`: ReturnDTO
}

struct OrdersResponse: Decodable {
    let orders: [OrderDTO]
}

struct OrderDTO: Decodable, Identifiable {
    let id: String
    let status: String
    let subtotalCents: Int?
    let discountCents: Int?
    let shippingCents: Int?
    let taxCents: Int?
    let totalCents: Int
    let trackingNumber: String?
    /// Present on paid orders; use in Stripe Dashboard to find the PaymentIntent for refunds.
    let stripePaymentIntentId: String?
    let shippingAddress: ShippingAddressDTO?
    let shippingTier: String?
    let labelUrl: String?
    let carrier: String?
    let service: String?
    let fulfillmentStatus: String?
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
    let variantSize: String?
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
    /// Admin alert discriminator: `new_order`, `low_stock`, `new_signup`.
    let kind: String?
    let userId: String?
    let conversationId: String?
    /// Optional hero image for promotion-style in-app cards (HTTPS URL).
    let imageUrl: String?
    /// Small label above the title, e.g. “New drop” or “Exclusive”.
    let badge: String?
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

    /// Editorial / marketing types use the richer “newsletter” card chrome.
    var usesNewsletterLayout: Bool {
        let t = type.lowercased()
        return t == "promotion" || t == "back_in_stock"
    }
}

// MARK: - Admin customers (`GET /admin/customers`, `GET/PATCH /admin/customers/:id`)

struct AdminCustomersListResponse: Decodable {
    let customers: [AdminCustomerSummaryDTO]
}

/// Response from `POST /notifications` (admin marketing / promotion send).
struct AdminNotifySendResponse: Decodable {
    let ok: Bool
    let sentCount: Int?
    let audience: String?
    let pushSent: Int?
    let pushCapped: Bool?
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

// MARK: - Admin Stripe settings (`GET` / `POST /admin/stripe-settings`)

struct AdminStripeSettingsResponse: Decodable {
    let publishableKey: String?
    let hasSecretKey: Bool
    let hasWebhookSecret: Bool
    let envOverridesSecret: Bool
    let envOverridesWebhook: Bool
}

// MARK: - Admin EasyPost settings (`GET` / `POST /admin/easypost-settings`)

struct AdminEasyPostFromDTO: Decodable {
    let name: String
    let street1: String
    let street2: String
    let city: String
    let state: String
    let zip: String
    let phone: String
    let email: String
}

struct AdminEasyPostEnvOverridesDTO: Decodable {
    let apiKey: Bool
    let fromName: Bool
    let fromStreet1: Bool
    let fromStreet2: Bool
    let fromCity: Bool
    let fromState: Bool
    let fromZip: Bool
    let fromPhone: Bool
    let fromEmail: Bool
}

struct AdminEasyPostSettingsResponse: Decodable {
    let hasApiKey: Bool
    let envOverrides: AdminEasyPostEnvOverridesDTO
    let from: AdminEasyPostFromDTO
}

/// `GET /stripe-publishable` — publishable key when configured in admin (otherwise empty).
struct PublicStripeConfigResponse: Decodable {
    let publishableKey: String
}

struct APIErrorBody: Decodable {
    let error: String?
    /// Extra server message (e.g. `admin/upload` exception text).
    let details: String?
    /// Correlate with Vercel logs: search `[admin/upload <id>]`.
    let uploadDebugId: String?

    /// Single string for alerts; includes reference id when the API sends it.
    var composedUserMessage: String {
        var parts: [String] = []
        if let e = error?.trimmingCharacters(in: .whitespacesAndNewlines), !e.isEmpty {
            parts.append(e)
        }
        if let d = details?.trimmingCharacters(in: .whitespacesAndNewlines), !d.isEmpty {
            parts.append(d)
        }
        if let id = uploadDebugId?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty {
            parts.append("Reference (search Vercel logs): \(id)")
        }
        if parts.isEmpty {
            return "Request failed"
        }
        return parts.joined(separator: "\n\n")
    }
}

struct EmptyResponse: Decodable {}

// MARK: - AnyCodable (minimal decode-only)

/// Minimal decode-only type to hold JSON `meta` dictionaries that may contain mixed values.
struct AnyCodable: Decodable, Hashable {
    let value: AnyHashable

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let s = try? c.decode(String.self) { value = AnyHashable(s); return }
        if let i = try? c.decode(Int.self) { value = AnyHashable(i); return }
        if let d = try? c.decode(Double.self) { value = AnyHashable(d); return }
        if let b = try? c.decode(Bool.self) { value = AnyHashable(b); return }
        value = AnyHashable("null")
    }
}

// MARK: - EasyPost admin

struct AdminBuyLabelResult: Decodable {
    let trackingCode: String?
    let labelUrl: String?
    let carrier: String?
    let service: String?
    let rateCents: Int?
    let trackerId: String?
    let shipmentId: String?
}

struct AdminBuyLabelResponse: Decodable {
    let label: AdminBuyLabelResult
}

// MARK: - Admin returns (`GET /admin/returns`, `GET/PATCH /admin/returns/:id`)

struct AdminReturnListRowDTO: Decodable, Identifiable {
    let id: String
    let orderId: String
    let userId: String?
    let email: String
    let totalCents: Int?
    let reason: String
    let notes: String?
    let status: String
    let returnLabelUrl: String?
    let adminNotes: String?
    let createdAt: String?
    let updatedAt: String?
}

struct AdminReturnsResponse: Decodable {
    let returns: [AdminReturnListRowDTO]
}

struct AdminReturnDetailDTO: Decodable {
    let id: String
    let orderId: String
    let userId: String?
    let email: String
    let totalCents: Int?
    let reason: String
    let notes: String?
    let status: String
    let items: [ReturnItemDTO]?
    let easypostReturnId: String?
    let returnLabelUrl: String?
    let adminNotes: String?
    let createdAt: String?
    let updatedAt: String?
    let shippingAddress: ShippingAddressDTO?
}

struct AdminReturnDetailResponse: Decodable {
    let `return`: AdminReturnDetailDTO
}

// MARK: - Product reviews (`GET` / `POST /products/:id/reviews`)

struct ProductReviewDTO: Decodable, Identifiable {
    let id: String
    let productId: String
    let userId: String
    let rating: Int
    let title: String?
    let body: String?
    let verifiedPurchase: Bool
    let createdAt: String?
}

struct ProductReviewsSummaryDTO: Decodable {
    let count: Int
    let average: Double
}

struct ProductReviewsResponse: Decodable {
    let summary: ProductReviewsSummaryDTO
    let reviews: [ProductReviewDTO]
}

struct ProductReviewResponse: Decodable {
    let review: ProductReviewDTO
}

// MARK: - Admin inventory audit (`GET /admin/inventory-audit`)

struct AdminInventoryAuditRowDTO: Decodable, Identifiable {
    let id: String
    let variantId: String
    let productName: String
    let size: String
    let delta: Int
    let reason: String
    let actorUserId: String?
    let orderId: String?
    let meta: [String: AnyCodable]?
    let createdAt: String?
}

struct AdminInventoryAuditResponse: Decodable {
    let rows: [AdminInventoryAuditRowDTO]
}

// MARK: - Admin inventory list & stock updates (`GET/PATCH /admin/inventory`)

struct AdminInventoryItemDTO: Decodable, Identifiable {
    var id: String { variantId }
    let variantId: String
    let productId: String
    let productName: String
    let category: String?
    let size: String
    let sku: String?
    let stock: Int
    let lowStock: Bool
    let imageRef: String?
}

struct AdminInventoryListResponse: Decodable {
    let items: [AdminInventoryItemDTO]
    let lowStockThreshold: Int?
}

// MARK: - Homepage CMS (`GET /homepage`, `GET/POST /admin/homepage`)

struct HomepageBannerDTO: Codable, Identifiable {
    var id: String { title + "|" + (imageUrl ?? "") }
    var title: String
    var subtitle: String?
    var imageUrl: String?
    var ctaLabel: String?
    /// App path, e.g. `shop?category=Dresses` or `product/<id>`; interpreted client-side.
    var ctaPath: String?
}

/// Synced with web `hero` in homepage CMS (`kenburns` | `fade` | `subtle-zoom` | `none`).
struct HomepageHeroDTO: Codable {
    var imageUrl: String?
    var animation: String?
    var eyebrow: String?
    var title: String?
    var subtitle: String?
    var ctaLabel: String?
    /// Website-style path, e.g. `/shop`
    var ctaHref: String?
}

struct HomepageCollectionDTO: Codable, Identifiable {
    var id: String { title + "|" + (query ?? "") }
    var title: String
    /// Query string appended to `/products`, e.g. `category=Dresses` or `featured=1`.
    var query: String?
}

struct HomepageContentDTO: Codable {
    var banners: [HomepageBannerDTO]
    var collections: [HomepageCollectionDTO]
    var hero: HomepageHeroDTO?
}

struct HomepageResponse: Decodable {
    let content: HomepageContentDTO
    let updatedAt: String?
}

// MARK: - Promo analytics (`GET /admin/promo-analytics`)

struct AdminPromoAnalyticsRowDTO: Decodable, Identifiable {
    let id: String
    let code: String
    let discountType: String
    let discountValue: Double?
    let redemptionCount: Int
    let discountCents: Int
    let totalCents: Int
    let lastRedeemedAt: String?
}

struct AdminPromoAnalyticsResponse: Decodable {
    let promos: [AdminPromoAnalyticsRowDTO]
}

// MARK: - Product CSV import/export (`GET` / `POST /admin/products-csv`)

struct AdminProductsCsvImportResponse: Decodable {
    let ok: Bool
    let createdProducts: Int?
    let updatedProducts: Int?
    let upsertedVariants: Int?
}

// MARK: - CMS pages (`GET /pages`)

struct ContentPageDetailResponse: Decodable {
    let page: ContentPageDTO
}

struct ContentPageDTO: Decodable {
    let id: String
    let slug: String
    let title: String
    let body: String
    let excerpt: String?
    let kind: String
    let publishedAt: String?
    let updatedAt: String?
}

// MARK: - Admin purchase orders (`GET|POST|PATCH /admin/purchase-orders`)

struct PurchaseOrderSummaryDTO: Decodable, Identifiable {
    let id: String
    let status: String
    let supplierName: String?
    let supplierOrderUrl: String?
    let supplierOrderNumber: String?
    let expectedAt: String?
    let notes: String?
    let createdAt: String?
    let updatedAt: String?
}

struct PurchaseOrdersListResponse: Decodable {
    let purchaseOrders: [PurchaseOrderSummaryDTO]
}

struct PurchaseOrderReorderSuggestionDTO: Decodable, Identifiable {
    var id: String { variantId }

    let productId: String
    let variantId: String
    let productName: String
    let size: String
    let sku: String?
    let stock: Int
    let supplierName: String?
    let supplierUrl: String?
    let unitCostCents: Int?
    let recommendedQty: Int
}

struct PurchaseOrderSuggestionsResponse: Decodable {
    let minStock: Int
    let suggestions: [PurchaseOrderReorderSuggestionDTO]
}

// MARK: - Admin gift cards (`GET|POST /admin/gift-cards`)

struct AdminGiftCardRowDTO: Decodable, Identifiable {
    let id: String
    let balanceCents: Int
    let currency: String?
    let recipientEmail: String?
    let internalNote: String?
    let expiresAt: String?
    let active: Bool
    let createdAt: String?
    let updatedAt: String?
    /// True when server can decrypt the code for staff (AES ciphertext on file).
    let recoveryAvailable: Bool?
}

struct AdminGiftCardsListResponse: Decodable {
    let giftCards: [AdminGiftCardRowDTO]
}

struct AdminGiftCardCreateResponse: Decodable {
    let ok: Bool
    let code: String
    let message: String?
}

struct AdminGiftCardDetailResponse: Decodable {
    let giftCard: AdminGiftCardRowDTO
    let revealedCode: String?
    let legacyNoCipher: Bool?
}

struct AdminGiftCardReissueResponse: Decodable {
    let ok: Bool
    let code: String
    let emailed: Bool
    let message: String?
}

// MARK: - Admin CMS pages (`GET|POST|PATCH|DELETE /admin/content-pages`)

struct AdminContentPageItemDTO: Codable, Identifiable {
    let id: String
    var slug: String
    var title: String
    var body: String
    var excerpt: String?
    var kind: String
    var published: Bool
    let publishedAt: String?
    let createdAt: String?
    let updatedAt: String?
}

struct AdminContentPagesListResponse: Decodable {
    let items: [AdminContentPageItemDTO]
}

// MARK: - Admin promo / discount codes (`GET|POST /admin/promos`)

struct PromoCodeAdminRowDTO: Decodable, Identifiable {
    let id: String
    let code: String
    let discountType: String
    let discountValue: Int
    let maxUses: Int?
    let usesCount: Int
    let expiresAt: String?
    let active: Bool
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, code, active
        case discountType = "discount_type"
        case discountValue = "discount_value"
        case maxUses = "max_uses"
        case usesCount = "uses_count"
        case expiresAt = "expires_at"
        case createdAt = "created_at"
    }
}

struct PromoCodesListResponse: Decodable {
    let promos: [PromoCodeAdminRowDTO]
}

struct PromoCodeCreatedDTO: Decodable {
    let id: String
    let code: String
    let discountType: String
    let discountValue: Int
    let maxUses: Int?
    let expiresAt: String?

    enum CodingKeys: String, CodingKey {
        case id, code
        case discountType = "discount_type"
        case discountValue = "discount_value"
        case maxUses = "max_uses"
        case expiresAt = "expires_at"
    }
}

struct PromoCodeCreateResponse: Decodable {
    let promo: PromoCodeCreatedDTO
}

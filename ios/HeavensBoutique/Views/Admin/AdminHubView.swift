import SwiftUI
import UIKit

private enum AdminHubSection: String, CaseIterable, Identifiable, Hashable {
    case overview
    case products
    case inventory
    case orders
    case customers
    case returns
    case discountCodes
    case giftCards
    case pagesJournal
    case marketing
    case reports
    case staff

    var id: String { rawValue }

    var title: String {
        switch self {
        case .overview: return "Overview"
        case .products: return "Products"
        case .inventory: return "Inventory"
        case .orders: return "Orders"
        case .customers: return "Customers"
        case .returns: return "Returns"
        case .discountCodes: return "Discount codes"
        case .giftCards: return "Gift cards"
        case .pagesJournal: return "Pages & journal"
        case .marketing: return "Marketing"
        case .reports: return "Reports"
        case .staff: return "Staff"
        }
    }

    var symbol: String {
        switch self {
        case .overview: return "square.grid.2x2.fill"
        case .products: return "tag.fill"
        case .inventory: return "cube.box.fill"
        case .orders: return "shippingbox.fill"
        case .customers: return "person.2.fill"
        case .returns: return "arrow.uturn.backward.circle.fill"
        case .discountCodes: return "percent"
        case .giftCards: return "gift.fill"
        case .pagesJournal: return "doc.richtext.fill"
        case .marketing: return "megaphone.fill"
        case .reports: return "chart.bar.doc.horizontal.fill"
        case .staff: return "person.3.fill"
        }
    }
}

/// Store admin: catalog snapshot, orders, customer notifications; Products, Inventory, and Customers mirror a lightweight retail admin flow. Open from Home (gear), Profile, Settings, or long-press the wordmark.
struct AdminHubView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var appModel: AppModel
    @State private var products: [ProductDTO] = []
    @State private var orders: [OrderDTO] = []
    @State private var isLoading = false
    /// Optional binding is required for `List(selection:)` on iOS (non-optional overload is not available on iOS).
    @State private var selection: AdminHubSection? = .overview
    @State private var showNewProduct = false
    @State private var showAddCustomer = false
    @State private var showManualOrder = false
    @State private var customersRefreshNonce = 0

    private var activeSection: AdminHubSection { selection ?? .overview }

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Section {
                    ForEach(AdminHubSection.allCases.filter { hubSectionVisible($0, user: appModel.session.user) }) { section in
                        Label(section.title, systemImage: section.symbol)
                            .tag(section)
                    }
                }
            }
            .listStyle(.sidebar)
            .navigationTitle("Admin")
            .navigationBarTitleDisplayMode(.inline)
        } detail: {
            NavigationStack {
                detailPane
                    .hbScreenBackground()
                    .navigationTitle(activeSection.title)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Close") { dismiss() }
                        }
                        ToolbarItem(placement: .primaryAction) {
                            HStack(spacing: 16) {
                                if activeSection == .products, appModel.session.user?.hasStaffPermission("products") == true {
                                    Button {
                                        showNewProduct = true
                                    } label: {
                                        Image(systemName: "plus.circle.fill")
                                    }
                                    .accessibilityLabel("Add product")
                                }
                                if activeSection == .orders, appModel.session.user?.hasStaffPermission("orders") == true {
                                    Button {
                                        showManualOrder = true
                                    } label: {
                                        Image(systemName: "plus.circle.fill")
                                    }
                                    .accessibilityLabel("Add order")
                                }
                                if activeSection == .customers, appModel.session.user?.hasStaffPermission("customers") == true {
                                    Button {
                                        showAddCustomer = true
                                    } label: {
                                        Image(systemName: "person.badge.plus")
                                    }
                                    .accessibilityLabel("Add customer")
                                }
                                Button {
                                    Task { await reload() }
                                } label: {
                                    Image(systemName: "arrow.clockwise")
                                }
                                .accessibilityLabel("Refresh")
                            }
                        }
                    }
            }
            .task { await reload() }
            .sheet(isPresented: $showNewProduct, onDismiss: { Task { await reload() } }) {
                NavigationStack {
                    AdminProductEditorView(productId: nil, onCatalogChanged: { Task { await reload() } })
                        .environmentObject(api)
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Close") { showNewProduct = false }
                            }
                        }
                }
            }
            .sheet(isPresented: $showAddCustomer, onDismiss: { customersRefreshNonce += 1 }) {
                NavigationStack {
                    AdminAddCustomerView(onCreated: { customersRefreshNonce += 1 })
                        .environmentObject(api)
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Close") { showAddCustomer = false }
                            }
                        }
                }
            }
            .sheet(isPresented: $showManualOrder, onDismiss: { Task { await reload() } }) {
                NavigationStack {
                    AdminManualOrderView(products: products, onCreated: { Task { await reload() } })
                        .environmentObject(api)
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Close") { showManualOrder = false }
                            }
                        }
                }
            }
        }
        .navigationSplitViewStyle(.balanced)
    }

    @ViewBuilder
    private var detailPane: some View {
        Group {
            switch activeSection {
            case .overview:
                ScrollView {
                    VStack(spacing: 0) {
                        customerPreviewEntry
                        storeManagementQuickActions
                        settingsRow
                    }
                }
            case .products:
                productSection
            case .inventory:
                AdminInventoryHubView()
                    .environmentObject(api)
            case .orders:
                orderSection
            case .returns:
                AdminReturnsView()
                    .environmentObject(api)
            case .discountCodes:
                AdminDiscountCodesView()
                    .environmentObject(api)
            case .giftCards:
                AdminGiftCardsView()
                    .environmentObject(api)
            case .pagesJournal:
                AdminContentPagesCMSView()
                    .environmentObject(api)
            case .reports:
                AdminFinancialReportsView()
                    .environmentObject(api)
            case .staff:
                AdminStaffManagementView()
                    .environmentObject(api)
            case .customers:
                AdminCustomersView(refreshNonce: customersRefreshNonce)
                    .environmentObject(api)
            case .marketing:
                AdminNotifyComposerView(customersListRefreshNonce: customersRefreshNonce)
                    .environmentObject(api)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var stripeSettingsEntry: some View {
        NavigationLink {
            AdminStripeSettingsView()
                .environmentObject(api)
        } label: {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: "key.horizontal.fill")
                    .font(.title2)
                    .foregroundStyle(HBColors.gold)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Stripe & payments")
                        .font(HBFont.headline())
                        .foregroundStyle(HBColors.charcoal)
                    Text("Publishable, secret, and webhook signing keys for checkout.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(HBColors.mutedGray)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(HBColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityHint("Configure Stripe keys for the store.")
    }

    private var easypostSettingsEntry: some View {
        NavigationLink {
            AdminEasyPostSettingsView()
                .environmentObject(api)
        } label: {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: "shippingbox.fill")
                    .font(.title2)
                    .foregroundStyle(HBColors.gold)
                VStack(alignment: .leading, spacing: 4) {
                    Text("EasyPost & shipping labels")
                        .font(HBFont.headline())
                        .foregroundStyle(HBColors.charcoal)
                    Text("API key and origin address for shipping + return labels.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(HBColors.mutedGray)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(HBColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityHint("Configure EasyPost shipping label settings.")
    }

    /// Prominent shortcuts: add catalog items, adjust on-hand counts, invite customers.
    private var storeManagementQuickActions: some View {
        Group {
            if let user = appModel.session.user {
                VStack(alignment: .leading, spacing: 10) {
                    Text("STORE")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(HBColors.mutedGray)
                        .tracking(0.6)
                        .padding(.leading, 4)
                    HStack(spacing: 10) {
                        if user.hasStaffPermission("products") {
                            Button {
                                showNewProduct = true
                            } label: {
                                storeQuickTile(
                                    icon: "plus.square.fill.on.square.fill",
                                    title: "Product",
                                    subtitle: "Add to catalog"
                                )
                            }
                            .buttonStyle(.plain)
                        }

                        if user.hasAnyStaffPermission(["inventory", "products"]) {
                            NavigationLink {
                                AdminInventoryQuantitiesView()
                                    .environmentObject(api)
                            } label: {
                                storeQuickTile(icon: "cube.box.fill", title: "Inventory", subtitle: "Stock counts")
                            }
                            .buttonStyle(.plain)
                        }

                        if user.hasStaffPermission("customers") {
                            Button {
                                selection = .customers
                                showAddCustomer = true
                            } label: {
                                storeQuickTile(icon: "person.fill.badge.plus", title: "Customer", subtitle: "Create account")
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 4)
            }
        }
    }

    private func storeQuickTile(icon: String, title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(HBColors.gold)
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(HBColors.charcoal)
            Text(subtitle)
                .font(.caption2)
                .foregroundStyle(HBColors.mutedGray)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(HBColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color.black.opacity(0.06), lineWidth: 1)
        )
    }

    private var settingsRow: some View {
        Group {
            if let user = appModel.session.user {
                VStack(spacing: 10) {
                    if user.hasStaffPermission("settings") {
                        stripeSettingsEntry
                        easypostSettingsEntry
                    }
                    if user.hasAnyStaffPermission(["inventory", "products"]) {
                        inventoryCountsEntry
                        inventoryAuditEntry
                    }
                    if user.hasStaffPermission("homepage") {
                        homepageCmsEntry
                    }
                    if user.hasStaffPermission("promoAnalytics") {
                        promoAnalyticsEntry
                    }
                    if user.hasStaffPermission("productsCsv") {
                        productsCsvEntry
                    }
                    if user.hasStaffPermission("purchaseOrders") {
                        purchaseOrdersEntry
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 4)
            }
        }
    }

    private var inventoryCountsEntry: some View {
        NavigationLink {
            AdminInventoryQuantitiesView()
                .environmentObject(api)
        } label: {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: "cube.box.fill")
                    .font(.title2)
                    .foregroundStyle(HBColors.gold)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Inventory quantities")
                        .font(HBFont.headline())
                        .foregroundStyle(HBColors.charcoal)
                    Text("Adjust on-hand counts per size/SKU.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(HBColors.mutedGray)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(HBColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityHint("Adjust stock quantities quickly.")
    }

    private var inventoryAuditEntry: some View {
        NavigationLink {
            AdminInventoryAuditView()
                .environmentObject(api)
        } label: {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: "list.bullet.clipboard.fill")
                    .font(.title2)
                    .foregroundStyle(HBColors.gold)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Inventory activity log")
                        .font(HBFont.headline())
                        .foregroundStyle(HBColors.charcoal)
                    Text("Audit trail of stock changes from orders and edits.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(HBColors.mutedGray)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(HBColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityHint("View inventory audit log.")
    }

    private var homepageCmsEntry: some View {
        NavigationLink {
            AdminHomepageCMSView()
                .environmentObject(api)
        } label: {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: "sparkles.rectangle.stack.fill")
                    .font(.title2)
                    .foregroundStyle(HBColors.gold)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Store home")
                        .font(HBFont.headline())
                        .foregroundStyle(HBColors.charcoal)
                    Text("Top photo for website + app; swipe promos and product rows on the app. No tech skills needed.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(HBColors.mutedGray)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(HBColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityHint("Edit store home photos and app promos.")
    }

    private var promoAnalyticsEntry: some View {
        NavigationLink {
            AdminPromoAnalyticsView()
                .environmentObject(api)
        } label: {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: "tag.fill")
                    .font(.title2)
                    .foregroundStyle(HBColors.gold)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Discount analytics")
                        .font(HBFont.headline())
                        .foregroundStyle(HBColors.charcoal)
                    Text("Track code usage, discount totals, and revenue.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(HBColors.mutedGray)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(HBColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityHint("View discount code analytics.")
    }

    private var productsCsvEntry: some View {
        NavigationLink {
            AdminProductsCSVView()
                .environmentObject(api)
        } label: {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: "tablecells.fill")
                    .font(.title2)
                    .foregroundStyle(HBColors.gold)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Bulk CSV import/export")
                        .font(HBFont.headline())
                        .foregroundStyle(HBColors.charcoal)
                    Text("Move products and variants in bulk.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(HBColors.mutedGray)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(HBColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityHint("Bulk import/export products using CSV.")
    }

    private var purchaseOrdersEntry: some View {
        NavigationLink {
            AdminPurchaseOrdersView()
                .environmentObject(api)
        } label: {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: "doc.text.fill")
                    .font(.title2)
                    .foregroundStyle(HBColors.gold)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Purchase orders")
                        .font(HBFont.headline())
                        .foregroundStyle(HBColors.charcoal)
                    Text("Any vendor — track orders; mark received to bump stock.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(HBColors.mutedGray)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(HBColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityHint("Manage purchase orders and receiving.")
    }

    private var customerPreviewEntry: some View {
        Button {
            appModel.customerViewPreview = true
            dismiss()
            HBFeedback.light()
        } label: {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("View as customer")
                        .font(HBFont.headline())
                        .foregroundStyle(HBColors.charcoal)
                    Text("Hides admin controls and loads your personal messages. Use the banner or Profile to exit.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Image(systemName: "eye.circle.fill")
                    .font(.title2)
                    .foregroundStyle(HBColors.gold)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(HBColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .padding(.horizontal)
        .padding(.top, 8)
        .padding(.bottom, 4)
        .accessibilityHint("Closes admin and shows the shopper experience.")
    }

    private var productSection: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Tap a product to edit images, pricing, variants, supplier, and details. Use + or Store management for a new product.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)

                if isLoading && products.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 32)
                } else if products.isEmpty {
                    HBEmptyState(
                        systemImage: "tag",
                        title: "No products yet",
                        message: "Tap + to add your first product to the catalog.",
                        retryTitle: nil,
                        retry: nil
                    )
                    .frame(maxWidth: .infinity)
                    .padding(.top, 16)
                }

                ForEach(products) { p in
                    NavigationLink {
                        AdminProductEditorView(productId: p.id, onCatalogChanged: { Task { await reload() } })
                            .environmentObject(api)
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(p.name)
                                .font(HBFont.headline())
                                .foregroundStyle(HBColors.charcoal)
                            Text(p.category)
                                .font(HBFont.caption())
                                .foregroundStyle(HBColors.mutedGray)
                            Text("\(p.variants.count) sizes · total stock \(p.variants.map(\.stock).reduce(0, +))")
                                .font(HBFont.caption())
                                .foregroundStyle(HBColors.gold)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .hbCardStyle()
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding()
        }
    }

    private var orderSection: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if isLoading && orders.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 32)
                } else if orders.isEmpty {
                    HBEmptyState(
                        systemImage: "shippingbox",
                        title: "No orders yet",
                        message: "Orders will appear here once customers start checking out.",
                        retryTitle: nil,
                        retry: nil
                    )
                    .frame(maxWidth: .infinity)
                    .padding(.top, 16)
                }

                ForEach(orders) { o in
                    NavigationLink {
                        AdminOrderDetailView(orderId: o.id)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(o.status.replacingOccurrences(of: "_", with: " ").capitalized)
                                .font(HBFont.headline())
                                .foregroundStyle(HBColors.charcoal)
                            if let email = o.userEmail {
                                Text(email)
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.mutedGray)
                            }
                            Text(NumberFormatter.localizedString(from: NSNumber(value: Double(o.totalCents) / 100), number: .currency))
                                .font(HBFont.caption())
                                .foregroundStyle(HBColors.gold)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .hbCardStyle()
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding()
        }
    }

    private func hubSectionVisible(_ section: AdminHubSection, user: UserDTO?) -> Bool {
        guard let user else { return false }
        switch section {
        case .staff: return user.isStoreOwner
        case .overview: return user.canOpenAdminPortal
        case .products: return user.hasStaffPermission("products")
        case .inventory: return user.hasAnyStaffPermission(["inventory", "products"])
        case .orders: return user.hasStaffPermission("orders")
        case .customers: return user.hasStaffPermission("customers")
        case .returns: return user.hasStaffPermission("returns")
        case .discountCodes: return user.hasStaffPermission("discounts")
        case .giftCards: return user.hasStaffPermission("giftCards")
        case .pagesJournal: return user.hasStaffPermission("content")
        case .marketing: return user.hasStaffPermission("marketing")
        case .reports: return user.hasStaffPermission("reports")
        }
    }

    private func reload() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let pr: ProductsResponse = try await api.request("/products", method: "GET")
            products = pr.products
            let or: OrdersResponse = try await api.request("/orders?all=1", method: "GET")
            orders = or.orders
            customersRefreshNonce += 1
        } catch {
            #if DEBUG
            print("[AdminHubView] reload failed: \(error)")
            #endif
        }
    }
}

// MARK: - Gift cards (store credit)

struct AdminGiftCardsView: View {
    @EnvironmentObject private var api: APIClient

    @State private var rows: [AdminGiftCardRowDTO] = []
    @State private var isLoading = false
    @State private var error: String?

    @State private var amountText = "25"
    @State private var recipientEmail = ""
    @State private var internalNote = ""
    @State private var saving = false
    @State private var createdCode: String?
    /// Face value shown on the issued certificate (matches what was just created).
    @State private var issuedBalanceCents: Int?

    @State private var recoverySheetRow: AdminGiftCardRowDTO?
    @State private var recoveryDetail: AdminGiftCardDetailResponse?
    @State private var recoveryFetchError: String?
    @State private var reissueBusy = false
    @State private var confirmReplaceCode = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Create store-credit codes. The full code is shown once — copy it to email the customer.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)

                if let createdCode {
                    VStack(spacing: 14) {
                        GiftCardIssuedCertificate(
                            code: createdCode,
                            balanceText: formatMoney(issuedBalanceCents ?? 0)
                        )

                        Button {
                            UIPasteboard.general.string = createdCode
                            HBFeedback.light()
                        } label: {
                            Label("Copy code", systemImage: "doc.on.doc")
                                .font(HBFont.caption().weight(.semibold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(HBColors.gold.opacity(0.92))
                                .foregroundStyle(HBColors.charcoal)
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                .shadow(color: HBColors.gold.opacity(0.35), radius: 12, y: 4)
                        }
                        .buttonStyle(.plain)
                    }
                }

                GiftCardIssueFoilPanel(
                    title: "Issue a new card",
                    subtitle: "Balance is stored as store credit. The customer redeems this code at checkout."
                ) {
                    TextField(
                        text: $amountText,
                        prompt: Text("Amount (USD)").foregroundStyle(HBGiftCardFoil.fieldPlaceholder)
                    ) {
                        Text("Amount in USD")
                    }
                    .keyboardType(.decimalPad)
                    .foregroundStyle(HBGiftCardFoil.fieldText)
                    .tint(HBGiftCardFoil.fieldTint)
                    .padding()
                    .background(Color.white.opacity(0.95))
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(Color.black.opacity(0.08), lineWidth: 1)
                    )

                    TextField(
                        text: $recipientEmail,
                        prompt: Text("Recipient email (optional)").foregroundStyle(HBGiftCardFoil.fieldPlaceholder)
                    ) {
                        Text("Recipient email (optional)")
                    }
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .foregroundStyle(HBGiftCardFoil.fieldText)
                    .tint(HBGiftCardFoil.fieldTint)
                    .padding()
                    .background(Color.white.opacity(0.95))
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(Color.black.opacity(0.08), lineWidth: 1)
                    )

                    TextField(
                        text: $internalNote,
                        prompt: Text("Internal note (optional)").foregroundStyle(HBGiftCardFoil.fieldPlaceholder)
                    ) {
                        Text("Internal note (optional)")
                    }
                    .foregroundStyle(HBGiftCardFoil.fieldText)
                    .tint(HBGiftCardFoil.fieldTint)
                    .padding()
                    .background(Color.white.opacity(0.95))
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(Color.black.opacity(0.08), lineWidth: 1)
                    )

                    Button {
                        Task { await createCard() }
                    } label: {
                        Text(saving ? "Creating…" : "Create gift card")
                            .font(HBFont.caption().weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(HBColors.gold.opacity(0.92))
                            .foregroundStyle(HBColors.charcoal)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .shadow(color: HBColors.gold.opacity(0.3), radius: 12, y: 4)
                    }
                    .disabled(saving)
                }

                if let error {
                    Text(error)
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.rosePink)
                }

                Divider()

                Text("Issued cards")
                    .font(HBFont.headline())
                    .foregroundStyle(HBColors.charcoal)

                Text(
                    "If a customer loses their code, verify their purchase then reveal (encrypted cards) or replace the code. Replacement invalidates the old code."
                )
                .font(HBFont.caption())
                .foregroundStyle(HBColors.mutedGray)

                if isLoading && rows.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, 24)
                } else if rows.isEmpty {
                    Text("No gift cards yet.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                } else {
                    ForEach(rows) { row in
                        giftCardRow(row)
                    }
                }
            }
            .padding()
        }
        .hbScreenBackground()
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: $recoverySheetRow, onDismiss: {
            recoveryDetail = nil
            recoveryFetchError = nil
            confirmReplaceCode = false
        }) { row in
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        if let recoveryFetchError {
                            Text(recoveryFetchError)
                                .font(HBFont.caption())
                                .foregroundStyle(HBColors.rosePink)
                        } else if let d = recoveryDetail {
                            if d.legacyNoCipher == true {
                                Text(
                                    "This card predates encrypted recovery. Issue a replacement — the old code stops working."
                                )
                                .font(HBFont.caption())
                                .foregroundStyle(HBColors.charcoal)
                            } else if let code = d.revealedCode, !code.isEmpty {
                                Text("Code")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(HBColors.mutedGray)
                                Text(code)
                                    .font(.system(.body, design: .monospaced))
                                    .fontWeight(.semibold)
                                    .textSelection(.enabled)
                                Button {
                                    UIPasteboard.general.string = code
                                    HBFeedback.light()
                                } label: {
                                    Label("Copy code", systemImage: "doc.on.doc")
                                        .font(HBFont.caption().weight(.semibold))
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 12)
                                        .background(HBColors.gold.opacity(0.92))
                                        .foregroundStyle(HBColors.charcoal)
                                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                }
                                .buttonStyle(.plain)
                            } else {
                                Text(
                                    "Could not decrypt — use Replace code so the customer receives a working code."
                                )
                                .font(HBFont.caption())
                                .foregroundStyle(HBColors.rosePink)
                            }

                            Button {
                                confirmReplaceCode = true
                            } label: {
                                Text(reissueBusy ? "Working…" : "Replace code (invalidate old)")
                                    .font(HBFont.caption().weight(.semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .background(Color.red.opacity(0.12))
                                    .foregroundStyle(Color.red.opacity(0.92))
                                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .disabled(reissueBusy)
                        } else {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 24)
                        }
                    }
                    .padding()
                }
                .navigationTitle("Gift card recovery")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") {
                            recoverySheetRow = nil
                        }
                    }
                }
                .task(id: row.id) {
                    recoveryFetchError = nil
                    recoveryDetail = nil
                    do {
                        let d: AdminGiftCardDetailResponse = try await api.request(
                            "/admin/gift-cards/\(row.id)",
                            method: "GET"
                        )
                        recoveryDetail = d
                    } catch {
                        recoveryFetchError = error.localizedDescription
                    }
                }
                .confirmationDialog(
                    "Replace gift card code?",
                    isPresented: $confirmReplaceCode,
                    titleVisibility: .visible
                ) {
                    Button("Replace", role: .destructive) {
                        Task { await performReissue(id: row.id) }
                    }
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text("The previous code will stop working. If an email is on file, we’ll send the new code.")
                }
            }
        }
    }

    private func giftCardRow(_ row: AdminGiftCardRowDTO) -> some View {
        let subtitle: String = {
            var lines: [String] = ["ID \(String(row.id.prefix(8)))…"]
            if let e = row.recipientEmail, !e.isEmpty { lines.append(e) }
            if let n = row.internalNote, !n.isEmpty { lines.append(n) }
            if row.recoveryAvailable == false {
                lines.append("Legacy row — replace to enable recovery")
            }
            lines.append("Created \(row.createdAt ?? "—")")
            return lines.joined(separator: "\n")
        }()

        return VStack(alignment: .leading, spacing: 10) {
            GiftCardBalanceChipRow(
                balanceText: formatMoney(row.balanceCents),
                active: row.active,
                subtitle: subtitle
            )
            Button {
                recoverySheetRow = row
            } label: {
                Text("Reveal / replace")
                    .font(HBFont.caption().weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.white.opacity(0.92))
                    .foregroundStyle(HBColors.charcoal)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
        }
    }

    private func performReissue(id: String) async {
        guard !reissueBusy else { return }
        reissueBusy = true
        defer { reissueBusy = false }
        do {
            let _: AdminGiftCardReissueResponse = try await api.request(
                "/admin/gift-cards/\(id)/reissue",
                method: "POST",
                jsonBody: ["sendEmail": true]
            )
            HBFeedback.success()
            recoverySheetRow = nil
            await load()
        } catch {
            HBFeedback.warning()
            recoveryFetchError = error.localizedDescription
        }
    }

    private func formatMoney(_ cents: Int) -> String {
        NumberFormatter.localizedString(from: NSNumber(value: Double(cents) / 100), number: .currency)
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        error = nil
        do {
            let r: AdminGiftCardsListResponse = try await api.request("/admin/gift-cards", method: "GET")
            rows = r.giftCards
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func createCard() async {
        saving = true
        error = nil
        createdCode = nil
        issuedBalanceCents = nil
        defer { saving = false }

        let dollars = Double(amountText.replacingOccurrences(of: ",", with: ".")) ?? 0
        let cents = Int((dollars * 100).rounded())
        guard cents > 0 else {
            error = "Enter a valid amount."
            HBFeedback.warning()
            return
        }

        var body: [String: Any] = [
            "initialBalanceCents": cents,
        ]
        let em = recipientEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        let note = internalNote.trimmingCharacters(in: .whitespacesAndNewlines)
        if !em.isEmpty { body["recipientEmail"] = em }
        if !note.isEmpty { body["internalNote"] = note }

        do {
            let r: AdminGiftCardCreateResponse = try await api.request("/admin/gift-cards", method: "POST", jsonBody: body)
            createdCode = r.code
            issuedBalanceCents = cents
            recipientEmail = ""
            internalNote = ""
            HBFeedback.success()
            await load()
        } catch {
            self.error = error.localizedDescription
            HBFeedback.warning()
        }
    }
}

// MARK: - Discount codes (checkout promos)

struct AdminDiscountCodesView: View {
    @EnvironmentObject private var api: APIClient

    @State private var promos: [PromoCodeAdminRowDTO] = []
    @State private var isLoading = false
    @State private var error: String?

    @State private var newCode = ""
    @State private var discountKind: DiscountKind = .percent
    @State private var valueText = "10"
    @State private var maxUsesText = ""
    @State private var saving = false

    private enum DiscountKind: String, CaseIterable {
        case percent
        case fixed

        var label: String {
            switch self {
            case .percent: return "Percent off"
            case .fixed: return "Fixed amount ($)"
            }
        }

        var apiType: String {
            switch self {
            case .percent: return "percent"
            case .fixed: return "fixed_cents"
            }
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Create checkout promo codes. Customers enter the code at checkout.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)

                VStack(alignment: .leading, spacing: 12) {
                    Text("New discount code")
                        .font(HBFont.headline())
                        .foregroundStyle(HBColors.charcoal)

                    TextField("CODE", text: $newCode)
                        .textInputAutocapitalization(.characters)
                        .padding()
                        .background(HBColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    Picker("Type", selection: $discountKind) {
                        ForEach(DiscountKind.allCases, id: \.self) { k in
                            Text(k.label).tag(k)
                        }
                    }
                    .pickerStyle(.segmented)

                    TextField(discountKind == .percent ? "Percent (e.g. 15)" : "Dollars (e.g. 5)", text: $valueText)
                        .keyboardType(.decimalPad)
                        .padding()
                        .background(HBColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    TextField("Max uses (optional)", text: $maxUsesText)
                        .keyboardType(.numberPad)
                        .padding()
                        .background(HBColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    Button {
                        Task { await createPromo() }
                    } label: {
                        Text(saving ? "Saving…" : "Create discount")
                            .font(HBFont.caption().weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(HBColors.gold.opacity(0.35))
                            .foregroundStyle(HBColors.charcoal)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .disabled(saving)
                }

                if let error {
                    Text(error)
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.rosePink)
                }

                Divider()

                Text("Active codes")
                    .font(HBFont.headline())
                    .foregroundStyle(HBColors.charcoal)

                if isLoading && promos.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, 24)
                } else if promos.isEmpty {
                    Text("No promo codes yet.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                } else {
                    ForEach(promos) { p in
                        promoRow(p)
                    }
                }
            }
            .padding()
        }
        .hbScreenBackground()
        .task { await load() }
        .refreshable { await load() }
    }

    private func promoRow(_ p: PromoCodeAdminRowDTO) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(p.code)
                    .font(HBFont.headline())
                    .foregroundStyle(HBColors.charcoal)
                Spacer()
                Text(p.active ? "Active" : "Off")
                    .font(HBFont.caption().weight(.semibold))
                    .foregroundStyle(p.active ? HBColors.gold : HBColors.mutedGray)
            }
            Text(summary(p))
                .font(HBFont.caption())
                .foregroundStyle(HBColors.mutedGray)
            Text("Uses \(p.usesCount)" + (p.maxUses != nil ? " / \(p.maxUses!)" : ""))
                .font(HBFont.caption())
                .foregroundStyle(HBColors.mutedGray)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .hbCardStyle()
    }

    private func summary(_ p: PromoCodeAdminRowDTO) -> String {
        if p.discountType == "percent" {
            return "\(p.discountValue)% off order"
        }
        let dollars = Double(p.discountValue) / 100
        return String(format: "$%.2f off order", dollars)
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        error = nil
        do {
            let r: PromoCodesListResponse = try await api.request("/admin/promos", method: "GET")
            promos = r.promos
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func createPromo() async {
        saving = true
        error = nil
        defer { saving = false }

        let code = newCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard code.count >= 2 else {
            error = "Enter a promo code."
            HBFeedback.warning()
            return
        }

        var discountValue: Int
        if discountKind == .percent {
            let v = Double(valueText.replacingOccurrences(of: ",", with: ".")) ?? 0
            guard v > 0, v <= 100 else {
                error = "Enter a percent between 1 and 100."
                HBFeedback.warning()
                return
            }
            discountValue = Int(v.rounded())
        } else {
            let dollars = Double(valueText.replacingOccurrences(of: ",", with: ".")) ?? 0
            let cents = Int((dollars * 100).rounded())
            guard cents > 0 else {
                error = "Enter a dollar amount."
                HBFeedback.warning()
                return
            }
            discountValue = cents
        }

        var body: [String: Any] = [
            "code": code,
            "discountType": discountKind.apiType,
            "discountValue": discountValue,
        ]
        if let m = Int(maxUsesText.trimmingCharacters(in: .whitespacesAndNewlines)), m > 0 {
            body["maxUses"] = m
        }

        do {
            let _: PromoCodeCreateResponse = try await api.request("/admin/promos", method: "POST", jsonBody: body)
            newCode = ""
            valueText = discountKind == .percent ? "10" : "5"
            maxUsesText = ""
            HBFeedback.success()
            await load()
        } catch {
            self.error = error.localizedDescription
            HBFeedback.warning()
        }
    }
}

// MARK: - Pages & journal (Online store content)

struct AdminContentPagesCMSView: View {
    @EnvironmentObject private var api: APIClient

    @State private var items: [AdminContentPageItemDTO] = []
    @State private var isLoading = false
    @State private var listError: String?
    @State private var editing: ContentPageEditorPayload?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Edit storefront pages and journal posts.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)

                HStack(spacing: 10) {
                    Button("New page") {
                        editing = ContentPageEditorPayload.new(kind: "page")
                    }
                    .font(HBFont.caption().weight(.semibold))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(HBColors.gold.opacity(0.35))
                    .foregroundStyle(HBColors.charcoal)
                    .clipShape(Capsule())

                    Button("New journal post") {
                        editing = ContentPageEditorPayload.new(kind: "blog")
                    }
                    .font(HBFont.caption().weight(.semibold))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(HBColors.chipIdleBackground)
                    .foregroundStyle(HBColors.charcoal)
                    .clipShape(Capsule())
                }

                if let listError {
                    Text(listError)
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.rosePink)
                }

                if isLoading && items.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, 32)
                } else if items.isEmpty {
                    Text("No pages yet.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                } else {
                    ForEach(items) { item in
                        Button {
                            editing = ContentPageEditorPayload.existing(item)
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(item.title.isEmpty ? item.slug : item.title)
                                        .font(HBFont.headline())
                                        .foregroundStyle(HBColors.charcoal)
                                    Spacer()
                                    Text(item.kind == "blog" ? "Journal" : "Page")
                                        .font(HBFont.caption().weight(.semibold))
                                        .foregroundStyle(HBColors.gold)
                                }
                                Text("/" + item.slug)
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.mutedGray)
                                Text(item.published ? "Published" : "Draft")
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.mutedGray)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding()
                            .hbCardStyle()
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding()
        }
        .hbScreenBackground()
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: $editing) { payload in
            ContentPageEditorContainerView(payload: payload, api: api) {
                editing = nil
                Task { await load() }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .adminContentPagesDidChange)) { _ in
            Task { await load() }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        listError = nil
        do {
            let r: AdminContentPagesListResponse = try await api.request("/admin/content-pages", method: "GET")
            items = r.items
        } catch {
            listError = error.localizedDescription
        }
    }
}

private struct ContentPageEditorPayload: Identifiable {
    let id: UUID
    let serverId: String?
    var slug: String
    var title: String
    var body: String
    var excerpt: String
    var kind: String
    var published: Bool

    static func new(kind: String) -> ContentPageEditorPayload {
        ContentPageEditorPayload(
            id: UUID(),
            serverId: nil,
            slug: "",
            title: "",
            body: "",
            excerpt: "",
            kind: kind,
            published: false
        )
    }

    static func existing(_ dto: AdminContentPageItemDTO) -> ContentPageEditorPayload {
        ContentPageEditorPayload(
            id: UUID(),
            serverId: dto.id,
            slug: dto.slug,
            title: dto.title,
            body: dto.body,
            excerpt: dto.excerpt ?? "",
            kind: dto.kind,
            published: dto.published
        )
    }

    var isCreating: Bool { serverId == nil }
}

private struct ContentPageEditorContainerView: View {
    let payload: ContentPageEditorPayload
    let api: APIClient
    var onDone: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var slug: String
    @State private var title: String
    @State private var bodyText: String
    @State private var excerpt: String
    @State private var kind: String
    @State private var published: Bool
    @State private var saving = false
    @State private var error: String?

    init(payload: ContentPageEditorPayload, api: APIClient, onDone: @escaping () -> Void) {
        self.payload = payload
        self.api = api
        self.onDone = onDone
        _slug = State(initialValue: payload.slug)
        _title = State(initialValue: payload.title)
        _bodyText = State(initialValue: payload.body)
        _excerpt = State(initialValue: payload.excerpt)
        _kind = State(initialValue: payload.kind)
        _published = State(initialValue: payload.published)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let error {
                        Text(error)
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.rosePink)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("URL path")
                            .font(HBFont.caption().weight(.semibold))
                            .foregroundStyle(HBColors.charcoal.opacity(0.65))
                        Text("Lowercase, hyphens — becomes the page or post link (e.g. /pages/shipping-policy).")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                        TextField("shipping-policy", text: $slug)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding()
                            .background(HBColors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }

                    TextField("Title", text: $title)
                        .padding()
                        .background(HBColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    Picker("Kind", selection: $kind) {
                        Text("Page").tag("page")
                        Text("Journal").tag("blog")
                    }
                    .pickerStyle(.segmented)

                    TextField("Excerpt (optional)", text: $excerpt, axis: .vertical)
                        .lineLimit(2 ... 4)
                        .padding()
                        .background(HBColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    Text("Body")
                        .font(HBFont.caption().weight(.semibold))
                        .foregroundStyle(HBColors.charcoal)

                    TextEditor(text: $bodyText)
                        .frame(minHeight: 180)
                        .padding(8)
                        .background(HBColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    Toggle("Published", isOn: $published)
                }
                .padding()
            }
            .hbScreenBackground()
            .navigationTitle(payload.isCreating ? "New" : "Edit page")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "…" : "Save") {
                        Task { await save() }
                    }
                    .disabled(saving)
                }
            }
        }
    }

    private func save() async {
        saving = true
        error = nil
        defer { saving = false }

        let sl = slug.trimmingCharacters(in: .whitespacesAndNewlines)
        let ti = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !ti.isEmpty else {
            error = "Title is required."
            HBFeedback.warning()
            return
        }
        if payload.isCreating {
            guard !sl.isEmpty else {
                error = "URL path is required."
                HBFeedback.warning()
                return
            }
        }

        do {
            if payload.isCreating {
                var body: [String: Any] = [
                    "slug": sl,
                    "title": ti,
                    "body": bodyText,
                    "kind": kind,
                    "published": published,
                ]
                let ex = excerpt.trimmingCharacters(in: .whitespacesAndNewlines)
                if !ex.isEmpty { body["excerpt"] = ex }
                try await api.requestVoid("/admin/content-pages", method: "POST", jsonBody: body)
            } else if let sid = payload.serverId {
                var patch: [String: Any] = [
                    "id": sid,
                    "slug": sl,
                    "title": ti,
                    "body": bodyText,
                    "kind": kind,
                    "published": published,
                ]
                let ex = excerpt.trimmingCharacters(in: .whitespacesAndNewlines)
                patch["excerpt"] = ex.isEmpty ? NSNull() : ex
                try await api.requestVoid("/admin/content-pages", method: "PATCH", jsonBody: patch)
            }
            HBFeedback.success()
            NotificationCenter.default.post(name: .adminContentPagesDidChange, object: nil)
            dismiss()
            onDone()
        } catch {
            self.error = error.localizedDescription
            HBFeedback.warning()
        }
    }
}

extension Notification.Name {
    static let adminContentPagesDidChange = Notification.Name("adminContentPagesDidChange")
}

// MARK: - Purchase orders (admin)

private let adminPurchaseOrderStatuses = ["draft", "ordered", "shipped", "received", "cancelled"]

struct AdminPurchaseOrdersView: View {
    @EnvironmentObject private var api: APIClient

    @State private var rows: [PurchaseOrderSummaryDTO] = []
    @State private var isLoading = false
    @State private var error: String?

    @State private var supplierName = ""
    @State private var supplierOrderUrl = ""
    @State private var supplierOrderNumber = ""
    @State private var notes = ""

    @State private var suggestions: [PurchaseOrderReorderSuggestionDTO] = []
    @State private var suggestionsLoading = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Create purchase order")
                    .font(HBFont.headline())
                    .foregroundStyle(HBColors.charcoal)

                Text("Use this for inventory you buy anywhere—showrooms, wholesale portals, marketplaces (AliExpress, Amazon Business, FashionGo…), reps, or email orders. Track status, order #, and notes; marking “received” increments stock for variant-linked lines.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)

                TextField("Supplier name (optional)", text: $supplierName)
                    .padding()
                    .background(HBColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                TextField("Order URL (optional)", text: $supplierOrderUrl)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    .padding()
                    .background(HBColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                TextField("Order number (optional)", text: $supplierOrderNumber)
                    .padding()
                    .background(HBColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                TextField("Notes (optional)", text: $notes, axis: .vertical)
                    .lineLimit(3 ... 8)
                    .padding()
                    .background(HBColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                HStack(spacing: 12) {
                    Button {
                        Task { await createDraft() }
                    } label: {
                        Text("Create draft")
                            .font(HBFont.caption().weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(HBColors.gold.opacity(0.35))
                            .foregroundStyle(HBColors.charcoal)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }

                    Button {
                        Task { await load() }
                    } label: {
                        Text("Refresh")
                            .font(HBFont.caption().weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(HBColors.chipIdleBackground)
                            .foregroundStyle(HBColors.charcoal)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .strokeBorder(HBColors.gold.opacity(0.35), lineWidth: 1)
                            )
                    }
                }

                if let error {
                    Text(error)
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.rosePink)
                }

                Divider().padding(.vertical, 4)

                Text("Low-stock suggestions")
                    .font(HBFont.headline())
                    .foregroundStyle(HBColors.charcoal)
                Text("Variants at or below threshold (server default). Add lines on the web admin or bump stock when you receive.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)

                if suggestionsLoading && suggestions.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, 8)
                } else if suggestions.isEmpty {
                    Text("No suggestions right now.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                } else {
                    ForEach(suggestions.prefix(40)) { s in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(s.productName)
                                .font(HBFont.caption().weight(.semibold))
                                .foregroundStyle(HBColors.charcoal)
                            Text("Size \(s.size) · stock \(s.stock) · recommend +\(s.recommendedQty)")
                                .font(HBFont.caption())
                                .foregroundStyle(HBColors.mutedGray)
                            if let url = s.supplierUrl, let link = URL(string: url) {
                                Link("Supplier link", destination: link)
                                    .font(HBFont.caption().weight(.semibold))
                                    .foregroundStyle(HBColors.gold)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .hbCardStyle()
                    }
                }

                Divider().padding(.vertical, 4)

                Text("Purchase orders")
                    .font(HBFont.headline())
                    .foregroundStyle(HBColors.charcoal)

                if isLoading && rows.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, 24)
                } else if rows.isEmpty {
                    Text("No purchase orders yet.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                } else {
                    ForEach(rows) { row in
                        purchaseOrderCard(row)
                    }
                }
            }
            .padding()
        }
        .hbScreenBackground()
        .navigationTitle("Purchase orders")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await load()
            await loadSuggestions()
        }
        .refreshable {
            await load()
            await loadSuggestions()
        }
    }

    @ViewBuilder
    private func purchaseOrderCard(_ row: PurchaseOrderSummaryDTO) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(row.supplierName ?? "—")
                    .font(HBFont.caption().weight(.semibold))
                    .foregroundStyle(HBColors.charcoal)
                Spacer()
                if let u = row.supplierOrderUrl, let url = URL(string: u) {
                    Link("Open", destination: url)
                        .font(HBFont.caption().weight(.semibold))
                        .foregroundStyle(HBColors.gold)
                }
            }

            Text("Order # \(row.supplierOrderNumber ?? "—")")
                .font(HBFont.caption())
                .foregroundStyle(HBColors.mutedGray)

            HStack {
                Text("Status")
                    .font(HBFont.caption().weight(.semibold))
                    .foregroundStyle(HBColors.charcoal)
                Picker("Status", selection: Binding(
                    get: { row.status },
                    set: { newStatus in
                        Task { await updateStatus(id: row.id, to: newStatus) }
                    }
                )) {
                    ForEach(adminPurchaseOrderStatuses, id: \.self) { s in
                        Text(s.capitalized).tag(s)
                    }
                }
                .pickerStyle(.menu)
                Spacer()
            }

            Text("Updated \(formattedDate(row.updatedAt ?? row.createdAt))")
                .font(HBFont.caption())
                .foregroundStyle(HBColors.mutedGray)

            if let n = row.notes, !n.isEmpty {
                Text(n)
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.charcoal)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .hbCardStyle()
    }

    private func formattedDate(_ iso: String?) -> String {
        guard let iso, !iso.isEmpty else { return "—" }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var d = f.date(from: iso)
        if d == nil {
            f.formatOptions = [.withInternetDateTime]
            d = f.date(from: iso)
        }
        guard let d else { return iso }
        let out = DateFormatter()
        out.dateStyle = .short
        out.timeStyle = .short
        return out.string(from: d)
    }

    private func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let r: PurchaseOrdersListResponse = try await api.request("/admin/purchase-orders", method: "GET")
            rows = r.purchaseOrders
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func loadSuggestions() async {
        suggestionsLoading = true
        defer { suggestionsLoading = false }
        do {
            let r: PurchaseOrderSuggestionsResponse = try await api.request("/admin/purchase-orders?suggest=1", method: "GET")
            suggestions = r.suggestions
        } catch {
            suggestions = []
        }
    }

    private func createDraft() async {
        error = nil
        var body: [String: Any] = [
            "status": "draft",
            "items": [[String: Any]](),
        ]
        let sn = supplierName.trimmingCharacters(in: .whitespacesAndNewlines)
        let su = supplierOrderUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        let son = supplierOrderNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        let nt = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        if !sn.isEmpty { body["supplierName"] = sn }
        if !su.isEmpty { body["supplierOrderUrl"] = su }
        if !son.isEmpty { body["supplierOrderNumber"] = son }
        if !nt.isEmpty { body["notes"] = nt }

        do {
            try await api.requestVoid("/admin/purchase-orders", method: "POST", jsonBody: body)
            supplierName = ""
            supplierOrderUrl = ""
            supplierOrderNumber = ""
            notes = ""
            await load()
            HBFeedback.light()
        } catch {
            self.error = error.localizedDescription
            HBFeedback.warning()
        }
    }

    private func updateStatus(id: String, to status: String) async {
        error = nil
        let enc = id.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? id
        do {
            try await api.requestVoid("/admin/purchase-orders?id=\(enc)", method: "PATCH", jsonBody: ["status": status])
            await load()
            HBFeedback.light()
        } catch {
            self.error = error.localizedDescription
            HBFeedback.warning()
        }
    }
}

// MARK: - Staff (store owner)

private struct AdminStaffListResponse: Decodable {
    let staff: [AdminStaffRowDTO]
    let titleOptions: [String]?
}

private struct AdminStaffRowDTO: Decodable, Identifiable {
    let id: String
    let email: String
    let fullName: String?
    let role: String
    let staffPermissions: [String: Bool]?
    let staffActive: Bool?
    let staffTitle: String?
}

private let kDefaultStaffTitleOptions: [String] = [
    "Sales associate",
    "Stylist",
    "Assistant manager",
    "Store manager",
    "Visual merchandising",
    "Customer service",
    "Operations & inventory",
    "Other",
]

struct AdminStaffManagementView: View {
    @EnvironmentObject private var api: APIClient
    @State private var rows: [AdminStaffRowDTO] = []
    @State private var isLoading = false
    @State private var error: String?
    @State private var inviteEmail = ""
    @State private var invitePassword = ""
    @State private var inviteName = ""
    @State private var titleOptions: [String] = kDefaultStaffTitleOptions
    @State private var inviteTitle: String = kDefaultStaffTitleOptions[0]
    @State private var perms: [String: Bool] = [:]
    @State private var saving = false

    private let permKeys: [(String, String)] = [
        ("orders", "Orders & fulfillment"),
        ("products", "Products & catalog"),
        ("inventory", "Inventory & counts"),
        ("customers", "Customers & messages"),
        ("returns", "Returns"),
        ("discounts", "Discount codes"),
        ("giftCards", "Gift cards"),
        ("content", "Pages & journal"),
        ("homepage", "Store home (photos & promos)"),
        ("marketing", "Marketing"),
        ("reports", "Reports"),
        ("settings", "Stripe & EasyPost"),
        ("purchaseOrders", "Purchase orders"),
        ("promoAnalytics", "Promo analytics"),
        ("productsCsv", "Bulk CSV"),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Invite team members and set permissions for your store. Only the store owner manages this list.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)

                if let error {
                    Text(error).font(HBFont.caption()).foregroundStyle(HBColors.rosePink)
                }

                inviteForm

                Divider()

                Text("Team")
                    .font(HBFont.headline())

                if isLoading && rows.isEmpty {
                    ProgressView()
                } else if rows.isEmpty {
                    Text("No team members yet.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                } else {
                    ForEach(rows) { row in
                        staffRow(row)
                    }
                }
            }
            .padding()
        }
        .hbScreenBackground()
        .task { await load() }
        .refreshable { await load() }
    }

    private var inviteForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("New staff")
                .font(HBFont.headline())
            TextField("Email", text: $inviteEmail)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .padding()
                .background(HBColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: 16))
            SecureField("Temporary password (min 8)", text: $invitePassword)
                .padding()
                .background(HBColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: 16))
            TextField("Display name (optional)", text: $inviteName)
                .padding()
                .background(HBColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: 16))

            VStack(alignment: .leading, spacing: 6) {
                Text("Job title")
                    .font(HBFont.caption().weight(.semibold))
                    .foregroundStyle(HBColors.mutedGray)
                Picker("Job title", selection: $inviteTitle) {
                    ForEach(titleOptions, id: \.self) { t in
                        Text(t).tag(t)
                    }
                }
                .pickerStyle(.menu)
            }

            Text("Permissions")
                .font(HBFont.caption().weight(.semibold))
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(Array(permKeys.enumerated()), id: \.offset) { _, pair in
                    Toggle(pair.1, isOn: Binding(
                        get: { perms[pair.0] ?? false },
                        set: { perms[pair.0] = $0 }
                    ))
                    .font(HBFont.caption())
                }
            }

            Button {
                Task { await invite() }
            } label: {
                Text(saving ? "Saving…" : "Add staff member")
                    .font(HBFont.caption().weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(HBColors.gold.opacity(0.35))
                    .foregroundStyle(HBColors.charcoal)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
            }
            .disabled(saving)
        }
    }

    private func staffRow(_ row: AdminStaffRowDTO) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 10) {
                Text(row.email)
                    .font(HBFont.headline())
                    .foregroundStyle(HBColors.charcoal)
                    .lineLimit(1)
                    .minimumScaleFactor(0.55)
                    .truncationMode(.tail)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Group {
                    if row.role == "admin" {
                        Text("Owner")
                            .font(HBFont.caption().weight(.semibold))
                            .foregroundStyle(HBColors.gold)
                    } else if row.staffActive != false {
                        Text("Staff")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                    } else {
                        Text("Inactive")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.rosePink)
                    }
                }
                .fixedSize(horizontal: true, vertical: false)
            }
            if let t = row.staffTitle, !t.isEmpty {
                Text(t)
                    .font(HBFont.caption().weight(.medium))
                    .foregroundStyle(HBColors.mutedGray)
            }
            if row.role == "staff", let p = row.staffPermissions {
                let keys = p.filter { $0.value }.map { $0.key }.sorted().joined(separator: ", ")
                if !keys.isEmpty {
                    Text(keys)
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                }
            }
        }
        .padding()
        .hbCardStyle()
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        error = nil
        do {
            let r: AdminStaffListResponse = try await api.request("/admin/staff", method: "GET")
            rows = r.staff
            if let opts = r.titleOptions, !opts.isEmpty {
                titleOptions = opts
                if !opts.contains(inviteTitle) {
                    inviteTitle = opts[0]
                }
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func invite() async {
        saving = true
        error = nil
        defer { saving = false }
        let em = inviteEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        guard em.contains("@") else {
            error = "Enter an email."
            HBFeedback.warning()
            return
        }
        guard invitePassword.count >= 8 else {
            error = "Password must be at least 8 characters."
            HBFeedback.warning()
            return
        }
        var body: [String: Any] = [
            "email": em,
            "password": invitePassword,
            "permissions": perms,
            "staffTitle": titleOptions.contains(inviteTitle) ? inviteTitle : titleOptions[0],
        ]
        let nm = inviteName.trimmingCharacters(in: .whitespacesAndNewlines)
        if !nm.isEmpty { body["fullName"] = nm }
        do {
            try await api.requestVoid("/admin/staff", method: "POST", jsonBody: body)
            inviteEmail = ""
            invitePassword = ""
            inviteName = ""
            perms = [:]
            if let first = titleOptions.first { inviteTitle = first }
            HBFeedback.success()
            await load()
        } catch {
            self.error = error.localizedDescription
            HBFeedback.warning()
        }
    }
}

import SwiftUI

/// Store admin: catalog snapshot, orders, customer notifications. Open from Home (gear), Profile, Settings, or long-press the wordmark.
struct AdminHubView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var appModel: AppModel
    @State private var products: [ProductDTO] = []
    @State private var orders: [OrderDTO] = []
    @State private var isLoading = false
    @State private var tab = 0
    @State private var notifyUserId = ""
    @State private var notifyTitle = ""
    @State private var notifyBody = ""
    @State private var notifyBadge = ""
    @State private var notifyImageUrl = ""
    @State private var showNewProduct = false
    @State private var showAddCustomer = false
    @State private var showManualOrder = false
    @State private var customersRefreshNonce = 0

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                customerPreviewEntry
                Picker("Section", selection: $tab) {
                    Text("Products").tag(0)
                    Text("Orders").tag(1)
                    Text("Reports").tag(2)
                    Text("Customers").tag(3)
                    Text("Notify").tag(4)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 4)

                Group {
                    switch tab {
                    case 0: productSection
                    case 1: orderSection
                    case 2:
                        AdminFinancialReportsView()
                            .environmentObject(api)
                    case 3:
                        AdminCustomersView(refreshNonce: customersRefreshNonce)
                            .environmentObject(api)
                    default: notifySection
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .hbScreenBackground()
            .navigationTitle("Admin")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    HStack(spacing: 16) {
                        if tab == 0 {
                            Button {
                                showNewProduct = true
                            } label: {
                                Image(systemName: "plus.circle.fill")
                            }
                            .accessibilityLabel("Add product")
                        }
                        if tab == 1 {
                            Button {
                                showManualOrder = true
                            } label: {
                                Image(systemName: "plus.circle.fill")
                            }
                            .accessibilityLabel("Add order")
                        }
                        if tab == 3 {
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
                Text("Tap a product to edit details, prices, photos, and stock. Use + to add a new product.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)

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

    private var notifySection: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Newsletter-style message in the Notifications tab — optional hero image and badge (like a simple Canva card). Push sends too if FCM is configured.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)

                TextField("Customer user UUID", text: $notifyUserId)
                    .padding()
                    .background(HBColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                TextField("Headline", text: $notifyTitle)
                    .padding()
                    .background(HBColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                TextField("Story / details", text: $notifyBody, axis: .vertical)
                    .lineLimit(4...10)
                    .padding()
                    .background(HBColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                TextField("Badge (optional, e.g. New drop, Sale)", text: $notifyBadge)
                    .padding()
                    .background(HBColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                TextField("Hero image URL (optional, https)", text: $notifyImageUrl)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    .padding()
                    .background(HBColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                VStack(alignment: .leading, spacing: 10) {
                    Text("Preview")
                        .font(HBFont.headline())
                        .foregroundStyle(HBColors.charcoal)
                    Text("How this card appears in the customer’s Notifications tab (unread styling). Hero loads from your URL when valid https.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                        .fixedSize(horizontal: false, vertical: true)
                    NewsletterStyleNotificationCard(
                        title: notifyPreviewHeadline,
                        detailText: notifyPreviewBody,
                        badge: notifyPreviewBadge,
                        imageURL: notifyPreviewHeroURL,
                        footerTimeText: "Preview",
                        showUnreadChrome: true
                    )
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .hbCardStyle()

                HBPrimaryButton(title: "Send notification", isLoading: isLoading) {
                    Task { await sendNotify() }
                }
            }
            .padding()
        }
    }

    private var notifyPreviewHeadline: String {
        let t = notifyTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? "Headline" : t
    }

    private var notifyPreviewBody: String? {
        let b = notifyBody.trimmingCharacters(in: .whitespacesAndNewlines)
        return b.isEmpty ? nil : b
    }

    private var notifyPreviewBadge: String? {
        let b = notifyBadge.trimmingCharacters(in: .whitespacesAndNewlines)
        return b.isEmpty ? nil : b
    }

    private var notifyPreviewHeroURL: URL? {
        let s = notifyImageUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let u = URL(string: s), let scheme = u.scheme?.lowercased(), scheme == "https" else { return nil }
        return u
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
        } catch { }
    }

    private func sendNotify() async {
        isLoading = true
        defer { isLoading = false }
        let uid = notifyUserId.trimmingCharacters(in: .whitespacesAndNewlines)
        let title = notifyTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !uid.isEmpty, !title.isEmpty else { return }
        do {
            var payload: [String: Any] = [
                "userId": uid,
                "type": "promotion",
                "title": title,
            ]
            let bodyText = notifyBody.trimmingCharacters(in: .whitespacesAndNewlines)
            if !bodyText.isEmpty {
                payload["body"] = bodyText
            }
            var data: [String: String] = [:]
            let badge = notifyBadge.trimmingCharacters(in: .whitespacesAndNewlines)
            let img = notifyImageUrl.trimmingCharacters(in: .whitespacesAndNewlines)
            if !badge.isEmpty { data["badge"] = badge }
            if !img.isEmpty { data["imageUrl"] = img }
            if !data.isEmpty {
                payload["data"] = data
            }
            try await api.requestVoid(
                "/notifications",
                method: "POST",
                jsonBody: payload
            )
            notifyTitle = ""
            notifyBody = ""
            notifyBadge = ""
            notifyImageUrl = ""
        } catch { }
    }
}

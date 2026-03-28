import SwiftUI

/// Hidden admin surface — surfaced from Home via long-press on the boutique name (admin accounts only).
struct AdminHubView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var api: APIClient
    @State private var products: [ProductDTO] = []
    @State private var orders: [OrderDTO] = []
    @State private var isLoading = false
    @State private var tab = 0
    @State private var notifyUserId = ""
    @State private var notifyTitle = ""
    @State private var notifyBody = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Section", selection: $tab) {
                    Text("Products").tag(0)
                    Text("Orders").tag(1)
                    Text("Notify").tag(2)
                }
                .pickerStyle(.segmented)
                .padding()

                Group {
                    switch tab {
                    case 0: productSection
                    case 1: orderSection
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
                    Button {
                        Task { await reload() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .task { await reload() }
        }
    }

    private var productSection: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Use API or add inventory from Neon for bulk edits. Below is a live read of catalog.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)

                ForEach(products) { p in
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
            }
            .padding()
        }
    }

    private var orderSection: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(orders) { o in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(o.status.capitalized)
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
            }
            .padding()
        }
    }

    private var notifySection: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Send in-app notification (push if FCM configured on server).")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)

                TextField("Customer user UUID", text: $notifyUserId)
                    .padding()
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                TextField("Title", text: $notifyTitle)
                    .padding()
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                TextField("Body", text: $notifyBody, axis: .vertical)
                    .lineLimit(3...6)
                    .padding()
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                HBPrimaryButton(title: "Send notification", isLoading: isLoading) {
                    Task { await sendNotify() }
                }
            }
            .padding()
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
        } catch { }
    }

    private func sendNotify() async {
        isLoading = true
        defer { isLoading = false }
        let uid = notifyUserId.trimmingCharacters(in: .whitespacesAndNewlines)
        let title = notifyTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !uid.isEmpty, !title.isEmpty else { return }
        do {
            try await api.requestVoid(
                "/notifications",
                method: "POST",
                jsonBody: [
                    "userId": uid,
                    "type": "promotion",
                    "title": title,
                    "body": notifyBody,
                ]
            )
            notifyTitle = ""
            notifyBody = ""
        } catch { }
    }
}

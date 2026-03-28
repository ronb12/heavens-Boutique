import SwiftUI

/// Customer-facing order detail with tracking timeline, carrier text, and line items.
struct CustomerOrderDetailView: View {
    let orderId: String
    @EnvironmentObject private var api: APIClient
    @State private var order: OrderDTO?
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if isLoading && order == nil {
                    ProgressView()
                        .tint(HBColors.gold)
                        .frame(maxWidth: .infinity)
                        .padding()
                } else if let error, order == nil {
                    Text(error)
                        .font(HBFont.body())
                        .foregroundStyle(HBColors.mutedGray)
                } else if let o = order {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Order \(shortId(o.id))")
                            .font(HBFont.headline())
                            .foregroundStyle(HBColors.charcoal)
                        if let created = o.createdAt, let pretty = formatOrderDate(created) {
                            Text("Placed \(pretty)")
                                .font(HBFont.caption())
                                .foregroundStyle(HBColors.mutedGray)
                        }
                        Text(NumberFormatter.localizedString(from: NSNumber(value: Double(o.totalCents) / 100), number: .currency))
                            .font(HBFont.caption().weight(.medium))
                            .foregroundStyle(HBColors.gold)
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Shipment progress")
                            .font(HBFont.caption().weight(.semibold))
                            .foregroundStyle(HBColors.charcoal)
                        OrderTrackingStatusBar(status: o.status, compact: false)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .hbCardStyle()

                    if let t = o.trackingNumber, !t.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Carrier / tracking number")
                                .font(HBFont.caption().weight(.semibold))
                                .foregroundStyle(HBColors.charcoal)
                            Text(t)
                                .font(.system(.body, design: .monospaced))
                                .foregroundStyle(HBColors.charcoal)
                                .textSelection(.enabled)
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .hbCardStyle()
                    }

                    if let items = o.items, !items.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Items")
                                .font(HBFont.caption().weight(.semibold))
                                .foregroundStyle(HBColors.charcoal)
                            ForEach(items) { line in
                                HStack(alignment: .top) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(line.productName ?? "Item")
                                            .font(HBFont.caption().weight(.medium))
                                            .foregroundStyle(HBColors.charcoal)
                                        Text("Qty \(line.quantity)")
                                            .font(HBFont.caption())
                                            .foregroundStyle(HBColors.mutedGray)
                                    }
                                    Spacer()
                                    Text(NumberFormatter.localizedString(
                                        from: NSNumber(value: Double(line.unitPriceCents * line.quantity) / 100),
                                        number: .currency
                                    ))
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.gold)
                                }
                                .padding(.vertical, 4)
                                if line.id != items.last?.id {
                                    Divider().opacity(0.5)
                                }
                            }
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .hbCardStyle()
                    }
                }
            }
            .padding()
        }
        .hbScreenBackground()
        .navigationTitle("Order status")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
    }

    private func shortId(_ uuid: String) -> String {
        String(uuid.prefix(8))
    }

    private func formatOrderDate(_ iso: String) -> String? {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = isoFormatter.date(from: iso)
        if date == nil {
            isoFormatter.formatOptions = [.withInternetDateTime]
            date = isoFormatter.date(from: iso)
        }
        guard let date else { return nil }
        let out = DateFormatter()
        out.dateStyle = .medium
        out.timeStyle = .short
        return out.string(from: date)
    }

    private func load() async {
        if order == nil { isLoading = true }
        error = nil
        defer { isLoading = false }
        do {
            let r: OrderDetailResponse = try await api.request("/orders/\(orderId)", method: "GET")
            order = r.order
        } catch {
            self.error = error.localizedDescription
        }
    }
}

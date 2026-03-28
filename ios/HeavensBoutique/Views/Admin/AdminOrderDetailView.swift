import SwiftUI

/// Edit order status and tracking (admin). Refunds: process in Stripe first, then set status to Refunded here.
private let adminOrderStatuses = ["pending", "paid", "shipped", "delivered", "cancelled", "refunded"]

struct AdminOrderDetailView: View {
    let orderId: String
    @EnvironmentObject private var api: APIClient
    @State private var order: OrderDTO?
    @State private var selectedStatus = "paid"
    @State private var trackingText = ""
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var loadError: String?
    @State private var saveError: String?
    @State private var saveMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if isLoading {
                    ProgressView()
                        .tint(HBColors.gold)
                        .frame(maxWidth: .infinity)
                        .padding()
                } else if let loadError, order == nil {
                    Text(loadError)
                        .font(HBFont.body())
                        .foregroundStyle(HBColors.mutedGray)
                } else if let o = order {
                    Text("Order \(shortId(o.id))")
                        .font(HBFont.headline())
                        .foregroundStyle(HBColors.charcoal)

                    if let email = o.userEmail, !email.isEmpty {
                        Text(email)
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                    }

                    Text(NumberFormatter.localizedString(from: NSNumber(value: Double(o.totalCents) / 100), number: .currency))
                        .font(HBFont.caption().weight(.medium))
                        .foregroundStyle(HBColors.gold)

                    if let pi = o.stripePaymentIntentId, !pi.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Stripe PaymentIntent (refunds in Dashboard)")
                                .font(HBFont.caption())
                                .foregroundStyle(HBColors.mutedGray)
                            Text(pi)
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(HBColors.charcoal)
                                .textSelection(.enabled)
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(HBColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Status")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                        Picker("Status", selection: $selectedStatus) {
                            ForEach(adminOrderStatuses, id: \.self) { s in
                                Text(s.replacingOccurrences(of: "_", with: " ").capitalized).tag(s)
                            }
                        }
                        .pickerStyle(.menu)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Tracking number")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                        TextField("Optional", text: $trackingText)
                            .padding()
                            .background(HBColors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }

                    if let saveMessage {
                        Text(saveMessage)
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.gold)
                    }
                    if let saveError {
                        Text(saveError)
                            .font(HBFont.caption())
                            .foregroundStyle(.red.opacity(0.85))
                    }

                    HBPrimaryButton(title: "Save", isLoading: isSaving) {
                        Task { await save() }
                    }

                    if let items = o.items, !items.isEmpty {
                        Text("Line items")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                            .padding(.top, 8)
                        ForEach(items) { line in
                            HStack {
                                Text(line.productName ?? "Item")
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.charcoal)
                                Spacer()
                                Text("×\(line.quantity)")
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.mutedGray)
                            }
                        }
                    }
                }
            }
            .padding()
        }
        .hbScreenBackground()
        .navigationTitle("Order")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func shortId(_ uuid: String) -> String {
        String(uuid.prefix(8))
    }

    private func load() async {
        isLoading = true
        loadError = nil
        defer { isLoading = false }
        do {
            let r: OrderDetailResponse = try await api.request("/orders/\(orderId)", method: "GET")
            order = r.order
            selectedStatus = r.order.status
            trackingText = r.order.trackingNumber ?? ""
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func save() async {
        guard order != nil else { return }
        isSaving = true
        saveMessage = nil
        saveError = nil
        defer { isSaving = false }
        do {
            try await api.requestVoid(
                "/orders/\(orderId)",
                method: "PATCH",
                jsonBody: [
                    "status": selectedStatus,
                    "trackingNumber": trackingText.trimmingCharacters(in: .whitespacesAndNewlines),
                ]
            )
            HBFeedback.success()
            saveMessage = "Saved."
            await load()
        } catch {
            HBFeedback.warning()
            saveError = error.localizedDescription
        }
    }
}

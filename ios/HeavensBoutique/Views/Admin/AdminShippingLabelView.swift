import SwiftUI

struct AdminShippingLabelView: View {
    let orderId: String
    let order: OrderDTO
    @EnvironmentObject private var api: APIClient
    @Environment(\.dismiss) private var dismiss

    @State private var shipmentId: String?
    @State private var rates: [ShippingRateDTO] = []
    @State private var selectedRateId: String?
    @State private var isLoadingRates = false
    @State private var isBuying = false
    @State private var ratesError: String?
    @State private var buyError: String?
    @State private var purchasedLabel: PurchasedLabel?

    struct PurchasedLabel {
        let url: String
        let carrier: String?
        let service: String?
        let trackingCode: String?
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let addr = order.shippingAddress {
                        addressCard(addr)
                    }

                    if let label = purchasedLabel {
                        labelSuccessCard(label)
                    } else if let existingUrl = order.labelUrl {
                        existingLabelCard(existingUrl)
                    } else {
                        ratesSection
                    }
                }
                .padding()
            }
            .hbScreenBackground()
            .navigationTitle("Shipping label")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task { await fetchRates() }
        }
    }

    private func addressCard(_ addr: ShippingAddressDTO) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Ship to")
                .font(HBFont.caption().weight(.semibold))
                .foregroundStyle(HBColors.mutedGray)
            if let name = addr.name, !name.isEmpty {
                Text(name).font(HBFont.caption().weight(.medium)).foregroundStyle(HBColors.charcoal)
            }
            Text(addr.line1).font(HBFont.caption()).foregroundStyle(HBColors.charcoal)
            if let l2 = addr.line2, !l2.isEmpty {
                Text(l2).font(HBFont.caption()).foregroundStyle(HBColors.mutedGray)
            }
            Text("\(addr.city)\(addr.state.map { ", \($0)" } ?? "") \(addr.postal)")
                .font(HBFont.caption()).foregroundStyle(HBColors.mutedGray)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .hbCardStyle()
    }

    private var ratesSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Select rate")
                    .font(HBFont.headline())
                    .foregroundStyle(HBColors.charcoal)
                Spacer()
                if isLoadingRates {
                    ProgressView().tint(HBColors.gold).scaleEffect(0.8)
                } else {
                    Button("Refresh") { Task { await fetchRates() } }
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.gold)
                }
            }

            if let ratesError {
                Text(ratesError).font(HBFont.caption()).foregroundStyle(HBColors.rosePink)
                HBPrimaryButton(title: "Try again", isLoading: isLoadingRates) {
                    Task { await fetchRates() }
                }
            } else if rates.isEmpty && !isLoadingRates {
                Text("No rates available. Check that the shipping address is valid.")
                    .font(HBFont.caption()).foregroundStyle(HBColors.mutedGray)
            } else {
                ForEach(rates) { rate in
                    rateRow(rate)
                }

                if let buyError {
                    Text(buyError).font(HBFont.caption()).foregroundStyle(HBColors.rosePink)
                }

                HBPrimaryButton(title: "Buy label", isLoading: isBuying) {
                    Task { await buyLabel() }
                }
                .disabled(selectedRateId == nil || isBuying)
            }
        }
    }

    private func rateRow(_ rate: ShippingRateDTO) -> some View {
        let selected = selectedRateId == rate.id
        return Button {
            selectedRateId = rate.id
            HBFeedback.light()
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(rate.carrier) \(rate.service)")
                        .font(HBFont.caption().weight(.semibold))
                        .foregroundStyle(HBColors.charcoal)
                    if let days = rate.deliveryDays {
                        Text("\(days) business day\(days == 1 ? "" : "s")")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                    }
                }
                Spacer()
                Text(formatCents(rate.rateCents))
                    .font(HBFont.caption().weight(.semibold))
                    .foregroundStyle(HBColors.gold)
                if selected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(HBColors.gold)
                }
            }
            .padding()
            .background(selected ? HBColors.gold.opacity(0.08) : HBColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(selected ? HBColors.gold.opacity(0.4) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func existingLabelCard(_ url: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "checkmark.circle.fill").foregroundStyle(HBColors.gold)
                Text("Label purchased").font(HBFont.headline()).foregroundStyle(HBColors.charcoal)
            }
            if let carrier = order.carrier, let service = order.service {
                Text("\(carrier) \(service)").font(HBFont.caption()).foregroundStyle(HBColors.mutedGray)
            }
            if let tracking = order.trackingNumber, !tracking.isEmpty {
                Text(tracking).font(.system(.body, design: .monospaced)).foregroundStyle(HBColors.charcoal).textSelection(.enabled)
            }
            if let link = URL(string: url) {
                Link(destination: link) {
                    HStack {
                        Image(systemName: "printer.fill")
                        Text("Open label")
                    }
                    .font(HBFont.caption().weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(HBColors.gold)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .hbCardStyle()
    }

    private func labelSuccessCard(_ label: PurchasedLabel) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "checkmark.circle.fill").foregroundStyle(HBColors.gold)
                Text("Label purchased!").font(HBFont.headline()).foregroundStyle(HBColors.charcoal)
            }
            if let carrier = label.carrier, let service = label.service {
                Text("\(carrier) \(service)").font(HBFont.caption()).foregroundStyle(HBColors.mutedGray)
            }
            if let code = label.trackingCode, !code.isEmpty {
                Text(code).font(.system(.body, design: .monospaced)).foregroundStyle(HBColors.charcoal).textSelection(.enabled)
            }
            if let link = URL(string: label.url) {
                Link(destination: link) {
                    HStack {
                        Image(systemName: "printer.fill")
                        Text("Open label")
                    }
                    .font(HBFont.caption().weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(HBColors.gold)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .hbCardStyle()
    }

    private func fetchRates() async {
        isLoadingRates = true
        ratesError = nil
        defer { isLoadingRates = false }
        do {
            let r: ShippingRatesResponse = try await api.request("/admin/easypost/\(orderId)/rates", method: "GET")
            shipmentId = r.shipmentId
            rates = r.rates
            if selectedRateId == nil, let first = r.rates.first {
                selectedRateId = first.id
            }
        } catch {
            ratesError = error.localizedDescription
        }
    }

    private func buyLabel() async {
        guard let rateId = selectedRateId, let sid = shipmentId else { return }
        isBuying = true
        buyError = nil
        defer { isBuying = false }
        do {
            let body: [String: Any] = ["shipmentId": sid, "rateId": rateId]
            let r: AdminBuyLabelResponse = try await api.request("/admin/easypost/\(orderId)/buy", method: "POST", jsonBody: body)
            let url = r.label.labelUrl ?? ""
            purchasedLabel = PurchasedLabel(
                url: url,
                carrier: r.label.carrier,
                service: r.label.service,
                trackingCode: r.label.trackingCode
            )
            HBFeedback.success()
        } catch {
            buyError = error.localizedDescription
            HBFeedback.warning()
        }
    }

    private func formatCents(_ cents: Int) -> String {
        NumberFormatter.localizedString(from: NSNumber(value: Double(cents) / 100), number: .currency)
    }
}

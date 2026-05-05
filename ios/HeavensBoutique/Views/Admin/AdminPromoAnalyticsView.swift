import SwiftUI

struct AdminPromoAnalyticsView: View {
    @EnvironmentObject private var api: APIClient
    @State private var promos: [AdminPromoAnalyticsRowDTO] = []
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        Group {
            if isLoading && promos.isEmpty {
                ProgressView().tint(HBColors.gold).frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error, promos.isEmpty {
                HBEmptyState(systemImage: "tag.slash", title: "Couldn't load promo analytics", message: error, retryTitle: "Try again") {
                    Task { await load() }
                }
            } else if promos.isEmpty {
                HBEmptyState(
                    systemImage: "tag",
                    title: "No promo data yet",
                    message: "Once orders use discount codes, results appear here.",
                    retryTitle: nil,
                    retry: nil
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(promos) { p in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(p.code)
                                .font(HBFont.caption().weight(.semibold))
                                .foregroundStyle(HBColors.charcoal)
                            Spacer()
                            Text("\(p.redemptionCount) use\(p.redemptionCount == 1 ? "" : "s")")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(HBColors.gold)
                        }
                        HStack {
                            Text("Discount: \(formatCents(p.discountCents))")
                                .font(HBFont.caption())
                                .foregroundStyle(HBColors.mutedGray)
                            Spacer()
                            Text("Revenue: \(formatCents(p.totalCents))")
                                .font(HBFont.caption())
                                .foregroundStyle(HBColors.mutedGray)
                        }
                    }
                    .padding(.vertical, 4)
                    .listRowBackground(HBColors.surface)
                }
                .scrollContentBackground(.hidden)
                .background(HBColors.cream.ignoresSafeArea())
            }
        }
        .navigationTitle("Promo analytics")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        if promos.isEmpty { isLoading = true }
        error = nil
        defer { isLoading = false }
        do {
            let r: AdminPromoAnalyticsResponse = try await api.request("/admin/promo-analytics", method: "GET")
            promos = r.promos
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func formatCents(_ cents: Int) -> String {
        NumberFormatter.localizedString(from: NSNumber(value: Double(cents) / 100), number: .currency)
    }
}


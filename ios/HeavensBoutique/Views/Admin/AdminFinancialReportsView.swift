import SwiftUI

/// Admin-only sales summary, order mix by status, and daily revenue for the selected window.
struct AdminFinancialReportsView: View {
    @EnvironmentObject private var api: APIClient

    @State private var report: AdminFinancialReportsResponse?
    @State private var rangeDays = 30
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showReloadError = false

    var body: some View {
        Group {
            if let r = report {
                reportContent(r)
            } else if isLoading {
                ProgressView("Loading reports…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ContentUnavailableView(
                    "No report data",
                    systemImage: "chart.bar.doc.horizontal",
                    description: Text(errorMessage ?? "Pull to refresh or choose a period.")
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .task { await load() }
        .alert("Couldn’t refresh reports", isPresented: $showReloadError) {
            Button("OK", role: .cancel) {
                showReloadError = false
            }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    @ViewBuilder
    private func reportContent(_ r: AdminFinancialReportsResponse) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Picker("Period", selection: $rangeDays) {
                    Text("7 days").tag(7)
                    Text("30 days").tag(30)
                    Text("90 days").tag(90)
                }
                .pickerStyle(.segmented)
                .onChange(of: rangeDays) { _, _ in
                    Task { await load() }
                }

                Text(
                    "Paid, shipped, and delivered orders count toward sales. Refunds reduce net. Chart uses the selected period; totals below are all-time."
                )
                .font(HBFont.caption())
                .foregroundStyle(HBColors.mutedGray)

                summaryGrid(r.summary)

                Text("Orders by status")
                    .font(HBFont.headline())
                    .foregroundStyle(HBColors.charcoal)

                VStack(spacing: 0) {
                    ForEach(r.byStatus) { row in
                        HStack {
                            Text(row.status.replacingOccurrences(of: "_", with: " ").capitalized)
                                .font(HBFont.body())
                            Spacer()
                            Text("\(row.count)")
                                .font(HBFont.caption())
                                .foregroundStyle(HBColors.mutedGray)
                            Text(Self.money(row.totalCents))
                                .font(HBFont.body())
                                .foregroundStyle(HBColors.gold)
                        }
                        .padding(.vertical, 10)
                        if row.id != r.byStatus.last?.id {
                            Divider()
                        }
                    }
                }
                .padding(.horizontal, 14)
                .hbCardStyle()

                Text("Daily revenue (\(r.days) days, UTC)")
                    .font(HBFont.headline())
                    .foregroundStyle(HBColors.charcoal)

                if r.daily.isEmpty {
                    Text("No paid orders in this window.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                } else {
                    VStack(spacing: 0) {
                        ForEach(r.daily) { day in
                            HStack {
                                Text(Self.formatDayLabel(day.date))
                                    .font(HBFont.body())
                                Spacer()
                                Text("\(day.orderCount) orders")
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.mutedGray)
                                Text(Self.money(day.revenueCents))
                                    .font(HBFont.body())
                                    .foregroundStyle(HBColors.charcoal)
                            }
                            .padding(.vertical, 8)
                            if day.id != r.daily.last?.id {
                                Divider()
                            }
                        }
                    }
                    .padding(.horizontal, 14)
                    .hbCardStyle()
                }

                Text("As of \(Self.formatAsOf(r.asOf)) · \(r.currency.uppercased())")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            }
            .padding()
        }
        .refreshable { await load() }
    }

    private func summaryGrid(_ s: AdminFinancialSummary) -> some View {
        let cells: [(String, String)] = [
            ("Net sales", Self.money(s.netSalesCents)),
            ("Gross (paid/shipped/delivered)", Self.money(s.grossSalesCents)),
            ("Refunds", Self.money(s.refundedCents)),
            ("Discounts", Self.money(s.discountsCents)),
            ("Tax collected", Self.money(s.taxCents)),
            ("Shipping", Self.money(s.shippingCents)),
            ("Paid orders", "\(s.paidOrderCount)"),
            ("Avg order value", Self.money(s.averageOrderValueCents)),
        ]

        return LazyVGrid(
            columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)],
            spacing: 12
        ) {
            ForEach(Array(cells.enumerated()), id: \.offset) { _, cell in
                VStack(alignment: .leading, spacing: 6) {
                    Text(cell.0)
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                    Text(cell.1)
                        .font(HBFont.headline())
                        .foregroundStyle(HBColors.charcoal)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .hbCardStyle()
            }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        errorMessage = nil
        do {
            let r: AdminFinancialReportsResponse = try await api.request(
                "/admin/reports?days=\(rangeDays)",
                method: "GET"
            )
            report = r
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
            if report != nil {
                showReloadError = true
            }
        }
    }

    private static func money(_ cents: Int) -> String {
        NumberFormatter.localizedString(from: NSNumber(value: Double(cents) / 100), number: .currency)
    }

    private static func formatAsOf(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var d = f.date(from: iso)
        if d == nil {
            f.formatOptions = [.withInternetDateTime]
            d = f.date(from: iso)
        }
        guard let date = d else { return iso }
        let out = DateFormatter()
        out.dateStyle = .medium
        out.timeStyle = .short
        return out.string(from: date)
    }

    private static func formatDayLabel(_ ymd: String) -> String {
        let p = DateFormatter()
        p.calendar = Calendar(identifier: .gregorian)
        p.locale = Locale(identifier: "en_US_POSIX")
        p.dateFormat = "yyyy-MM-dd"
        guard let d = p.date(from: String(ymd.prefix(10))) else { return ymd }
        let out = DateFormatter()
        out.dateStyle = .medium
        return out.string(from: d)
    }
}

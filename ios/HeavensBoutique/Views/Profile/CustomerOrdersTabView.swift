import SwiftUI

struct CustomerOrdersTabView: View {
    @EnvironmentObject private var session: SessionViewModel
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var appModel: AppModel
    @StateObject private var ordersVM = OrdersViewModel()
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if session.isLoggedIn {
                    ordersList
                } else {
                    guestOrders
                }
            }
            .scrollContentBackground(.hidden)
            .background(HBColors.cream.ignoresSafeArea())
            .navigationTitle("Orders")
            .navigationDestination(for: String.self) { id in
                CustomerOrderDetailView(orderId: id)
            }
            .task {
                if session.isLoggedIn {
                    await ordersVM.load(api: api, adminAll: false)
                    openPendingOrderIfNeeded()
                }
            }
            .refreshable {
                guard session.isLoggedIn else { return }
                await ordersVM.load(api: api, adminAll: false)
            }
            .onChange(of: appModel.pendingOrderIdToOpen) { _, _ in
                if session.isLoggedIn {
                    openPendingOrderIfNeeded()
                }
            }
            .onChange(of: session.user?.id) { _, _ in
                if session.isLoggedIn {
                    Task { await ordersVM.load(api: api, adminAll: false) }
                    openPendingOrderIfNeeded()
                }
            }
        }
    }

    private var guestOrders: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Order history")
                        .font(HBFont.headline())
                        .foregroundStyle(HBColors.charcoal)
                    Text("Sign in to see receipts, tracking, and your past orders.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                }
                .listRowBackground(HBColors.surface)

                Button {
                    appModel.presentAuth(.login)
                } label: {
                    Label("Sign in", systemImage: "person.crop.circle")
                        .foregroundStyle(HBColors.charcoal)
                }
                .listRowBackground(HBColors.surface)
            }
        }
    }

    @ViewBuilder
    private var ordersList: some View {
        List {
            if ordersVM.isLoading && ordersVM.orders.isEmpty {
                Section {
                    HStack {
                        Spacer()
                        ProgressView()
                            .tint(HBColors.gold)
                        Spacer()
                    }
                    .listRowBackground(HBColors.surface)
                }
            } else if let err = ordersVM.error, ordersVM.orders.isEmpty {
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("We couldn’t load orders")
                            .font(HBFont.headline())
                            .foregroundStyle(HBColors.charcoal)
                        Text(err)
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                        Button("Try again") {
                            Task { await ordersVM.load(api: api, adminAll: false) }
                        }
                        .font(HBFont.caption().weight(.semibold))
                        .foregroundStyle(HBColors.gold)
                    }
                    .listRowBackground(HBColors.surface)
                }
            } else if ordersVM.orders.isEmpty {
                Section {
                    Text("No orders yet — after checkout, receipts and tracking show up here.")
                        .font(HBFont.body())
                        .foregroundStyle(HBColors.mutedGray)
                        .listRowBackground(HBColors.surface)
                }
            } else {
                Section {
                    ForEach(ordersVM.orders) { o in
                        NavigationLink(value: o.id) {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Text(formatCents(o.totalCents))
                                        .font(HBFont.caption().weight(.semibold))
                                        .foregroundStyle(HBColors.charcoal)
                                    Spacer()
                                    Text(o.status.replacingOccurrences(of: "_", with: " ").capitalized)
                                        .font(HBFont.caption())
                                        .foregroundStyle(HBColors.mutedGray)
                                }
                                OrderTrackingStatusBar(status: o.status, compact: true)
                                if let t = o.trackingNumber, !t.isEmpty {
                                    Text("Tracking: \(t)")
                                        .font(HBFont.caption())
                                        .foregroundStyle(HBColors.gold)
                                        .lineLimit(1)
                                        .accessibilityLabel("Tracking number \(t)")
                                }
                            }
                            .padding(.vertical, 4)
                        }
                        .listRowBackground(HBColors.surface)
                    }
                }
            }
        }
    }

    private func formatCents(_ cents: Int) -> String {
        NumberFormatter.localizedString(from: NSNumber(value: Double(cents) / 100), number: .currency)
    }

    private func openPendingOrderIfNeeded() {
        guard session.isLoggedIn, let id = appModel.pendingOrderIdToOpen else { return }
        appModel.pendingOrderIdToOpen = nil
        path.append(id)
    }
}

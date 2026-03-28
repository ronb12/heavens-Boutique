import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var session: SessionViewModel
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var cart: CartStore
    @StateObject private var ordersVM = OrdersViewModel()
    @State private var wishlist: [ProductDTO] = []
    @State private var showWishlist = false
    @State private var showDeleteConfirm = false
    @State private var deleteError: String?
    @State private var showDeleteError = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(session.user?.fullName ?? "Member")
                            .font(HBFont.headline())
                            .foregroundStyle(HBColors.charcoal)
                        Text(session.user?.email ?? "")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                        if let pts = session.user?.loyaltyPoints {
                            Text("\(pts) loyalty points")
                                .font(HBFont.caption().weight(.medium))
                                .foregroundStyle(HBColors.gold)
                                .padding(.top, 4)
                        }
                    }
                    .listRowBackground(HBColors.cream)
                }

                Section("Orders") {
                    if ordersVM.orders.isEmpty {
                        Text("No orders yet")
                            .foregroundStyle(HBColors.mutedGray)
                            .listRowBackground(HBColors.cream)
                    } else {
                        ForEach(ordersVM.orders) { o in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(o.status.capitalized)
                                    .font(HBFont.caption().weight(.semibold))
                                    .foregroundStyle(HBColors.charcoal)
                                Text(formatCents(o.totalCents))
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.mutedGray)
                                if let t = o.trackingNumber, !t.isEmpty {
                                    Text("Tracking: \(t)")
                                        .font(HBFont.caption())
                                        .foregroundStyle(HBColors.gold)
                                }
                            }
                            .listRowBackground(HBColors.cream)
                        }
                    }
                }

                Section("Saved") {
                    NavigationLink {
                        WishlistDetailView(products: wishlist)
                    } label: {
                        Label("Wishlist", systemImage: "heart.fill")
                            .foregroundStyle(HBColors.charcoal)
                    }
                    .listRowBackground(HBColors.cream)

                    NavigationLink {
                        CartView()
                    } label: {
                        Label("Shopping bag", systemImage: "bag.fill")
                            .foregroundStyle(HBColors.charcoal)
                    }
                    .listRowBackground(HBColors.cream)
                }

                Section {
                    Button("Sign out", role: .destructive) {
                        session.logout()
                    }
                    .listRowBackground(HBColors.cream)
                }

                Section {
                    Button("Delete account", role: .destructive) {
                        showDeleteConfirm = true
                    }
                    .listRowBackground(HBColors.cream)
                } footer: {
                    Text("Permanently deletes your account, saved addresses, wishlist, messages, notifications, and cart. Associated order rows are removed from your account; retain receipts if you need them.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                }
            }
            .scrollContentBackground(.hidden)
            .background(HBColors.cream.ignoresSafeArea())
            .navigationTitle("Profile")
            .task {
                await ordersVM.load(api: api, adminAll: false)
                await loadWishlist()
                await session.refreshProfile()
            }
            .confirmationDialog(
                "Delete your account?",
                isPresented: $showDeleteConfirm,
                titleVisibility: .visible
            ) {
                Button("Delete account", role: .destructive) {
                    Task { await deleteAccount() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This cannot be undone.")
            }
            .alert("Could not delete account", isPresented: $showDeleteError) {
                Button("OK") {
                    deleteError = nil
                }
            } message: {
                Text(deleteError ?? "Unknown error")
            }
        }
    }

    private func deleteAccount() async {
        deleteError = nil
        do {
            try await api.requestVoid("/users/me", method: "DELETE")
            cart.clear()
            session.logout()
        } catch {
            deleteError = error.localizedDescription
            showDeleteError = true
        }
    }

    private func formatCents(_ cents: Int) -> String {
        NumberFormatter.localizedString(from: NSNumber(value: Double(cents) / 100), number: .currency)
    }

    private func loadWishlist() async {
        do {
            let r: ProductsResponse = try await api.request("/wishlist", method: "GET")
            wishlist = r.products
        } catch { }
    }
}

struct WishlistDetailView: View {
    let products: [ProductDTO]

    var body: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                ForEach(products) { p in
                    NavigationLink {
                        ProductDetailView(product: p)
                    } label: {
                        ProductCardView(product: p)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding()
        }
        .hbScreenBackground()
        .navigationTitle("Wishlist")
    }
}

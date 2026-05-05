import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var session: SessionViewModel
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var cart: CartStore
    @EnvironmentObject private var appModel: AppModel
    @State private var wishlist: [ProductDTO] = []
    @State private var showDeleteConfirm = false
    @State private var deleteError: String?
    @State private var showDeleteError = false
    @State private var showAdminHub = false

    var body: some View {
        NavigationStack {
            Group {
                if session.isLoggedIn {
                    memberProfileList
                } else {
                    guestProfileList
                }
            }
            .scrollContentBackground(.hidden)
            .background(HBColors.cream.ignoresSafeArea())
            .navigationTitle("Profile")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        SettingsView()
                    } label: {
                        Image(systemName: "gearshape.fill")
                            .foregroundStyle(HBColors.gold)
                    }
                    .accessibilityLabel("Settings")
                }
            }
            .task {
                if session.isLoggedIn {
                    await loadWishlist()
                    await session.refreshProfile()
                }
            }
            .refreshable {
                guard session.isLoggedIn else { return }
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
            .sheet(isPresented: $showAdminHub) {
                AdminHubView()
                    .environmentObject(api)
                    .environmentObject(appModel)
            }
        }
    }

    private var guestProfileList: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Browsing as a guest")
                        .font(HBFont.headline())
                        .foregroundStyle(HBColors.charcoal)
                    Text("Sign in or create an account for order history, synced wishlist, messages, and notifications. You can also check out as a guest from your bag.")
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

                Button {
                    appModel.presentAuth(.register)
                } label: {
                    Label("Create an account", systemImage: "person.badge.plus")
                        .foregroundStyle(HBColors.charcoal)
                }
                .listRowBackground(HBColors.surface)
            }

            Section("Shopping") {
                NavigationLink {
                    CartView()
                } label: {
                    Label("Shopping bag", systemImage: "bag.fill")
                        .foregroundStyle(HBColors.charcoal)
                }
                .listRowBackground(HBColors.surface)
            }
        }
    }

    private var memberProfileList: some View {
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
                    if appModel.showAdminChrome {
                        Text("Store admin")
                            .font(HBFont.caption().weight(.semibold))
                            .foregroundStyle(HBColors.rosePink)
                            .padding(.top, 2)
                    }
                }
                .listRowBackground(HBColors.surface)
            }

            Section("Account") {
                NavigationLink {
                    AccountDetailsView()
                } label: {
                    Label("Account details", systemImage: "person.crop.circle")
                        .foregroundStyle(HBColors.charcoal)
                }
                .listRowBackground(HBColors.surface)

                NavigationLink {
                    PaymentMethodsView()
                } label: {
                    Label("Secure payments", systemImage: "lock.shield.fill")
                        .foregroundStyle(HBColors.charcoal)
                }
                .listRowBackground(HBColors.surface)
            }

            Section("Shipping") {
                NavigationLink {
                    AddressBookView()
                } label: {
                    Label("Shipping addresses", systemImage: "location.fill")
                        .foregroundStyle(HBColors.charcoal)
                }
                .listRowBackground(HBColors.surface)
            }

            Section("Returns") {
                NavigationLink {
                    ReturnsListView()
                } label: {
                    Label("My returns", systemImage: "arrow.uturn.left")
                        .foregroundStyle(HBColors.charcoal)
                }
                .listRowBackground(HBColors.surface)
            }

            if appModel.showAdminChrome {
                Section("Store admin") {
                    Button {
                        showAdminHub = true
                    } label: {
                        Label("Admin tools", systemImage: "gearshape.2")
                            .foregroundStyle(HBColors.charcoal)
                    }
                    .listRowBackground(HBColors.surface)
                }
            }

            if session.canOpenAdminPortal && appModel.customerViewPreview {
                Section("Customer view") {
                    Button {
                        appModel.exitCustomerViewPreview()
                        HBFeedback.light()
                    } label: {
                        Label("Exit customer view", systemImage: "arrow.uturn.backward.circle")
                            .foregroundStyle(HBColors.charcoal)
                    }
                    .listRowBackground(HBColors.surface)
                }
            }

            Section("Saved") {
                NavigationLink {
                    WishlistDetailView(products: wishlist)
                } label: {
                    Label("Wishlist", systemImage: "heart.fill")
                        .foregroundStyle(HBColors.charcoal)
                }
                .listRowBackground(HBColors.surface)

                NavigationLink {
                    CartView()
                } label: {
                    Label("Shopping bag", systemImage: "bag.fill")
                        .foregroundStyle(HBColors.charcoal)
                }
                .listRowBackground(HBColors.surface)
            }

            Section {
                Button("Sign out", role: .destructive) {
                    HBFeedback.light()
                    appModel.exitCustomerViewPreview()
                    Task { await session.logout() }
                }
                .listRowBackground(HBColors.surface)
            }

            Section {
                Button("Delete account", role: .destructive) {
                    showDeleteConfirm = true
                }
                .listRowBackground(HBColors.surface)
            } footer: {
                Text("Permanently deletes your account, saved addresses, wishlist, messages, notifications, and cart. Associated order rows are removed from your account; retain receipts if you need them.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            }
        }
    }

    private func deleteAccount() async {
        deleteError = nil
        do {
            try await api.requestVoid("/users/me", method: "DELETE")
            cart.clear()
            appModel.exitCustomerViewPreview()
            await session.logout()
            HBFeedback.success()
        } catch {
            deleteError = error.localizedDescription
            showDeleteError = true
            HBFeedback.warning()
        }
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
        Group {
            if products.isEmpty {
                HBEmptyState(
                    systemImage: "heart",
                    title: "Wishlist is empty",
                    message: "Tap the heart on a product to save it for later.",
                    retryTitle: nil,
                    retry: nil
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
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
            }
        }
        .hbScreenBackground()
        .navigationTitle("Wishlist")
    }
}

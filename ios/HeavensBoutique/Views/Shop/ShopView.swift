import SwiftUI

struct ShopView: View {
    var presetShopLook: Bool = false

    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var appModel: AppModel
    @StateObject private var vm = ShopViewModel()
    @State private var path = NavigationPath()
    @State private var showFilters = false
    @State private var searchDebounceTask: Task<Void, Never>?

    var body: some View {
        NavigationStack(path: $path) {
            // `GeometryReader` + explicit max width: without this, a wide intrinsic width from the
            // search `TextField` / chip row can expand the `ScrollView` content, and `LazyVGrid` lays out
            // as if the screen were that wide — the first product column then clips on the **left** edge.
            GeometryReader { geo in
                let viewWidth = max(0, geo.size.width)
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        searchRow
                        categoryChips
                        mainContent
                    }
                    .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 8)
                    .padding(.bottom, 24)
                    .padding(.horizontal, 20)
                    .frame(minWidth: 0, maxWidth: viewWidth, alignment: .topLeading)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .clipped()
                .refreshable { await vm.load(api: api) }
            }
            .hbScreenBackground()
            .navigationTitle("Shop")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        CartView()
                    } label: {
                        Image(systemName: "bag")
                            .foregroundStyle(HBColors.gold)
                    }
                    .accessibilityLabel("Shopping bag")
                }
            }
            .navigationDestination(for: ProductDTO.self) { p in
                ProductDetailView(product: p)
            }
            .task {
                if presetShopLook {
                    vm.shopTheLookGroup = "any"
                }
                await vm.load(api: api)
            }
            .onChange(of: appModel.pendingProductIdToOpen) { _, _ in
                Task { await openPendingProductIfNeeded() }
            }
            .task { await openPendingProductIfNeeded() }
            .sheet(isPresented: $showFilters) {
                NavigationStack {
                    ShopFiltersView(vm: vm)
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Close") { showFilters = false }
                            }
                        }
                }
            }
        }
    }

    private func openPendingProductIfNeeded() async {
        guard let id = appModel.pendingProductIdToOpen else { return }
        appModel.pendingProductIdToOpen = nil
        do {
            let r: ProductSingleResponse = try await api.request("/products/\(id)", method: "GET")
            path.append(r.product)
        } catch {
            // Ignore if not found; user stays in shop.
        }
    }

    private var searchRow: some View {
        HStack(spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(HBColors.mutedGray)
                TextField("Search", text: $vm.searchQuery)
                    .lineLimit(1)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .onChange(of: vm.searchQuery) { _, _ in
                        searchDebounceTask?.cancel()
                        searchDebounceTask = Task {
                            try? await Task.sleep(nanoseconds: 350_000_000)
                            await vm.load(api: api)
                        }
                    }
                if !vm.searchQuery.isEmpty {
                    Button {
                        vm.searchQuery = ""
                        HBFeedback.light()
                        Task { await vm.load(api: api) }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(HBColors.mutedGray)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear search")
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(HBColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            // Constrain the field so the row (and the whole `VStack` + product grid) cannot grow past the screen
            // width. An unconstrained `TextField` in an `HStack` can make layout width unbounded, shifting the grid
            // under the `ScrollView` and clipping the left side of the first product card.
            .frame(maxWidth: .infinity, alignment: .leading)

            Button {
                showFilters = true
                HBFeedback.light()
            } label: {
                Image(systemName: "line.3.horizontal.decrease.circle")
                    .font(.title3)
                    .foregroundStyle(HBColors.gold)
            }
            .accessibilityLabel("Filters")
        }
    }

    private var categoryChips: some View {
        // Horizontal `ScrollView` must not use intrinsic content width, or the parent `VStack`
        // grows to the full chips row width and the product grid below lays out as if the screen
        // were that wide — product cards can appear cut off on the left.
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                chip("All", selected: vm.selectedCategory == nil && vm.shopTheLookGroup == nil) {
                    vm.selectedCategory = nil
                    vm.shopTheLookGroup = nil
                    Task { await vm.load(api: api) }
                }
                if presetShopLook || vm.shopTheLookGroup != nil {
                    chip("Shop the Look", selected: vm.shopTheLookGroup != nil) {
                        vm.selectedCategory = nil
                        vm.shopTheLookGroup = "any"
                        Task { await vm.load(api: api) }
                    }
                }
                ForEach(vm.categories, id: \.self) { c in
                    chip(c, selected: vm.selectedCategory == c) {
                        vm.shopTheLookGroup = nil
                        vm.selectedCategory = c
                        Task { await vm.load(api: api) }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func chip(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(HBFont.caption().weight(.medium))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(selected ? HBColors.gold : HBColors.chipIdleBackground)
                .foregroundStyle(selected ? Color.white : HBColors.charcoal)
                .clipShape(Capsule())
                .shadow(color: .black.opacity(0.05), radius: 4, x: 0, y: 2)
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .animation(nil, value: selected)
        .accessibilityLabel(title)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    @ViewBuilder
    private var mainContent: some View {
        if vm.isLoading && vm.products.isEmpty {
            ProgressView("Loading pieces…")
                .tint(HBColors.gold)
                .frame(maxWidth: .infinity)
                .frame(minHeight: 280)
                .padding(.top, 40)
        } else if let err = vm.error {
            HBEmptyState(
                systemImage: "wifi.exclamationmark",
                title: "We couldn’t refresh",
                message: err,
                retryTitle: "Try again",
                retry: { Task { await vm.load(api: api) } }
            )
            .padding(.top, 24)
            .frame(maxWidth: .infinity)
        } else if vm.products.isEmpty {
            HBEmptyState(
                systemImage: "tshirt",
                title: "Nothing here yet",
                message: "Try another category or pull down to refresh — new arrivals land often.",
                retryTitle: "Refresh",
                retry: { Task { await vm.load(api: api) } }
            )
            .padding(.top, 24)
            .frame(maxWidth: .infinity)
        } else {
            LazyVGrid(
                columns: [
                    GridItem(.flexible(minimum: 0, maximum: .infinity), spacing: 12),
                    GridItem(.flexible(minimum: 0, maximum: .infinity), spacing: 12),
                ],
                alignment: .center,
                spacing: 12
            ) {
                ForEach(vm.products) { p in
                    Button {
                        path.append(p)
                    } label: {
                        ProductCardView(product: p)
                    }
                    .buttonStyle(.borderless)
                    .frame(minWidth: 0, maxWidth: .infinity, alignment: .center)
                }
            }
            .frame(minWidth: 0, maxWidth: .infinity, alignment: .center)
        }
    }
}

private struct ShopFiltersView: View {
    @ObservedObject var vm: ShopViewModel
    @EnvironmentObject private var api: APIClient

    @State private var minDollars = ""
    @State private var maxDollars = ""

    var body: some View {
        Form {
            Section("Sort") {
                Picker("Sort", selection: $vm.sort) {
                    ForEach(ShopViewModel.Sort.allCases) { s in
                        Text(s.title).tag(s)
                    }
                }
                .pickerStyle(.inline)
            }

            Section("Size") {
                Picker("Size", selection: Binding(
                    get: { vm.selectedSize ?? "" },
                    set: { vm.selectedSize = $0.isEmpty ? nil : $0 }
                )) {
                    Text("Any").tag("")
                    ForEach(vm.availableSizes, id: \.self) { s in
                        Text(s).tag(s)
                    }
                }
            }

            Section {
                TextField("Min (e.g. 50)", text: $minDollars)
                    .keyboardType(.numberPad)
                TextField("Max (e.g. 200)", text: $maxDollars)
                    .keyboardType(.numberPad)
                Button("Apply price") {
                    let minVal = Int(minDollars.trimmingCharacters(in: .whitespacesAndNewlines))
                    let maxVal = Int(maxDollars.trimmingCharacters(in: .whitespacesAndNewlines))
                    vm.minPriceCents = minVal.map { Swift.max(0, $0 * 100) }
                    vm.maxPriceCents = maxVal.map { Swift.max(0, $0 * 100) }
                    HBFeedback.light()
                    Task { await vm.load(api: api) }
                }
            } header: {
                Text("Price (USD)")
            } footer: {
                Text("Leave blank for no limit. Prices reflect sale prices when active.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            }

            Section {
                Button("Clear filters", role: .destructive) {
                    vm.selectedSize = nil
                    vm.minPriceCents = nil
                    vm.maxPriceCents = nil
                    vm.sort = .newest
                    minDollars = ""
                    maxDollars = ""
                    HBFeedback.light()
                    Task { await vm.load(api: api) }
                }
            }
        }
        .navigationTitle("Filters")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if let min = vm.minPriceCents { minDollars = String(min / 100) }
            if let max = vm.maxPriceCents { maxDollars = String(max / 100) }
        }
    }
}

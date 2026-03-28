import SwiftUI

struct ShopView: View {
    var presetShopLook: Bool = false

    @EnvironmentObject private var api: APIClient
    @StateObject private var vm = ShopViewModel()
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            VStack(alignment: .leading, spacing: 16) {
                categoryChips
                content
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
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
            .refreshable { await vm.load(api: api) }
        }
    }

    private var categoryChips: some View {
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
    }

    private func chip(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(HBFont.caption().weight(.medium))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(selected ? HBColors.gold : Color.white)
                .foregroundStyle(selected ? Color.white : HBColors.charcoal)
                .clipShape(Capsule())
                .shadow(color: .black.opacity(0.05), radius: 4, x: 0, y: 2)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var content: some View {
        if vm.isLoading {
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity).padding(.top, 40)
        } else if let err = vm.error {
            Text(err).foregroundStyle(HBColors.mutedGray).padding()
        } else {
            ScrollView {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 16), GridItem(.flexible(), spacing: 16)], spacing: 16) {
                    ForEach(vm.products) { p in
                        Button {
                            path.append(p)
                        } label: {
                            ProductCardView(product: p)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.bottom, 24)
            }
        }
    }
}

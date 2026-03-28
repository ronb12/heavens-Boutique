import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var session: SessionViewModel
    @StateObject private var vm = HomeViewModel()
    @State private var showAdmin = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    header
                    featuredBanner
                    if vm.isLoading {
                        ProgressView().frame(maxWidth: .infinity).padding()
                    } else if let err = vm.error {
                        Text(err).foregroundStyle(HBColors.mutedGray).padding()
                    }
                    Text("Featured")
                        .font(HBFont.headline())
                        .foregroundStyle(HBColors.charcoal)
                        .padding(.horizontal, 4)

                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 16), GridItem(.flexible(), spacing: 16)], spacing: 16) {
                        ForEach(vm.featured) { p in
                            NavigationLink {
                                ProductDetailView(product: p)
                            } label: {
                                ProductCardView(product: p)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(20)
            }
            .hbScreenBackground()
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
            .task { await vm.load(api: api) }
            .refreshable { await vm.load(api: api) }
            .sheet(isPresented: $showAdmin) {
                AdminHubView()
            }
        }
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Heaven's Boutique")
                    .font(HBFont.title(26))
                    .foregroundStyle(HBColors.charcoal)
                    .onLongPressGesture(minimumDuration: 1.2) {
                        if session.isAdmin {
                            showAdmin = true
                        }
                    }
                Text("Curated luxury, soft pink moments.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            }
            Spacer()
            Image(systemName: "sparkles")
                .font(.title2)
                .foregroundStyle(HBColors.gold)
                .padding(12)
                .background(Color.white.opacity(0.9))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .shadow(color: .black.opacity(0.06), radius: 6, x: 0, y: 2)
        }
    }

    private var featuredBanner: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: [HBColors.softPink.opacity(0.9), HBColors.cream], startPoint: .topLeading, endPoint: .bottomTrailing)
            VStack(alignment: .leading, spacing: 8) {
                Text("Shop the Look")
                    .font(HBFont.headline())
                    .foregroundStyle(HBColors.charcoal)
                Text("Pair pieces that belong together — ask us for styling help in Messages.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
                NavigationLink {
                    ShopView(presetShopLook: true)
                } label: {
                    Text("Explore")
                        .font(HBFont.caption().weight(.semibold))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(HBColors.gold)
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                }
                .padding(.top, 4)
            }
            .padding(22)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 160)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: .black.opacity(0.06), radius: 8, x: 0, y: 4)
    }
}

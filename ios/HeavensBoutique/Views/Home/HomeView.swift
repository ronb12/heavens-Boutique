import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var session: SessionViewModel
    @EnvironmentObject private var appModel: AppModel
    @StateObject private var vm = HomeViewModel()
    @State private var showAdmin = false
    @State private var heroAppeared = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    header
                    featuredBanner
                    if vm.isLoading && vm.featured.isEmpty {
                        ProgressView("Loading picks…")
                            .tint(HBColors.gold)
                            .frame(maxWidth: .infinity)
                            .padding()
                    } else if let err = vm.error, vm.featured.isEmpty {
                        HBEmptyState(
                            systemImage: "sparkles",
                            title: "Featured items paused",
                            message: err,
                            retryTitle: "Try again",
                            retry: { Task { await vm.load(api: api) } }
                        )
                    } else if vm.featured.isEmpty {
                        HBEmptyState(
                            systemImage: "sparkles",
                            title: "Featured coming soon",
                            message: "Pull down to refresh — we’re curating new arrivals.",
                            retryTitle: "Refresh",
                            retry: { Task { await vm.load(api: api) } }
                        )
                    } else {
                        sectionTitle("Featured")
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
                }
                .padding(20)
            }
            .hbScreenBackground()
            .toolbar {
                if appModel.showAdminChrome {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            showAdmin = true
                        } label: {
                            Image(systemName: "gearshape.2")
                                .foregroundStyle(HBColors.gold)
                        }
                        .accessibilityLabel("Store admin")
                    }
                }
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
            .task { await vm.load(api: api) }
            .refreshable { await vm.load(api: api) }
            .sheet(isPresented: $showAdmin) {
                AdminHubView()
            }
            .onAppear {
                withAnimation(.spring(response: 0.5, dampingFraction: 0.85).delay(0.05)) {
                    heroAppeared = true
                }
            }
        }
    }

    private func sectionTitle(_ text: String) -> some View {
        HStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 2)
                .fill(
                    LinearGradient(
                        colors: [HBColors.gold, HBColors.rosePink.opacity(0.7)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(width: 4, height: 22)
            Text(text)
                .font(HBFont.headline())
                .foregroundStyle(HBColors.charcoal)
        }
        .padding(.horizontal, 4)
    }

    private var header: some View {
        ZStack(alignment: .topTrailing) {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            HBColors.heroGradientTop,
                            HBColors.softPink.opacity(0.35),
                            HBColors.cream
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .shadow(color: .black.opacity(0.06), radius: 16, x: 0, y: 8)
                .overlay(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .strokeBorder(
                            LinearGradient(
                                colors: [HBColors.softPink.opacity(0.8), HBColors.goldLight.opacity(0.4)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1
                        )
                )

            HStack(alignment: .center, spacing: 16) {
                HBBrandAppIcon(size: 56, showShadow: true)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 10) {
                    HBWordmarkWithRoses(roseSize: 24, spacing: 8) {
                        Text("Heaven's Boutique")
                            .font(HBFont.wordmark(30))
                            .foregroundStyle(HBColors.charcoal)
                            .minimumScaleFactor(0.8)
                            .onLongPressGesture(minimumDuration: 1.2) {
                                if appModel.showAdminChrome {
                                    showAdmin = true
                                }
                            }
                            .accessibilityHint(appModel.showAdminChrome ? "Also open admin from the gear button above or Profile." : "")
                    }

                    Text("Curated luxury, soft pink moments.")
                        .font(HBFont.body())
                        .foregroundStyle(HBColors.mutedGray)
                        .fixedSize(horizontal: false, vertical: true)

                    HStack(spacing: 6) {
                        Image(systemName: "star.fill")
                            .font(.caption)
                            .foregroundStyle(HBColors.gold)
                        Text("New arrivals weekly")
                            .font(HBFont.caption().weight(.medium))
                            .foregroundStyle(HBColors.charcoal.opacity(0.7))
                    }
                }

                Spacer(minLength: 8)
            }
            .padding(22)
        }
        .scaleEffect(heroAppeared ? 1 : 0.96)
        .opacity(heroAppeared ? 1 : 0)
    }

    private var featuredBanner: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(
                colors: [
                    HBColors.rosePink.opacity(0.55),
                    HBColors.softPink.opacity(0.75),
                    HBColors.cream
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            Image(systemName: "tshirt.fill")
                .font(.system(size: 120, weight: .ultraLight))
                .foregroundStyle(HBColors.bannerWatermark)
                .rotationEffect(.degrees(-12))
                .offset(x: 120, y: -20)

            VStack(alignment: .leading, spacing: 12) {
                Text("Shop the Look")
                    .font(HBFont.title(22))
                    .foregroundStyle(HBColors.charcoal)

                Text("Pieces that belong together—tap Explore or message us for a personal edit.")
                    .font(HBFont.body())
                    .foregroundStyle(HBColors.charcoal.opacity(0.72))
                    .fixedSize(horizontal: false, vertical: true)

                NavigationLink {
                    ShopView(presetShopLook: true)
                } label: {
                    HStack(spacing: 8) {
                        Text("Explore")
                            .font(.system(size: 15, weight: .semibold, design: .default))
                        Image(systemName: "arrow.right")
                            .font(.system(size: 13, weight: .bold))
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(
                        LinearGradient(
                            colors: [HBColors.gold, HBColors.gold.opacity(0.88)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
                    .shadow(color: HBColors.gold.opacity(0.35), radius: 10, x: 0, y: 5)
                }
                .padding(.top, 4)
            }
            .padding(24)
        }
        .frame(maxWidth: .infinity)
        .frame(minHeight: 200)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: .black.opacity(0.08), radius: 18, x: 0, y: 10)
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(HBColors.gradientCardStroke, lineWidth: 1)
        )
    }
}

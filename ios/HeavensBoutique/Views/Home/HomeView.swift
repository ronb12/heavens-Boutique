import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var session: SessionViewModel
    @EnvironmentObject private var appModel: AppModel
    @StateObject private var vm = HomeViewModel()
    @State private var showAdmin = false
    @State private var heroAppeared = false
    @State private var featuredAppeared = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        NavigationStack {
            ZStack {
                HBHomeAmbientBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 28) {
                        header
                        homepageBanners
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
                                .opacity(featuredAppeared ? 1 : 0)
                                .offset(y: featuredAppeared ? 0 : 10)
                                .animation(
                                    reduceMotion ? .easeOut(duration: 0.22) : .spring(response: 0.5, dampingFraction: 0.88).delay(0.06),
                                    value: featuredAppeared
                                )
                            LazyVGrid(columns: [GridItem(.flexible(), spacing: 16), GridItem(.flexible(), spacing: 16)], spacing: 16) {
                                ForEach(Array(vm.featured.enumerated()), id: \.element.id) { index, p in
                                    NavigationLink {
                                        ProductDetailView(product: p)
                                    } label: {
                                        ProductCardView(product: p)
                                    }
                                    .buttonStyle(.plain)
                                    .opacity(featuredAppeared ? 1 : 0)
                                    .offset(y: featuredAppeared ? 0 : 18)
                                    .animation(
                                        reduceMotion
                                            ? .easeOut(duration: 0.25)
                                            : .spring(response: 0.45, dampingFraction: 0.82).delay(Double(index) * 0.05),
                                        value: featuredAppeared
                                    )
                                }
                            }
                        }

                        ForEach(vm.homepage.collections, id: \.id) { c in
                            if let products = vm.collectionProducts[c.title], !products.isEmpty {
                                sectionTitle(c.title)
                                    .opacity(featuredAppeared ? 1 : 0)
                                    .offset(y: featuredAppeared ? 0 : 8)
                                    .animation(
                                        reduceMotion ? .easeOut(duration: 0.22) : .spring(response: 0.48, dampingFraction: 0.86),
                                        value: featuredAppeared
                                    )
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 14) {
                                        ForEach(Array(products.enumerated()), id: \.element.id) { index, p in
                                            NavigationLink {
                                                ProductDetailView(product: p)
                                            } label: {
                                                ProductCardView(product: p)
                                                    .frame(width: 170)
                                            }
                                            .buttonStyle(.plain)
                                            .opacity(featuredAppeared ? 1 : 0)
                                            .offset(x: featuredAppeared ? 0 : 24)
                                            .animation(
                                                .spring(response: 0.48, dampingFraction: 0.84).delay(Double(index) * 0.06),
                                                value: featuredAppeared
                                            )
                                        }
                                    }
                                    .padding(.horizontal, 4)
                                }
                            }
                        }
                    }
                    .padding(20)
                }
                .scrollContentBackground(.hidden)
            }
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
                if reduceMotion {
                    featuredAppeared = true
                } else {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) {
                        withAnimation(.spring(response: 0.52, dampingFraction: 0.86)) {
                            featuredAppeared = true
                        }
                    }
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
        Group {
            if let hero = vm.homepage.hero,
               let raw = hero.imageUrl?.trimmingCharacters(in: .whitespacesAndNewlines),
               !raw.isEmpty,
               let url = URL(string: raw)
            {
                SyncedHeroView(hero: hero, imageURL: url)
            } else {
                defaultBrandHeaderCard
            }
        }
        .scaleEffect(heroAppeared ? 1 : 0.96)
        .opacity(heroAppeared ? 1 : 0)
    }

    private var defaultBrandHeaderCard: some View {
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
    }

    private var homepageBanners: some View {
        Group {
            if vm.homepage.banners.isEmpty {
                defaultShopTheLookBanner
            } else {
                TabView {
                    ForEach(vm.homepage.banners) { b in
                        HomepageBannerCard(banner: b)
                    }
                }
                .frame(height: 210)
                .tabViewStyle(.page(indexDisplayMode: .automatic))
            }
        }
    }

    private var defaultShopTheLookBanner: some View {
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

// MARK: - Synced CMS hero (same JSON as website `HomeHero`)

private enum HeroAnimStyle: String {
    case kenburns
    case subtleZoom
    case fade
    case none

    init(_ raw: String?) {
        let s = (raw ?? "").lowercased()
        switch s {
        case "fade": self = .fade
        case "subtle-zoom", "subtlezoom": self = .subtleZoom
        case "none": self = .none
        default: self = .kenburns
        }
    }
}

private struct SyncedHeroView: View {
    let hero: HomepageHeroDTO
    let imageURL: URL

    @State private var zoomPulse = false
    @State private var fadePulse = false

    private var anim: HeroAnimStyle { HeroAnimStyle(hero.animation) }

    private var ctaDisplayTitle: String {
        guard let raw = hero.ctaLabel?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else { return "Shop now" }
        return raw
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            GeometryReader { geo in
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .success(let img):
                        img
                            .resizable()
                            .scaledToFill()
                            .frame(width: geo.size.width, height: geo.size.height)
                            .clipped()
                            .scaleEffect(zoomScale)
                    case .failure:
                        LinearGradient(
                            colors: [HBColors.softPink.opacity(0.55), HBColors.cream],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    case .empty:
                        ProgressView()
                            .tint(HBColors.gold)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    @unknown default:
                        Color.clear
                    }
                }
                .frame(width: geo.size.width, height: geo.size.height)
                .clipped()
            }
            .frame(minHeight: 220, idealHeight: 280, maxHeight: 360)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))

            if anim == .fade {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(Color.black.opacity(fadePulse ? 0.38 : 0.18))
                    .allowsHitTesting(false)
            }

            LinearGradient(
                colors: [.black.opacity(0.1), .black.opacity(0.58)],
                startPoint: .top,
                endPoint: .bottom
            )
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .allowsHitTesting(false)

            VStack(alignment: .leading, spacing: 10) {
                if let eye = hero.eyebrow?.trimmingCharacters(in: .whitespacesAndNewlines), !eye.isEmpty {
                    Text(eye.uppercased())
                        .font(.system(size: 11, weight: .semibold, design: .default))
                        .tracking(2.8)
                        .foregroundStyle(Color.white.opacity(0.92))
                }
                if let t = hero.title?.trimmingCharacters(in: .whitespacesAndNewlines), !t.isEmpty {
                    Text(t)
                        .font(HBFont.title(26))
                        .foregroundStyle(Color.white)
                        .shadow(color: .black.opacity(0.35), radius: 6, x: 0, y: 2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let s = hero.subtitle?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty {
                    Text(s)
                        .font(HBFont.body())
                        .foregroundStyle(Color.white.opacity(0.92))
                        .fixedSize(horizontal: false, vertical: true)
                }

                NavigationLink {
                    ShopView()
                } label: {
                    HStack(spacing: 8) {
                        Text(ctaDisplayTitle)
                            .font(.system(size: 15, weight: .semibold))
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
                    .foregroundStyle(HBColors.charcoal)
                    .clipShape(Capsule())
                    .shadow(color: HBColors.gold.opacity(0.35), radius: 10, x: 0, y: 5)
                }
                .padding(.top, 4)
                .accessibilityLabel(ctaDisplayTitle)
            }
            .padding(22)
        }
        .shadow(color: .black.opacity(0.12), radius: 18, x: 0, y: 10)
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(HBColors.gradientCardStroke, lineWidth: 1)
        )
        .onAppear {
            switch anim {
            case .none:
                break
            case .fade:
                withAnimation(.easeInOut(duration: 6).repeatForever(autoreverses: true)) {
                    fadePulse.toggle()
                }
            case .kenburns:
                zoomPulse = false
                withAnimation(.easeInOut(duration: 18).repeatForever(autoreverses: true)) {
                    zoomPulse = true
                }
            case .subtleZoom:
                zoomPulse = false
                withAnimation(.easeInOut(duration: 22).repeatForever(autoreverses: true)) {
                    zoomPulse = true
                }
            }
        }
    }

    private var zoomScale: CGFloat {
        guard anim != .fade, anim != .none else { return 1.0 }
        let target: CGFloat = anim == .kenburns ? 1.12 : 1.06
        return zoomPulse ? target : 1.0
    }
}

private struct HomepageBannerCard: View {
    let banner: HomepageBannerDTO

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if let u = banner.imageUrl, let url = URL(string: u) {
                AsyncImage(url: url) { phase in
                    if case .success(let img) = phase {
                        img.resizable().scaledToFill()
                    } else {
                        HBColors.softPink.opacity(0.25)
                    }
                }
            } else {
                LinearGradient(
                    colors: [HBColors.softPink.opacity(0.55), HBColors.cream],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }

            LinearGradient(colors: [.black.opacity(0.0), .black.opacity(0.35)], startPoint: .top, endPoint: .bottom)

            VStack(alignment: .leading, spacing: 8) {
                Text(banner.title)
                    .font(HBFont.title(22))
                    .foregroundStyle(.white)
                if let sub = banner.subtitle, !sub.isEmpty {
                    Text(sub)
                        .font(HBFont.body())
                        .foregroundStyle(.white.opacity(0.9))
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let cta = banner.ctaLabel, !cta.isEmpty {
                    Text(cta)
                        .font(.system(size: 15, weight: .semibold))
                        .padding(.horizontal, 18)
                        .padding(.vertical, 10)
                        .background(HBColors.gold)
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                }
            }
            .padding(18)
        }
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: .black.opacity(0.08), radius: 18, x: 0, y: 10)
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(HBColors.gradientCardStroke, lineWidth: 1)
        )
        .accessibilityLabel(banner.title)
    }
}

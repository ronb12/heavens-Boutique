import SwiftUI

/// Admin: edit what shoppers see on the Home tab — forms and short explanations, not raw code.
struct AdminHomepageCMSView: View {
    @EnvironmentObject private var api: APIClient
    @State private var content = HomepageContentDTO(banners: [], collections: [], hero: nil)
    @State private var showHero = false
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var error: String?
    @State private var saved = false

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading your home screen…")
                    .tint(HBColors.gold)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        introBlock

                        adminSection(title: "Big photo at the top") {
                            Toggle("Use my own photo and words up top", isOn: $showHero)
                                .font(.body)
                                .tint(HBColors.gold)
                                .onChange(of: showHero) { _, on in
                                    if on, content.hero == nil {
                                        content.hero = Self.defaultHeroDraft
                                    }
                                    if !on {
                                        content.hero = nil
                                    }
                                }

                            if showHero {
                                AdminHomeHeroForm(hero: heroBinding)
                            } else {
                                Text("When this is off, shoppers see the usual pink welcome area with the store name.")
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.mutedGray)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }

                        adminSection(title: "Swipe promos (app)") {
                            Text("Wide cards customers swipe sideways on the iPhone Home tab, under the big top area.")
                                .font(HBFont.caption())
                                .foregroundStyle(HBColors.mutedGray)
                                .fixedSize(horizontal: false, vertical: true)

                            ForEach(Array(content.banners.enumerated()), id: \.offset) { index, _ in
                                AdminHomeBannerCard(
                                    index: index + 1,
                                    banner: bannerBinding(at: index),
                                    onRemove: { removeBanner(at: index) }
                                )
                            }

                            Button {
                                content.banners.append(
                                    HomepageBannerDTO(
                                        title: "New promo",
                                        subtitle: nil,
                                        imageUrl: nil,
                                        ctaLabel: "Shop",
                                        ctaPath: nil
                                    )
                                )
                            } label: {
                                Label("Add another promo card", systemImage: "plus.circle.fill")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(HBColors.gold)
                            }
                            .padding(.top, 4)
                        }

                        adminSection(title: "Extra product rows (app)") {
                            Text("Each row has a title shoppers see (like “New arrivals”) and a simple rule for which products to show.")
                                .font(HBFont.caption())
                                .foregroundStyle(HBColors.mutedGray)
                                .fixedSize(horizontal: false, vertical: true)

                            ForEach(Array(content.collections.enumerated()), id: \.offset) { index, _ in
                                AdminHomeCollectionCard(
                                    index: index + 1,
                                    collection: collectionBinding(at: index),
                                    onRemove: { removeCollection(at: index) }
                                )
                            }

                            Button {
                                content.collections.append(
                                    HomepageCollectionDTO(title: "New row", query: nil)
                                )
                            } label: {
                                Label("Add another product row", systemImage: "plus.circle.fill")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(HBColors.gold)
                            }
                            .padding(.top, 4)
                        }

                        if let error {
                            Text(error)
                                .font(HBFont.caption())
                                .foregroundStyle(HBColors.rosePink)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        HBPrimaryButton(title: "Save for shoppers", isLoading: isSaving) {
                            Task { await save() }
                        }
                        .padding(.top, 8)

                        Text("Changes appear in the app after you save. Pull down on Home to refresh.")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 20)
                    .padding(.bottom, 28)
                }
            }
        }
        .hbScreenBackground()
        .navigationTitle("Home screen")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .alert("Saved", isPresented: $saved) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Your home screen was updated. Shoppers will see it after the app refreshes.")
        }
    }

    private var introBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("This is what customers see on the Home tab.")
                .font(.subheadline)
                .foregroundStyle(HBColors.charcoal)
            Text("Fill in the sections below with picture links, titles, and short lines of text. Everything is plain English — no tech knowledge needed.")
                .font(HBFont.caption())
                .foregroundStyle(HBColors.mutedGray)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(HBColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color.black.opacity(0.06), lineWidth: 1)
        )
    }

    private func adminSection<Content: View>(title: String, @ViewBuilder content: @escaping () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title.uppercased())
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(HBColors.mutedGray)
                .tracking(0.6)
            content()
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(HBColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(Color.black.opacity(0.06), lineWidth: 1)
                )
        }
    }

    private var heroBinding: Binding<HomepageHeroDTO> {
        Binding(
            get: {
                content.hero ?? Self.defaultHeroDraft
            },
            set: { content.hero = $0 }
        )
    }

    private func bannerBinding(at index: Int) -> Binding<HomepageBannerDTO> {
        Binding(
            get: { content.banners[index] },
            set: { content.banners[index] = $0 }
        )
    }

    private func collectionBinding(at index: Int) -> Binding<HomepageCollectionDTO> {
        Binding(
            get: { content.collections[index] },
            set: { content.collections[index] = $0 }
        )
    }

    private func removeBanner(at index: Int) {
        guard content.banners.indices.contains(index) else { return }
        content.banners.remove(at: index)
    }

    private func removeCollection(at index: Int) {
        guard content.collections.indices.contains(index) else { return }
        content.collections.remove(at: index)
    }

    private static let defaultHeroDraft = HomepageHeroDTO(
        imageUrl: nil,
        animation: "kenburns",
        eyebrow: nil,
        title: nil,
        subtitle: nil,
        ctaLabel: "Shop now",
        ctaHref: nil
    )

    private func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let r: HomepageResponse = try await api.request("/admin/homepage", method: "GET")
            var loaded = r.content
            if let h = loaded.hero, Self.heroHasAnyContent(h) {
                content = loaded
                showHero = true
            } else {
                loaded.hero = nil
                content = loaded
                showHero = false
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    private static func heroHasAnyContent(_ h: HomepageHeroDTO) -> Bool {
        let strings = [h.imageUrl, h.title, h.subtitle, h.eyebrow, h.ctaLabel, h.ctaHref]
        return strings.contains { s in
            guard let t = s?.trimmingCharacters(in: .whitespacesAndNewlines) else { return false }
            return !t.isEmpty
        }
    }

    private func save() async {
        isSaving = true
        error = nil
        defer { isSaving = false }
        do {
            var out = content
            if !showHero {
                out.hero = nil
            } else if let h = out.hero, !Self.heroHasAnyContent(h) {
                out.hero = nil
            }
            let data = try JSONEncoder().encode(out)
            let obj = try JSONSerialization.jsonObject(with: data)
            guard let dict = obj as? [String: Any] else {
                error = "Couldn’t prepare your changes. Try again."
                return
            }
            try await api.requestVoid("/admin/homepage", method: "POST", jsonBody: ["content": dict])
            HBFeedback.success()
            saved = true
        } catch {
            HBFeedback.warning()
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Hero form

private struct AdminHomeHeroForm: View {
    @Binding var hero: HomepageHeroDTO

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            labeledField("Link to your photo") {
                TextField("https://… (copy from your site or photo host)", text: stringBinding(\.imageUrl))
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    .font(.body)
            }
            footnote("Must start with https. If it’s blank, the app won’t show this custom top area.")

            labeledField("Small label above the headline (optional)") {
                TextField("e.g. New collection", text: stringBinding(\.eyebrow))
                    .font(.body)
            }

            labeledField("Headline") {
                TextField("e.g. Spring favorites", text: stringBinding(\.title))
                    .font(.body)
            }

            labeledField("Supporting sentence (optional)") {
                TextField("A short line under the headline", text: stringBinding(\.subtitle), axis: .vertical)
                    .lineLimit(2...4)
                    .font(.body)
            }

            labeledField("Button wording") {
                TextField("e.g. Shop now", text: stringBinding(\.ctaLabel))
                    .font(.body)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Photo motion")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(HBColors.charcoal)
                Picker("Photo motion", selection: animationBinding) {
                    Text("Gentle zoom").tag("kenburns")
                    Text("Soft fade").tag("fade")
                    Text("Light zoom").tag("subtle-zoom")
                    Text("No motion").tag("none")
                }
                .pickerStyle(.menu)
                .tint(HBColors.gold)
            }

            labeledField("Website-style button link (optional)") {
                TextField("Usually /shop — for the website", text: stringBinding(\.ctaHref))
                    .textInputAutocapitalization(.never)
                    .font(.body)
            }
            footnote("The app button still opens the shop; this mainly matches your website.")
        }
    }

    private func labeledField<Content: View>(_ title: String, @ViewBuilder field: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(HBColors.charcoal)
            field()
                .padding(10)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
    }

    private func footnote(_ s: String) -> some View {
        Text(s)
            .font(HBFont.caption())
            .foregroundStyle(HBColors.mutedGray)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var animationBinding: Binding<String> {
        Binding(
            get: {
                let raw = hero.animation?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
                if ["fade", "subtle-zoom", "none"].contains(raw) { return raw == "subtle-zoom" ? "subtle-zoom" : raw }
                return "kenburns"
            },
            set: { hero.animation = $0 }
        )
    }

    private func stringBinding(_ keyPath: WritableKeyPath<HomepageHeroDTO, String?>) -> Binding<String> {
        Binding(
            get: { hero[keyPath: keyPath] ?? "" },
            set: { hero[keyPath: keyPath] = $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : $0 }
        )
    }
}

// MARK: - Banner card editor

private struct AdminHomeBannerCard: View {
    let index: Int
    @Binding var banner: HomepageBannerDTO
    var onRemove: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Card \(index)")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(HBColors.charcoal)
                Spacer()
                Button(role: .destructive, action: onRemove) {
                    Image(systemName: "trash")
                        .font(.body)
                }
            }

            field("Title on the card") {
                TextField("e.g. Mother’s Day edit", text: stringBinding(\.title))
                    .font(.body)
            }
            field("Subtitle (optional)") {
                TextField("Smaller text under the title", text: stringBinding(\.subtitle), axis: .vertical)
                    .lineLimit(2...4)
                    .font(.body)
            }
            field("Photo link") {
                TextField("https://…", text: stringBinding(\.imageUrl))
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    .font(.body)
            }
            field("Words on the button (optional)") {
                TextField("e.g. Shop dresses", text: stringBinding(\.ctaLabel))
                    .font(.body)
            }
            field("Where the button goes (optional, advanced)") {
                TextField("Leave blank unless support gave you a code", text: stringBinding(\.ctaPath))
                    .textInputAutocapitalization(.never)
                    .font(.body)
            }
        }
        .padding(12)
        .background(Color(uiColor: .secondarySystemGroupedBackground).opacity(0.65))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func field<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(HBFont.caption().weight(.semibold))
                .foregroundStyle(HBColors.charcoal)
            content()
                .padding(8)
                .background(HBColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        }
    }

    private func stringBinding(_ keyPath: WritableKeyPath<HomepageBannerDTO, String?>) -> Binding<String> {
        Binding(
            get: { banner[keyPath: keyPath] ?? "" },
            set: { banner[keyPath: keyPath] = $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : $0 }
        )
    }

    private func stringBinding(_ keyPath: WritableKeyPath<HomepageBannerDTO, String>) -> Binding<String> {
        Binding(
            get: { banner[keyPath: keyPath] },
            set: { banner[keyPath: keyPath] = $0 }
        )
    }
}

// MARK: - Collection row editor

private struct AdminHomeCollectionCard: View {
    private enum CollectionFilterKind: String, CaseIterable, Hashable {
        case all
        case featured
        case category
        case custom
    }

    let index: Int
    @Binding var collection: HomepageCollectionDTO
    var onRemove: () -> Void

    @State private var filterKind: CollectionFilterKind = .all
    @State private var categoryName: String = ""
    @State private var customQuery: String = ""

    private var titleBinding: Binding<String> {
        Binding(
            get: { collection.title },
            set: { collection.title = $0 }
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Row \(index)")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(HBColors.charcoal)
                Spacer()
                Button(role: .destructive, action: onRemove) {
                    Image(systemName: "trash")
                        .font(.body)
                }
            }

            field("Row title (customers see this)") {
                TextField("e.g. Best sellers", text: titleBinding)
                    .font(.body)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("What products appear here?")
                    .font(HBFont.caption().weight(.semibold))
                    .foregroundStyle(HBColors.charcoal)
                Picker("Filter", selection: $filterKind) {
                    Text("Featured products").tag(CollectionFilterKind.featured)
                    Text("One category").tag(CollectionFilterKind.category)
                    Text("All products").tag(CollectionFilterKind.all)
                    Text("Custom — ask support first").tag(CollectionFilterKind.custom)
                }
                .pickerStyle(.menu)
                .tint(HBColors.gold)

                if filterKind == .category {
                    TextField("Category name (match your products exactly)", text: $categoryName)
                        .font(.body)
                        .padding(8)
                        .background(HBColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                }

                if filterKind == .custom {
                    TextField("e.g. featured=1 or category=Dresses", text: $customQuery)
                        .textInputAutocapitalization(.never)
                        .font(.body)
                        .padding(8)
                        .background(HBColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                }
            }

            Text("“Featured” shows products you mark as featured in your catalog.")
                .font(HBFont.caption())
                .foregroundStyle(HBColors.mutedGray)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .background(Color(uiColor: .secondarySystemGroupedBackground).opacity(0.65))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .onAppear { syncFilterStateFromQuery() }
        .onChange(of: collection.query) { _, _ in syncFilterStateFromQuery() }
        .onChange(of: filterKind) { _, _ in applyFilterToCollection() }
        .onChange(of: categoryName) { _, _ in
            if filterKind == .category { applyFilterToCollection() }
        }
        .onChange(of: customQuery) { _, _ in
            if filterKind == .custom { applyFilterToCollection() }
        }
    }

    private func field<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(HBFont.caption().weight(.semibold))
                .foregroundStyle(HBColors.charcoal)
            content()
                .padding(8)
                .background(HBColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        }
    }

    private func syncFilterStateFromQuery() {
        let q = (collection.query ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if q.isEmpty {
            // Avoid snapping back to “All” while the owner is mid-edit (empty category/custom field).
            if filterKind == .category || filterKind == .custom {
                return
            }
            filterKind = .all
            categoryName = ""
            customQuery = ""
            return
        }
        if q == "featured=1" || q == "featured=true" {
            filterKind = .featured
            categoryName = ""
            customQuery = ""
            return
        }
        if q.hasPrefix("category=") {
            filterKind = .category
            let rest = q.dropFirst("category=".count)
            categoryName = rest.removingPercentEncoding ?? String(rest)
            customQuery = ""
            return
        }
        filterKind = .custom
        customQuery = q
        categoryName = ""
    }

    private func applyFilterToCollection() {
        switch filterKind {
        case .all:
            collection.query = nil
            categoryName = ""
            customQuery = ""
        case .featured:
            collection.query = "featured=1"
            categoryName = ""
            customQuery = ""
        case .category:
            customQuery = ""
            let trimmed = categoryName.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty {
                collection.query = nil
            } else if let enc = trimmed.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
                collection.query = "category=\(enc)"
            } else {
                collection.query = "category=\(trimmed)"
            }
        case .custom:
            categoryName = ""
            let t = customQuery.trimmingCharacters(in: .whitespacesAndNewlines)
            collection.query = t.isEmpty ? nil : t
        }
    }
}

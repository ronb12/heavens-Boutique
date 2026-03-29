import PhotosUI
import SwiftUI
import UIKit

/// Create or edit catalog + inventory. Sectioned editor: media → title → description → pricing → inventory → organization.
struct AdminProductEditorView: View {
    let productId: String?
    var onCatalogChanged: (() -> Void)?

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var api: APIClient

    @State private var name = ""
    @State private var slug = ""
    @State private var description = ""
    @State private var category = ""
    /// What the customer pays (maps to `priceCents` alone, or `salePriceCents` when compare-at is set).
    @State private var sellingPriceDollars = ""
    /// Optional higher “was” price (strike-through); maps to `priceCents` when sale is active.
    @State private var compareAtPriceDollars = ""
    @State private var costDollars = ""
    @State private var isFeatured = false
    @State private var shopLookGroup = ""
    @State private var imageEntries: [AdminProductImageEntry] = []
    @State private var manualPublicIdsText = ""
    @State private var photoPickerItems: [PhotosPickerItem] = []

    @State private var variantRows: [AdminVariantRow] = []
    @State private var removedVariantIds: [String] = []

    @State private var isLoading = false
    @State private var isSaving = false
    @State private var isUploadingImages = false
    @State private var errorMessage: String?
    @State private var confirmDeleteProduct = false
    @State private var showAdvanced = false

    private var isEditing: Bool { productId != nil }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if isUploadingImages {
                    HStack(spacing: 10) {
                        ProgressView()
                        Text("Uploading media…")
                            .font(.subheadline)
                            .foregroundStyle(HBColors.mutedGray)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 4)
                }

                adminFormSection(title: "Media") {
                    mediaBlock
                }

                adminFormSection(title: "Title") {
                    TextField("Short sleeve t-shirt", text: $name)
                        .font(.body)
                        .textInputAutocapitalization(.sentences)
                }

                adminFormSection(title: "Description") {
                    TextField("Describe this product for customers…", text: $description, axis: .vertical)
                        .lineLimit(5...14)
                        .font(.body)
                }

                adminFormSection(title: "Pricing") {
                    VStack(alignment: .leading, spacing: 14) {
                        labeledField("Price", subtitle: "What customers pay") {
                            TextField("0.00", text: $sellingPriceDollars)
                                .keyboardType(.decimalPad)
                                .font(.body.monospacedDigit())
                        }
                        labeledField("Compare-at price", subtitle: "Optional — shows as strikethrough when lower than this") {
                            TextField("Optional", text: $compareAtPriceDollars)
                                .keyboardType(.decimalPad)
                                .font(.body.monospacedDigit())
                        }

                        DisclosureGroup {
                            VStack(alignment: .leading, spacing: 12) {
                                labeledField("Cost per item", subtitle: "Your cost; shoppers never see this") {
                                    TextField("0.00", text: $costDollars)
                                        .keyboardType(.decimalPad)
                                        .font(.body.monospacedDigit())
                                }
                                if let line = profitSummaryLine {
                                    Text(line.text)
                                        .font(HBFont.caption())
                                        .foregroundStyle(line.isLoss ? Color.red : HBColors.mutedGray)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                            .padding(.top, 8)
                        } label: {
                            Text("Cost & profit")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(HBColors.charcoal)
                        }
                    }
                }

                adminFormSection(title: "Inventory") {
                    VStack(alignment: .leading, spacing: 16) {
                        ForEach($variantRows) { $row in
                            variantEditorRow($row)
                        }
                        Button {
                            variantRows.append(AdminVariantRow())
                        } label: {
                            Label("Add variant", systemImage: "plus.circle.fill")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(HBColors.gold)
                        }
                        .padding(.top, 4)
                    }
                }

                adminFormSection(title: "Organization") {
                    VStack(alignment: .leading, spacing: 14) {
                        labeledField("Product category", subtitle: "Used for Shop filters") {
                            TextField("Dresses, Accessories…", text: $category)
                                .font(.body)
                        }
                        labeledField("Shop the Look", subtitle: "Optional group id for curated sets") {
                            TextField("e.g. spring-soiree", text: $shopLookGroup)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .font(.body)
                        }
                        Toggle(isOn: $isFeatured) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Featured on Home")
                                    .font(.body)
                                Text("Shows in the home carousel when on")
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.mutedGray)
                            }
                        }
                        .tint(HBColors.gold)
                    }
                }

                DisclosureGroup(isExpanded: $showAdvanced) {
                    VStack(alignment: .leading, spacing: 14) {
                        labeledField("URL handle", subtitle: "Leave blank to auto-generate from title") {
                            TextField("my-product-handle", text: $slug)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .font(.body.monospaced())
                        }
                        DisclosureGroup("Paste image IDs (advanced)") {
                            TextField("folder/item, https://…", text: $manualPublicIdsText, axis: .vertical)
                                .lineLimit(2...5)
                            Button("Apply list (replaces gallery order)") {
                                applyManualPublicIds()
                            }
                            .font(HBFont.caption())
                        }
                        .font(.subheadline)
                    }
                    .padding(.top, 8)
                } label: {
                    Text("Advanced")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(HBColors.charcoal)
                }
                .padding(.horizontal, 4)

                if isEditing {
                    Button(role: .destructive) {
                        confirmDeleteProduct = true
                    } label: {
                        Text("Delete product")
                            .frame(maxWidth: .infinity)
                    }
                    .padding(.top, 8)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 20)
            .padding(.bottom, 32)
        }
        .scrollContentBackground(.hidden)
        .background(AdminCatalogEditorChrome.background)
        .navigationTitle(isEditing ? "Edit product" : "Add product")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task { await save() }
                }
                .fontWeight(.semibold)
                .disabled(isSaving || !canSave)
            }
        }
        .overlay {
            if isLoading {
                ProgressView()
                    .scaleEffect(1.2)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.black.opacity(0.12))
            }
        }
        .task {
            if let productId {
                await load(productId: productId)
            } else if variantRows.isEmpty {
                variantRows = [AdminVariantRow()]
            }
        }
        .alert("Something went wrong", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
                .textSelection(.enabled)
        }
        .alert("Delete this product?", isPresented: $confirmDeleteProduct) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                Task { await deleteProduct() }
            }
        } message: {
            Text("This cannot be undone. Products on past orders cannot be deleted.")
        }
    }

    // MARK: - Media (horizontal strip + add tile)

    @ViewBuilder
    private var mediaBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    PhotosPicker(
                        selection: $photoPickerItems,
                        maxSelectionCount: 12,
                        matching: .images,
                        photoLibrary: .shared()
                    ) {
                        addMediaTile
                    }
                    .disabled(isUploadingImages)
                    .onChange(of: photoPickerItems) { _, newItems in
                        guard !newItems.isEmpty else { return }
                        Task { await uploadPickedPhotos(newItems) }
                    }

                    ForEach(imageEntries) { entry in
                        ZStack(alignment: .topTrailing) {
                            let url: URL? = entry.previewURL ?? Config.cloudinaryDeliveryURL(publicId: entry.publicId)
                            AsyncImage(url: url) { phase in
                                switch phase {
                                case .empty:
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .fill(AdminCatalogEditorChrome.fieldFill)
                                        .overlay { ProgressView() }
                                case let .success(img):
                                    img
                                        .resizable()
                                        .scaledToFill()
                                case .failure:
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .fill(AdminCatalogEditorChrome.fieldFill)
                                        .overlay {
                                            Image(systemName: "photo")
                                                .foregroundStyle(HBColors.mutedGray)
                                        }
                                @unknown default:
                                    EmptyView()
                                }
                            }
                            .frame(width: 100, height: 100)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .strokeBorder(Color.black.opacity(0.06), lineWidth: 1)
                            )

                            Button {
                                imageEntries.removeAll { $0.id == entry.id }
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .symbolRenderingMode(.palette)
                                    .foregroundStyle(.white, Color.black.opacity(0.5))
                                    .font(.title3)
                            }
                            .offset(x: 6, y: -6)
                        }
                    }
                }
            }
            Text("Accepts images from your library. Recommended: square or 4:5, good lighting.")
                .font(HBFont.caption())
                .foregroundStyle(HBColors.mutedGray)
        }
    }

    private var addMediaTile: some View {
        VStack(spacing: 8) {
            Image(systemName: "plus")
                .font(.title2.weight(.medium))
                .foregroundStyle(HBColors.mutedGray)
            Text("Add")
                .font(HBFont.caption().weight(.semibold))
                .foregroundStyle(HBColors.mutedGray)
        }
        .frame(width: 100, height: 100)
        .background(AdminCatalogEditorChrome.fieldFill)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [6, 4]))
                .foregroundStyle(Color.black.opacity(0.15))
        )
        .accessibilityLabel("Add product images")
    }

    // MARK: - Variant row (labeled columns)

    private func variantEditorRow(_ row: Binding<AdminVariantRow>) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Variant")
                    .font(HBFont.caption().weight(.semibold))
                    .foregroundStyle(HBColors.mutedGray)
                    .textCase(.uppercase)
                Spacer()
                if variantRows.count > 1 {
                    Button {
                        removeVariant(id: row.wrappedValue.id)
                    } label: {
                        Image(systemName: "trash")
                            .font(.body)
                            .foregroundStyle(.red.opacity(0.85))
                    }
                    .accessibilityLabel("Remove variant")
                }
            }
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Size")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                    TextField("S, M, 8", text: row.size)
                        .font(.body)
                        .padding(10)
                        .background(AdminCatalogEditorChrome.fieldFill)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                .frame(maxWidth: .infinity)

                VStack(alignment: .leading, spacing: 4) {
                    Text("SKU")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                    TextField("—", text: row.sku)
                        .font(.body.monospaced())
                        .textInputAutocapitalization(.never)
                        .padding(10)
                        .background(AdminCatalogEditorChrome.fieldFill)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                .frame(maxWidth: .infinity)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Quantity")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
                TextField("0", text: row.stockText)
                    .keyboardType(.numberPad)
                    .font(.body.monospacedDigit())
                    .padding(10)
                    .background(AdminCatalogEditorChrome.fieldFill)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
        }
        .padding(12)
        .background(AdminCatalogEditorChrome.nestedFill)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color.black.opacity(0.05), lineWidth: 1)
        )
    }

    private func removeVariant(id: UUID) {
        guard let index = variantRows.firstIndex(where: { $0.id == id }) else { return }
        if let sid = variantRows[index].serverId {
            removedVariantIds.append(sid)
        }
        variantRows.remove(at: index)
    }

    // MARK: - Admin form section chrome

    private func adminFormSection<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title.uppercased())
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(HBColors.mutedGray)
                .tracking(0.6)
            content()
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AdminCatalogEditorChrome.cardFill)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(Color.black.opacity(0.06), lineWidth: 1)
                )
        }
    }

    private func labeledField<Content: View>(_ title: String, subtitle: String, @ViewBuilder field: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(HBColors.charcoal)
            field()
                .padding(12)
                .background(AdminCatalogEditorChrome.fieldFill)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(Color.black.opacity(0.06), lineWidth: 1)
                )
            Text(subtitle)
                .font(HBFont.caption())
                .foregroundStyle(HBColors.mutedGray)
        }
    }

    // MARK: - Pricing / profit (price + compare-at)

    private var parsedSellingCents: Int? {
        AdminMoney.cents(fromDollarString: sellingPriceDollars)
    }

    private var parsedCompareAtCents: Int? {
        let t = compareAtPriceDollars.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { return nil }
        return AdminMoney.cents(fromDollarString: t)
    }

    private var parsedCostCents: Int? {
        let t = costDollars.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { return nil }
        return AdminMoney.cents(fromDollarString: t)
    }

    /// Charge per unit (what the customer pays).
    private var minChargeCents: Int? {
        parsedSellingCents
    }

    private var profitSummaryLine: (text: String, isLoss: Bool)? {
        guard let cost = parsedCostCents else { return nil }
        guard let minCh = minChargeCents else {
            return ("Enter a valid price to see profit.", false)
        }
        let fee = AdminProfitGuard.estimatedCardFeeCents(chargeCents: minCh)
        let net = minCh - fee
        let profit = net - cost
        let isLoss = profit < 0
        let pct: String = {
            guard minCh > 0 else { return "—" }
            return String(format: "%.0f%%", Double(profit) / Double(minCh) * 100)
        }()
        let money: (Int) -> String = { c in
            NumberFormatter.localizedString(from: NSNumber(value: Double(c) / 100), number: .currency)
        }
        if isLoss {
            return (
                "After ~\(money(fee)) est. card fees, net ~\(money(net)) vs cost \(money(cost)) — short \(money(-profit)). Raise price or lower cost.",
                true
            )
        }
        return (
            "Charge \(money(minCh)) · ~Fees \(money(fee)) · Net ~\(money(net)) · Cost \(money(cost)) · Est. profit \(money(profit)) (\(pct)%)",
            false
        )
    }

    private var profitAllowsSave: Bool {
        guard let cost = parsedCostCents else { return true }
        guard let minCh = minChargeCents else { return false }
        let net = minCh - AdminProfitGuard.estimatedCardFeeCents(chargeCents: minCh)
        return net >= cost
    }

    private var canSave: Bool {
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !n.isEmpty else { return false }
        guard let sell = parsedSellingCents, sell >= 0 else { return false }
        if let compare = parsedCompareAtCents {
            guard compare > sell else { return false }
        }
        let validRows = variantRows.filter { !$0.size.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        guard !validRows.isEmpty else { return false }
        for row in validRows {
            guard let s = Int(row.stockText.trimmingCharacters(in: .whitespacesAndNewlines)), s >= 0 else { return false }
        }
        guard profitAllowsSave else { return false }
        return true
    }

    private func load(productId: String) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let r: ProductSingleResponse = try await api.request("/products/\(productId)", method: "GET")
            let p = r.product
            name = p.name
            slug = p.slug
            description = p.description ?? ""
            category = p.category
            if let sale = p.salePriceCents {
                sellingPriceDollars = AdminMoney.dollarsString(cents: sale)
                compareAtPriceDollars = AdminMoney.dollarsString(cents: p.priceCents)
            } else {
                sellingPriceDollars = AdminMoney.dollarsString(cents: p.priceCents)
                compareAtPriceDollars = ""
            }
            if let c = p.costCents {
                costDollars = AdminMoney.dollarsString(cents: c)
            } else {
                costDollars = ""
            }
            isFeatured = p.isFeatured
            shopLookGroup = p.shopLookGroup ?? ""
            let ids = p.images.compactMap { Self.cloudinaryPublicId(fromImageURL: $0) }
            imageEntries = ids.map { AdminProductImageEntry(publicId: $0) }
            manualPublicIdsText = ids.joined(separator: ", ")
            variantRows = p.variants.map {
                AdminVariantRow(serverId: $0.id, size: $0.size, sku: $0.sku ?? "", stockText: String($0.stock))
            }
            removedVariantIds = []
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private static func cloudinaryPublicId(fromImageURL urlString: String) -> String? {
        let t = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return nil }
        guard let range = t.range(of: "/upload/") else { return t }
        var rest = String(t[range.upperBound...])
        if rest.hasPrefix("v"), let slash = rest.firstIndex(of: "/") {
            let ver = String(rest[..<slash])
            if ver.dropFirst().allSatisfy(\.isNumber) {
                rest = String(rest[rest.index(after: slash)...])
            }
        }
        var parts = rest.split(separator: "/").map(String.init)
        while let first = parts.first, first.contains(",") {
            parts.removeFirst()
        }
        rest = parts.joined(separator: "/")
        if let dot = rest.lastIndex(of: "."), rest[dot...].count <= 6 {
            rest = String(rest[..<dot])
        }
        let out = rest.trimmingCharacters(in: .whitespacesAndNewlines)
        return out.isEmpty ? nil : out
    }

    private func parsedCloudinaryIds() -> [String] {
        imageEntries.map(\.publicId)
    }

    private func applyManualPublicIds() {
        let ids = manualPublicIdsText
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        imageEntries = ids.map { AdminProductImageEntry(publicId: $0) }
    }

    private func uploadPickedPhotos(_ items: [PhotosPickerItem]) async {
        isUploadingImages = true
        defer {
            isUploadingImages = false
            photoPickerItems = []
        }
        for item in items {
            do {
                guard let data = try await item.loadTransferable(type: Data.self) else { continue }
                guard let uiImage = UIImage(data: data) else { continue }
                guard let jpeg = Self.jpegDataForUpload(from: uiImage) else { continue }
                let b64 = jpeg.base64EncodedString()
                let res: AdminUploadImageResponse = try await api.request(
                    "/admin/upload",
                    method: "POST",
                    jsonBody: ["imageBase64": b64]
                )
                imageEntries.append(
                    AdminProductImageEntry(publicId: res.publicId, previewURL: URL(string: res.url))
                )
            } catch {
                errorMessage = error.localizedDescription
                return
            }
        }
    }

    private static func jpegDataForUpload(from image: UIImage) -> Data? {
        var maxDimension: CGFloat = 2048
        var quality: CGFloat = 0.82
        for _ in 0 ..< 10 {
            guard let data = jpegDataScaled(from: image, maxDimension: maxDimension, quality: quality) else { return nil }
            if data.count <= 2_200_000 { return data }
            if quality > 0.42 {
                quality -= 0.08
            } else {
                quality = 0.78
                maxDimension = max(720, maxDimension * 0.72)
            }
        }
        return jpegDataScaled(from: image, maxDimension: 720, quality: 0.5)
    }

    private static func jpegDataScaled(from image: UIImage, maxDimension: CGFloat, quality: CGFloat) -> Data? {
        let w = image.size.width
        let h = image.size.height
        let maxSide = max(w, h)
        let scale = maxSide > maxDimension ? maxDimension / maxSide : 1
        let newSize = CGSize(width: (w * scale).rounded(.down), height: (h * scale).rounded(.down))
        guard newSize.width >= 1, newSize.height >= 1 else { return nil }
        let renderer = UIGraphicsImageRenderer(size: newSize)
        let scaled = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
        return scaled.jpegData(compressionQuality: quality)
    }

    /// Maps UI to API: no compare-at → only `priceCents`; with compare-at → `priceCents` = compare, `salePriceCents` = selling.
    private func resolvedPricePayload() -> (priceCents: Int, saleCents: Int?)? {
        guard let sell = parsedSellingCents else { return nil }
        if let compare = parsedCompareAtCents {
            guard compare > sell else { return nil }
            return (priceCents: compare, saleCents: sell)
        }
        return (priceCents: sell, saleCents: nil)
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        guard let resolved = resolvedPricePayload() else {
            if parsedCompareAtCents != nil, let sell = parsedSellingCents, let c = parsedCompareAtCents, c <= sell {
                errorMessage = "Compare-at price must be higher than Price."
            } else {
                errorMessage = "Enter a valid price."
            }
            return
        }
        let priceCents = resolved.priceCents
        let saleCents = resolved.saleCents

        let rows = variantRows.filter { !$0.size.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        var variantPayload: [[String: Any]] = []
        for row in rows {
            guard let stock = Int(row.stockText.trimmingCharacters(in: .whitespacesAndNewlines)), stock >= 0 else {
                errorMessage = "Each variant needs a whole-number quantity (0 or more)."
                return
            }
            var v: [String: Any] = [
                "size": row.size.trimmingCharacters(in: .whitespacesAndNewlines),
                "stock": stock,
            ]
            let skuT = row.sku.trimmingCharacters(in: .whitespacesAndNewlines)
            if !skuT.isEmpty { v["sku"] = skuT }
            if let sid = row.serverId { v["id"] = sid }
            variantPayload.append(v)
        }

        let slugT = slug.trimmingCharacters(in: .whitespacesAndNewlines)
        let shopT = shopLookGroup.trimmingCharacters(in: .whitespacesAndNewlines)

        do {
            if let productId {
                var body: [String: Any] = [
                    "name": name.trimmingCharacters(in: .whitespacesAndNewlines),
                    "description": description.trimmingCharacters(in: .whitespacesAndNewlines),
                    "category": category.trimmingCharacters(in: .whitespacesAndNewlines),
                    "priceCents": priceCents,
                    "isFeatured": isFeatured,
                    "variants": variantPayload,
                    "cloudinaryIds": parsedCloudinaryIds(),
                ]
                if !slugT.isEmpty { body["slug"] = slugT }
                if saleCents != nil {
                    body["salePriceCents"] = saleCents as Any
                } else {
                    body["salePriceCents"] = NSNull()
                }
                if shopT.isEmpty {
                    body["shopLookGroup"] = NSNull()
                } else {
                    body["shopLookGroup"] = shopT
                }
                if !removedVariantIds.isEmpty {
                    body["removedVariantIds"] = removedVariantIds
                }
                if let cc = parsedCostCents {
                    body["costCents"] = cc
                } else {
                    body["costCents"] = NSNull()
                }
                let _: ProductSingleResponse = try await api.request("/products/\(productId)", method: "PATCH", jsonBody: body)
            } else {
                var body: [String: Any] = [
                    "name": name.trimmingCharacters(in: .whitespacesAndNewlines),
                    "category": category.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                        ? "General"
                        : category.trimmingCharacters(in: .whitespacesAndNewlines),
                    "priceCents": priceCents,
                    "isFeatured": isFeatured,
                    "variants": variantPayload,
                    "cloudinaryIds": parsedCloudinaryIds(),
                ]
                if !slugT.isEmpty { body["slug"] = slugT }
                let descT = description.trimmingCharacters(in: .whitespacesAndNewlines)
                if !descT.isEmpty { body["description"] = descT }
                if let s = saleCents { body["salePriceCents"] = s }
                if !shopT.isEmpty { body["shopLookGroup"] = shopT }
                if let cc = parsedCostCents {
                    body["costCents"] = cc
                } else {
                    body["costCents"] = NSNull()
                }
                let _: ProductSingleResponse = try await api.request("/products", method: "POST", jsonBody: body)
            }
            HBFeedback.success()
            onCatalogChanged?()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func deleteProduct() async {
        guard let productId else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            try await api.requestVoid("/products/\(productId)", method: "DELETE")
            HBFeedback.success()
            onCatalogChanged?()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Chrome

private enum AdminCatalogEditorChrome {
    static var background: Color { HBColors.cream.opacity(0.45) }
    static var cardFill: Color { HBColors.surface }
    static var fieldFill: Color { Color(uiColor: .secondarySystemGroupedBackground) }
    static var nestedFill: Color { Color(uiColor: .tertiarySystemGroupedBackground) }
}

private struct AdminProductImageEntry: Identifiable {
    let id = UUID()
    var publicId: String
    var previewURL: URL?

    init(publicId: String, previewURL: URL? = nil) {
        self.publicId = publicId
        self.previewURL = previewURL
    }
}

private struct AdminVariantRow: Identifiable {
    let id = UUID()
    var serverId: String?
    var size: String
    var sku: String
    var stockText: String

    init(serverId: String? = nil, size: String = "", sku: String = "", stockText: String = "0") {
        self.serverId = serverId
        self.size = size
        self.sku = sku
        self.stockText = stockText
    }
}

private enum AdminProfitGuard {
    static let cardFeePercent: Double = 0.029
    static let cardFixedCents: Int = 30

    static func estimatedCardFeeCents(chargeCents: Int) -> Int {
        guard chargeCents > 0 else { return 0 }
        return Int(ceil(Double(chargeCents) * cardFeePercent)) + cardFixedCents
    }
}

private enum AdminMoney {
    static func cents(fromDollarString s: String) -> Int? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: "")
        guard !t.isEmpty, let v = Double(t), v >= 0 else { return nil }
        return Int((v * 100.0).rounded())
    }

    static func dollarsString(cents: Int) -> String {
        String(format: "%.2f", Double(cents) / 100.0)
    }
}

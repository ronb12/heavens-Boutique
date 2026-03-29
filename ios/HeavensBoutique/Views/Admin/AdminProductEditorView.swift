import PhotosUI
import SwiftUI
import UIKit

/// Create or edit catalog + inventory (sizes, SKU, stock). Uses admin `POST/PATCH/DELETE /products`.
struct AdminProductEditorView: View {
    /// `nil` = new product
    let productId: String?
    /// Called after a successful save or delete so lists can refresh.
    var onCatalogChanged: (() -> Void)?

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var api: APIClient

    @State private var name = ""
    @State private var slug = ""
    @State private var description = ""
    @State private var category = ""
    @State private var priceDollars = ""
    @State private var salePriceDollars = ""
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

    private var isEditing: Bool { productId != nil }

    var body: some View {
        Form {
            Section {
                TextField("Name", text: $name)
                TextField("Slug (optional, auto from name if empty)", text: $slug)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                TextField("Category", text: $category)
                TextField("Description", text: $description, axis: .vertical)
                    .lineLimit(3...8)
            } header: {
                Text("Product")
            }

            Section {
                TextField("Price (USD)", text: $priceDollars)
                    .keyboardType(.decimalPad)
                TextField("Sale price (optional)", text: $salePriceDollars)
                    .keyboardType(.decimalPad)
                Toggle("Featured on Home", isOn: $isFeatured)
                TextField("Shop the Look group (optional)", text: $shopLookGroup)
                    .textInputAutocapitalization(.never)
            } header: {
                Text("Pricing & visibility")
            } footer: {
                Text("Featured items appear in the Home carousel. Shop the Look groups power curated sets.")
            }

            Section {
                TextField("Your cost per unit (USD)", text: $costDollars)
                    .keyboardType(.decimalPad)
                if let line = profitSummaryLine {
                    Text(line.text)
                        .font(HBFont.caption())
                        .foregroundStyle(line.isLoss ? Color.red : HBColors.mutedGray)
                }
            } header: {
                Text("Profit guard")
            } footer: {
                Text(
                    "Enter your unit cost. Save is blocked when estimated net after card fees is below that cost. Fees default to ~2.9% + $0.30 on the lowest of list and sale (one charge per unit—same defaults as the server; override with PROFIT_GUARD_CARD_PERCENT / PROFIT_GUARD_CARD_FIXED_CENTS on Vercel). Tax and shipping are not included. Guest checkout isn’t modeled per SKU. Shoppers never see cost."
                )
            }

            Section {
                if isUploadingImages {
                    HStack {
                        ProgressView()
                        Text("Uploading photos…")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                    }
                }

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(imageEntries) { entry in
                            ZStack(alignment: .topTrailing) {
                                let url: URL? = entry.previewURL ?? Config.cloudinaryDeliveryURL(publicId: entry.publicId)
                                AsyncImage(url: url) { phase in
                                    switch phase {
                                    case .empty:
                                        RoundedRectangle(cornerRadius: 12)
                                            .fill(HBColors.surface)
                                            .overlay { ProgressView() }
                                    case let .success(img):
                                        img
                                            .resizable()
                                            .scaledToFill()
                                    case .failure:
                                        RoundedRectangle(cornerRadius: 12)
                                            .fill(HBColors.surface)
                                            .overlay {
                                                Image(systemName: "photo")
                                                    .foregroundStyle(HBColors.mutedGray)
                                            }
                                    @unknown default:
                                        EmptyView()
                                    }
                                }
                                .frame(width: 92, height: 92)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                                Button {
                                    imageEntries.removeAll { $0.id == entry.id }
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .symbolRenderingMode(.palette)
                                        .foregroundStyle(.white, Color.black.opacity(0.55))
                                        .font(.title3)
                                }
                                .offset(x: 6, y: -6)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }

                PhotosPicker(
                    selection: $photoPickerItems,
                    maxSelectionCount: 12,
                    matching: .images,
                    photoLibrary: .shared()
                ) {
                    Label("Add from photo library", systemImage: "photo.on.rectangle.angled")
                }
                .disabled(isUploadingImages)
                .onChange(of: photoPickerItems) { _, newItems in
                    guard !newItems.isEmpty else { return }
                    Task { await uploadPickedPhotos(newItems) }
                }

                DisclosureGroup("Paste public IDs (advanced)") {
                    TextField("folder/item, other-id", text: $manualPublicIdsText, axis: .vertical)
                        .lineLimit(2...5)
                    Button("Apply list (replaces gallery order)") {
                        applyManualPublicIds()
                    }
                    .font(HBFont.caption())
                }
            } header: {
                Text("Images")
            } footer: {
                Text(
                    "Add photos from your library. Production uses Vercel Blob: link a Blob store on your Vercel project so the API has BLOB_READ_WRITE_TOKEN (nothing secret in the app). Optional Cloudinary fallback only if Blob isn’t set. CLOUDINARY_CLOUD_NAME in the app is only for previewing pasted Cloudinary public IDs."
                )
            }

            Section {
                ForEach($variantRows) { $row in
                    VStack(alignment: .leading, spacing: 10) {
                        TextField("Size (e.g. S, M, 8)", text: $row.size)
                        TextField("SKU (optional)", text: $row.sku)
                            .textInputAutocapitalization(.never)
                        TextField("Stock", text: $row.stockText)
                            .keyboardType(.numberPad)
                    }
                    .padding(.vertical, 4)
                }
                .onDelete(perform: deleteVariantRows)

                Button {
                    variantRows.append(AdminVariantRow())
                } label: {
                    Label("Add size / inventory row", systemImage: "plus.circle.fill")
                }
            } header: {
                Text("Inventory")
            } footer: {
                Text("Each row is one sellable variant. Stock is what shoppers can buy right now.")
            }

            if isEditing {
                Section {
                    Button(role: .destructive) {
                        confirmDeleteProduct = true
                    } label: {
                        Text("Delete product")
                    }
                } footer: {
                    Text("Only allowed if this product was never on an order.")
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(HBColors.cream.opacity(0.35))
        .navigationTitle(isEditing ? "Edit product" : "New product")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task { await save() }
                }
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

    private var parsedCostCents: Int? {
        let t = costDollars.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { return nil }
        return AdminMoney.cents(fromDollarString: t)
    }

    /// Matches server: lowest of list and sale (if any).
    private var minChargeCents: Int? {
        guard let list = AdminMoney.cents(fromDollarString: priceDollars) else { return nil }
        let saleT = salePriceDollars.trimmingCharacters(in: .whitespacesAndNewlines)
        if saleT.isEmpty { return list }
        guard let sale = AdminMoney.cents(fromDollarString: saleT) else { return nil }
        return min(list, sale)
    }

    private var profitSummaryLine: (text: String, isLoss: Bool)? {
        guard let cost = parsedCostCents else { return nil }
        guard let minCh = minChargeCents else {
            return ("Enter valid list (and sale) prices to see profit.", false)
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
            "Price \(money(minCh)) · ~Fees \(money(fee)) · Net ~\(money(net)) · Cost \(money(cost)) · Est. profit \(money(profit)) (\(pct)% of price; tax/shipping N/A)",
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
        guard AdminMoney.cents(fromDollarString: priceDollars) != nil else { return false }
        let validRows = variantRows.filter { !$0.size.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        guard !validRows.isEmpty else { return false }
        for row in validRows {
            guard let s = Int(row.stockText.trimmingCharacters(in: .whitespacesAndNewlines)), s >= 0 else { return false }
        }
        guard profitAllowsSave else { return false }
        return true
    }

    private func deleteVariantRows(at offsets: IndexSet) {
        for i in offsets {
            guard variantRows.indices.contains(i) else { continue }
            if let sid = variantRows[i].serverId {
                removedVariantIds.append(sid)
            }
            variantRows.remove(at: i)
        }
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
            priceDollars = AdminMoney.dollarsString(cents: p.priceCents)
            if let s = p.salePriceCents {
                salePriceDollars = AdminMoney.dollarsString(cents: s)
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

    /// Strip Cloudinary delivery URL to public id (`folder/item`), or return trimmed token if already an id.
    private static func cloudinaryPublicId(fromImageURL urlString: String) -> String? {
        let t = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return nil }
        guard let range = t.range(of: "/upload/") else { return t }
        var rest = String(t[range.upperBound...])
        // Drop version folder `v1234567/`
        if rest.hasPrefix("v"), let slash = rest.firstIndex(of: "/") {
            let ver = String(rest[..<slash])
            if ver.dropFirst().allSatisfy(\.isNumber) {
                rest = String(rest[rest.index(after: slash)...])
            }
        }
        // Drop transformation segments (contain commas, e.g. `f_auto,q_auto`)
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

    /// Keeps JPEG under ~2.2 MB so base64 JSON stays under Vercel’s ~4.5 MB request limit (and server read cap).
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

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        guard let priceCents = AdminMoney.cents(fromDollarString: priceDollars) else {
            errorMessage = "Enter a valid price."
            return
        }
        let saleCents: Int? = {
            let t = salePriceDollars.trimmingCharacters(in: .whitespacesAndNewlines)
            if t.isEmpty { return nil }
            return AdminMoney.cents(fromDollarString: t)
        }()

        let rows = variantRows.filter { !$0.size.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        var variantPayload: [[String: Any]] = []
        for row in rows {
            guard let stock = Int(row.stockText.trimmingCharacters(in: .whitespacesAndNewlines)), stock >= 0 else {
                errorMessage = "Each row needs a whole-number stock (0 or more)."
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

/// Matches `backend/lib/productProfit.js` defaults (env overrides apply on server only).
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

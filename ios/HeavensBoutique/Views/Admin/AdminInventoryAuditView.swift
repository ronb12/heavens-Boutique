import SwiftUI

struct AdminInventoryAuditView: View {
    @EnvironmentObject private var api: APIClient
    @State private var rows: [AdminInventoryAuditRowDTO] = []
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        Group {
            if isLoading && rows.isEmpty {
                ProgressView().tint(HBColors.gold).frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error, rows.isEmpty {
                HBEmptyState(systemImage: "list.bullet.clipboard", title: "Couldn't load inventory log", message: error, retryTitle: "Try again") {
                    Task { await load() }
                }
            } else if rows.isEmpty {
                HBEmptyState(
                    systemImage: "list.bullet.clipboard",
                    title: "No inventory activity",
                    message: "Stock changes will appear here.",
                    retryTitle: nil,
                    retry: nil
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(rows) { r in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("\(r.productName) · \(r.size)")
                                .font(HBFont.caption().weight(.semibold))
                                .foregroundStyle(HBColors.charcoal)
                            Spacer()
                            Text(deltaText(r.delta))
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(r.delta >= 0 ? .green.opacity(0.8) : .red.opacity(0.85))
                        }
                        Text(r.reason.replacingOccurrences(of: "_", with: " ").capitalized)
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                        if let ts = r.createdAt, let pretty = prettyDate(ts) {
                            Text(pretty)
                                .font(.caption2)
                                .foregroundStyle(HBColors.mutedGray)
                        }
                    }
                    .padding(.vertical, 4)
                    .listRowBackground(HBColors.surface)
                }
                .scrollContentBackground(.hidden)
                .background(HBColors.cream.ignoresSafeArea())
            }
        }
        .navigationTitle("Inventory log")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        if rows.isEmpty { isLoading = true }
        error = nil
        defer { isLoading = false }
        do {
            let r: AdminInventoryAuditResponse = try await api.request("/admin/inventory-audit", method: "GET")
            rows = r.rows
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func deltaText(_ d: Int) -> String {
        d >= 0 ? "+\(d)" : "\(d)"
    }

    private func prettyDate(_ iso: String) -> String? {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = isoFormatter.date(from: iso)
        if date == nil {
            isoFormatter.formatOptions = [.withInternetDateTime]
            date = isoFormatter.date(from: iso)
        }
        guard let date else { return nil }
        let out = DateFormatter()
        out.dateStyle = .medium
        out.timeStyle = .short
        return out.string(from: date)
    }
}

// MARK: - Add / receive inventory (same flow as web “Add or update inventory”)

/// `GET/PATCH /admin/inventory` — pick a variant, set on hand or add/remove units.
struct AdminInventoryAddFormView: View {
    @EnvironmentObject private var api: APIClient
    let items: [AdminInventoryItemDTO]
    var onSuccess: () -> Void

    @State private var addFilter = ""
    @State private var selectedProductId = ""
    @State private var selectedVariantId = ""
    @State private var setMode: Bool = true
    @State private var onHandText = ""
    @State private var addRemoveText = "1"
    @State private var saving = false
    @State private var formError: String?

    private var selectedRow: AdminInventoryItemDTO? {
        items.first { $0.variantId == selectedVariantId }
    }

    private var grouped: [(productId: String, name: String, variants: [AdminInventoryItemDTO])] {
        let f = addFilter.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        var map: [String: (name: String, vars: [AdminInventoryItemDTO])] = [:]
        for it in items {
            if !f.isEmpty, !it.productName.lowercased().contains(f) { continue }
            if map[it.productId] == nil {
                map[it.productId] = (it.productName, [])
            }
            map[it.productId]?.vars.append(it)
        }
        return map
            .map { (productId: $0.key, name: $0.value.name, variants: $0.value.vars) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            .map { g in
                (g.productId, g.name, g.variants.sorted { a, b in
                    a.size.localizedStandardCompare(b.size) == .orderedAscending
                })
            }
    }

    private var variantsForProduct: [AdminInventoryItemDTO] {
        guard !selectedProductId.isEmpty else { return [] }
        return grouped.first { $0.productId == selectedProductId }?.variants ?? []
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("RECEIVE & ADJUST")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(HBColors.mutedGray)
                .tracking(0.6)

            Text("Add or update inventory")
                .font(HBFont.headline())
                .foregroundStyle(HBColors.charcoal)
            Text("Choose a variant, then set on-hand or add (or remove) units.")
                .font(HBFont.caption())
                .foregroundStyle(HBColors.mutedGray)
                .fixedSize(horizontal: false, vertical: true)

            TextField("Filter products by name", text: $addFilter)
                .textFieldStyle(.roundedBorder)
                .textInputAutocapitalization(.words)

            Picker("Update mode", selection: $setMode) {
                Text("Set on hand").tag(true)
                Text("Add or remove").tag(false)
            }
            .pickerStyle(.segmented)

            if let row = selectedRow, !setMode {
                Text("Current: \(row.stock) on hand. Positive adds; negative removes (total can’t go below 0).")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            }

            Picker("Product", selection: $selectedProductId) {
                Text("— Choose a product —").tag("")
                ForEach(grouped, id: \.productId) { g in
                    Text(g.name).tag(g.productId)
                }
            }
            .accessibilityLabel("Product")
            Picker("Variant", selection: $selectedVariantId) {
                Text("— Size / SKU —").tag("")
                ForEach(variantsForProduct) { v in
                    let label = variantLabel(v)
                    Text("\(label) — on hand: \(v.stock)").tag(v.variantId)
                }
            }
            .disabled(selectedProductId.isEmpty)
            .accessibilityLabel("Size or SKU")

            if setMode {
                HStack(alignment: .firstTextBaseline) {
                    Text("On hand")
                        .font(HBFont.caption().weight(.semibold))
                    TextField("0", text: $onHandText)
                        .keyboardType(.numberPad)
                        .font(.body.monospacedDigit())
                        .textFieldStyle(.roundedBorder)
                        .frame(maxWidth: 120)
                }
            } else {
                HStack(alignment: .firstTextBaseline) {
                    Text("Add / remove")
                        .font(HBFont.caption().weight(.semibold))
                    TextField("0", text: $addRemoveText)
                        .keyboardType(.numbersAndPunctuation)
                        .font(.body.monospacedDigit())
                        .textFieldStyle(.roundedBorder)
                        .frame(maxWidth: 120)
                }
            }

            if let formError {
                Text(formError)
                    .font(HBFont.caption().weight(.semibold))
                    .foregroundStyle(.red.opacity(0.9))
            }

            HStack(spacing: 12) {
                Button {
                    Task { await save() }
                } label: {
                    if saving {
                        ProgressView()
                            .scaleEffect(0.9)
                    } else {
                        Text("Save inventory")
                            .font(.subheadline.weight(.semibold))
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(HBColors.gold)
                .disabled(saving || selectedVariantId.isEmpty)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(HBColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .onChange(of: selectedProductId) { _, new in
            formError = nil
            selectedVariantId = ""
            if new.isEmpty { return }
            if let g = grouped.first(where: { $0.productId == new }), g.variants.count == 1 {
                selectedVariantId = g.variants[0].variantId
            }
        }
        .onChange(of: selectedVariantId) { _, new in
            formError = nil
            syncFieldsFromRow(variantId: new)
        }
        .onChange(of: setMode) { _, isSet in
            formError = nil
            if let row = selectedRow {
                onHandText = String(row.stock)
                addRemoveText = isSet ? "1" : "1"
            }
        }
        .onChange(of: items.map(\.variantId).joined(separator: ",")) { _, _ in
            if !selectedVariantId.isEmpty, items.first(where: { $0.variantId == selectedVariantId }) == nil {
                selectedVariantId = ""
                selectedProductId = ""
            }
        }
    }

    private func syncFieldsFromRow(variantId: String) {
        guard let row = items.first(where: { $0.variantId == variantId }) else {
            onHandText = ""
            return
        }
        onHandText = String(row.stock)
    }

    private func variantLabel(_ v: AdminInventoryItemDTO) -> String {
        let s = v.size.trimmingCharacters(in: .whitespacesAndNewlines)
        let k = (v.sku ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if s.isEmpty, k.isEmpty { return "Default" }
        if k.isEmpty { return s }
        if s.isEmpty { return k }
        return "\(s) · \(k)"
    }

    private func save() async {
        formError = nil
        guard let it = items.first(where: { $0.variantId == selectedVariantId }) else {
            formError = "Select a product variant first."
            return
        }
        let n: Int
        if setMode {
            let t = onHandText.trimmingCharacters(in: .whitespacesAndNewlines)
            guard let v = Int(t), v >= 0 else {
                formError = "On-hand must be a whole number ≥ 0."
                return
            }
            n = v
        } else {
            let t = addRemoveText.trimmingCharacters(in: .whitespacesAndNewlines)
            guard let delta = Int(t), delta != 0 else {
                formError = "Enter a non-zero whole number to add or remove."
                return
            }
            n = it.stock + delta
            if n < 0 {
                formError = "On-hand can’t be negative. Use a smaller removal or set quantity directly."
                return
            }
        }
        saving = true
        defer { saving = false }
        do {
            let body: [String: Any] = [
                "updates": [
                    [
                        "productId": it.productId,
                        "variantId": it.variantId,
                        "stock": n
                    ]
                ]
            ]
            let _: AdminInventoryPatchResponse = try await api.request("/admin/inventory", method: "PATCH", jsonBody: body)
            if setMode {
                onHandText = String(n)
            } else {
                addRemoveText = "1"
            }
            HBFeedback.success()
            onSuccess()
        } catch {
            formError = error.localizedDescription
            HBFeedback.warning()
        }
    }
}

private struct AdminInventoryPatchResponse: Decodable {
    let ok: Bool?
}

// MARK: - Inventory quantities (quick counts)

/// Adjust on-hand stock per variant without opening the full product editor.
struct AdminInventoryQuantitiesView: View {
    @EnvironmentObject private var api: APIClient

    @State private var lines: [InventoryQuantityLine] = []
    /// Drives the “add inventory” form (`GET /admin/inventory`); list rows are derived from the same response.
    @State private var inventoryItems: [AdminInventoryItemDTO] = []
    @State private var searchText = ""
    @State private var isLoading = false
    @State private var savingVariantId: String?
    @State private var errorMessage: String?

    private var filtered: [InventoryQuantityLine] {
        let q = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return lines }
        return lines.filter { row in
            row.productName.lowercased().contains(q)
                || row.size.lowercased().contains(q)
                || (row.sku?.lowercased().contains(q) ?? false)
                || row.productId.lowercased().contains(q)
                || row.variantId.lowercased().contains(q)
        }
    }

    var body: some View {
        Group {
            if isLoading && lines.isEmpty {
                ProgressView("Loading inventory…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    Section {
                        if !inventoryItems.isEmpty {
                            AdminInventoryAddFormView(items: inventoryItems) {
                                Task { await loadInventory() }
                            }
                            .environmentObject(api)
                            .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 12, trailing: 0))
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                        } else {
                            Text("Add products with variants in Products — they will show up here.")
                                .font(HBFont.caption())
                                .foregroundStyle(HBColors.mutedGray)
                                .listRowBackground(Color.clear)
                        }
                    } header: {
                        Text("Receive & adjust")
                            .font(HBFont.caption().weight(.semibold))
                            .foregroundStyle(HBColors.mutedGray)
                    }

                    Section {
                        Text("In the list below, edit a row, then Save. For quick receiving, use the form above. Photos and pricing stay under the Products tab.")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                            .listRowBackground(Color.clear)
                    } header: {
                        Text("All inventory")
                            .font(HBFont.caption().weight(.semibold))
                            .foregroundStyle(HBColors.mutedGray)
                    }

                    ForEach(filtered) { row in
                        inventoryRow(row)
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
        }
        .searchable(text: $searchText, prompt: "Search product, SKU, size")
        .navigationTitle("Inventory quantities")
        .navigationBarTitleDisplayMode(.inline)
        .background(HBColors.cream.opacity(0.2))
        .task { await loadInventory() }
        .refreshable { await loadInventory() }
        .alert("Couldn’t save", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    @ViewBuilder
    private func inventoryRow(_ row: InventoryQuantityLine) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(row.productName)
                .font(HBFont.headline())
                .foregroundStyle(HBColors.charcoal)
            HStack(spacing: 8) {
                Text("Size \(row.size)")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
                if let sku = row.sku, !sku.isEmpty {
                    Text("· SKU \(sku)")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                }
            }

            HStack(spacing: 12) {
                TextField("Qty", text: binding(for: row.variantId))
                    .keyboardType(.numberPad)
                    .font(.body.monospacedDigit())
                    .multilineTextAlignment(.trailing)
                    .padding(10)
                    .frame(width: 88)
                    .background(HBColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

                Button {
                    Task { await saveVariant(row) }
                } label: {
                    if savingVariantId == row.variantId {
                        ProgressView()
                            .scaleEffect(0.9)
                    } else {
                        Text("Save")
                            .font(.subheadline.weight(.semibold))
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(HBColors.gold)
                .disabled(savingVariantId != nil)

                HStack(spacing: 4) {
                    Button {
                        bump(row.variantId, delta: -1)
                    } label: {
                        Image(systemName: "minus.circle.fill")
                            .font(.title3)
                            .foregroundStyle(HBColors.mutedGray)
                    }
                    .buttonStyle(.plain)
                    Button {
                        bump(row.variantId, delta: 1)
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                            .foregroundStyle(HBColors.gold)
                    }
                    .buttonStyle(.plain)
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Adjust quantity")
            }
        }
        .padding(.vertical, 6)
        .listRowBackground(HBColors.surface)
    }

    private func binding(for variantId: String) -> Binding<String> {
        Binding(
            get: {
                lines.first(where: { $0.variantId == variantId })?.quantityText ?? "0"
            },
            set: { newVal in
                if let i = lines.firstIndex(where: { $0.variantId == variantId }) {
                    lines[i].quantityText = String(newVal.filter { $0.isNumber })
                }
            }
        )
    }

    private func bump(_ variantId: String, delta: Int) {
        guard let i = lines.firstIndex(where: { $0.variantId == variantId }) else { return }
        let cur = Int(lines[i].quantityText) ?? 0
        let next = max(0, cur + delta)
        lines[i].quantityText = String(next)
    }

    private func loadInventory() async {
        if lines.isEmpty { isLoading = true }
        defer { isLoading = false }
        errorMessage = nil
        do {
            let r: AdminInventoryListResponse = try await api.request("/admin/inventory", method: "GET")
            inventoryItems = r.items
            lines = r.items.map { it in
                InventoryQuantityLine(
                    variantId: it.variantId,
                    productId: it.productId,
                    productName: it.productName,
                    size: it.size,
                    sku: it.sku,
                    quantityText: String(it.stock)
                )
            }
        } catch {
            errorMessage = error.localizedDescription
            inventoryItems = []
            lines = []
        }
    }

    private func saveVariant(_ row: InventoryQuantityLine) async {
        guard let live = lines.first(where: { $0.variantId == row.variantId }) else { return }
        let trimmed = live.quantityText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let newStock = Int(trimmed), newStock >= 0 else {
            errorMessage = "Enter a whole number (0 or more)."
            return
        }
        savingVariantId = row.variantId
        defer { savingVariantId = nil }
        errorMessage = nil
        do {
            let body: [String: Any] = [
                "updates": [
                    [
                        "productId": live.productId,
                        "variantId": live.variantId,
                        "stock": newStock
                    ]
                ]
            ]
            let _: AdminInventoryPatchResponse = try await api.request("/admin/inventory", method: "PATCH", jsonBody: body)
            await loadInventory()
            HBFeedback.success()
        } catch {
            errorMessage = error.localizedDescription
            HBFeedback.warning()
        }
    }
}

private struct InventoryQuantityLine: Identifiable {
    let variantId: String
    let productId: String
    let productName: String
    let size: String
    let sku: String?
    var quantityText: String

    var id: String { variantId }
}

// MARK: - Admin split view: stock + log (same hub as web /admin/inventory)

/// Sidebar **Inventory** destination: on-hand counts and audit log in one place.
struct AdminInventoryHubView: View {
    private enum Subtab: String, CaseIterable {
        case stock = "Stock"
        case log = "Log"
    }

    @State private var subtab: Subtab = .stock

    var body: some View {
        VStack(spacing: 0) {
            Picker("Inventory section", selection: $subtab) {
                ForEach(Subtab.allCases, id: \.self) { t in
                    Text(t.rawValue).tag(t)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 4)
            .accessibilityLabel("Inventory section")

            Group {
                switch subtab {
                case .stock:
                    AdminInventoryQuantitiesView()
                case .log:
                    AdminInventoryAuditView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}


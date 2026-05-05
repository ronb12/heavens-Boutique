import SwiftUI

/// Owner view: all registered accounts with spend and order counts; tap through to full profile.
struct AdminCustomersView: View {
    @EnvironmentObject private var api: APIClient
    var refreshNonce: Int = 0

    @State private var customers: [AdminCustomerSummaryDTO] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var searchText = ""

    private var filtered: [AdminCustomerSummaryDTO] {
        let q = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return customers }
        return customers.filter { c in
            c.email.lowercased().contains(q)
                || (c.fullName?.lowercased().contains(q) ?? false)
                || (c.phone?.lowercased().contains(q) ?? false)
                || c.id.lowercased().contains(q)
        }
    }

    var body: some View {
        Group {
            if isLoading && customers.isEmpty {
                ProgressView("Loading customers…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Registered accounts only. Guest checkouts still appear under Orders.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                        .padding(.horizontal)
                    List {
                        ForEach(filtered) { c in
                            NavigationLink {
                                AdminCustomerDetailView(customerId: c.id)
                                    .environmentObject(api)
                            } label: {
                                AdminCustomerRowView(customer: c)
                            }
                        }
                    }
                    .overlay {
                        if !searchText.isEmpty && filtered.isEmpty && !customers.isEmpty {
                            ContentUnavailableView.search(text: searchText)
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
        }
        .searchable(text: $searchText, prompt: "Search email, name, phone, ID")
        .background(HBColors.cream.opacity(0.2))
        .task(id: refreshNonce) { await load() }
        .refreshable { await load() }
        .overlay {
            if let err = errorMessage, customers.isEmpty, !isLoading {
                ContentUnavailableView(
                    "Couldn’t load customers",
                    systemImage: "person.crop.circle.badge.xmark",
                    description: Text(err)
                )
            }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        errorMessage = nil
        do {
            let r: AdminCustomersListResponse = try await api.request("/admin/customers", method: "GET")
            customers = r.customers
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct AdminCustomerRowView: View {
    let customer: AdminCustomerSummaryDTO

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(customer.fullName?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
                    ? (customer.fullName ?? "")
                    : customer.email)
                    .font(HBFont.headline())
                    .foregroundStyle(HBColors.charcoal)
                if customer.role == "admin" {
                    Text("Admin")
                        .font(HBFont.caption())
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(HBColors.gold.opacity(0.25))
                        .clipShape(Capsule())
                }
            }
            Text(customer.email)
                .font(HBFont.caption())
                .foregroundStyle(HBColors.mutedGray)
            if let phone = customer.phone, !phone.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text(phone)
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            }
            HStack(spacing: 12) {
                Text("\(customer.orderCount) orders")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
                Text(Self.money(customer.spentCents) + " paid")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.gold)
                if customer.loyaltyPoints > 0 {
                    Text("\(customer.loyaltyPoints) pts")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.rosePink)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private static func money(_ cents: Int) -> String {
        NumberFormatter.localizedString(from: NSNumber(value: Double(cents) / 100), number: .currency)
    }
}

// MARK: - Detail

struct AdminCustomerDetailView: View {
    let customerId: String
    @EnvironmentObject private var api: APIClient

    @State private var detail: AdminCustomerDetailResponse?
    @State private var tagsEditor = ""
    @State private var isLoading = false
    @State private var isSavingTags = false
    @State private var errorMessage: String?
    @State private var copiedId = false

    var body: some View {
        Group {
            if let d = detail {
                detailContent(d)
            } else if isLoading {
                ProgressView("Loading…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ContentUnavailableView("No profile", systemImage: "person")
            }
        }
        .hbScreenBackground()
        .navigationTitle("Customer")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    UIPasteboard.general.string = customerId
                    copiedId = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { copiedId = false }
                    HBFeedback.light()
                } label: {
                    Image(systemName: copiedId ? "checkmark.circle" : "doc.on.doc")
                }
                .accessibilityLabel("Copy user ID")
            }
        }
        .task { await load() }
        .refreshable { await load() }
        .alert("Something went wrong", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    @ViewBuilder
    private func detailContent(_ d: AdminCustomerDetailResponse) -> some View {
        let u = d.user
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(u.fullName?.isEmpty == false ? (u.fullName ?? "") : u.email)
                        .font(HBFont.title())
                        .foregroundStyle(HBColors.charcoal)
                    Text(u.email)
                        .font(HBFont.body())
                        .foregroundStyle(HBColors.mutedGray)
                    if let phone = u.phone, !phone.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        let digits = phone.filter { $0.isNumber || $0 == "+" }
                        if let url = URL(string: "tel:\(digits)") {
                            Link(phone, destination: url)
                                .font(HBFont.body())
                        } else {
                            Text(phone).font(HBFont.body())
                        }
                    }
                    HStack(spacing: 12) {
                        Label(u.role.capitalized, systemImage: "person.text.rectangle")
                        if u.pushEnabled {
                            Label("Push on", systemImage: "bell.fill")
                                .foregroundStyle(HBColors.gold)
                        }
                    }
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)

                    Text("ID: \(u.id)")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                        .textSelection(.enabled)

                    if let created = u.createdAt {
                        Text("Joined \(Self.formatDate(created))")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .hbCardStyle()

                VStack(alignment: .leading, spacing: 10) {
                    Text("Loyalty: \(u.loyaltyPoints) points")
                        .font(HBFont.headline())
                    Text("Tags (comma-separated, save to sync)")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                    TextField("vip, wholesale, …", text: $tagsEditor, axis: .vertical)
                        .lineLimit(2...4)
                        .padding(10)
                        .background(HBColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    Button {
                        Task { await saveTags() }
                    } label: {
                        Text(isSavingTags ? "Saving…" : "Save tags")
                            .font(HBFont.headline())
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(HBColors.gold)
                            .foregroundStyle(HBColors.charcoal)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .disabled(isSavingTags)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .hbCardStyle()

                if !d.addresses.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Saved addresses")
                            .font(HBFont.headline())
                        ForEach(d.addresses) { a in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text(a.label?.isEmpty == false ? (a.label ?? "Address") : "Address")
                                        .font(HBFont.headline())
                                    if a.isDefault {
                                        Text("Default")
                                            .font(HBFont.caption())
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 2)
                                            .background(HBColors.softPink.opacity(0.5))
                                            .clipShape(Capsule())
                                    }
                                }
                                Text("\(a.line1)\(a.line2.map { ", \($0)" } ?? "")")
                                    .font(HBFont.caption())
                                Text("\(a.city), \(a.state ?? "") \(a.postal) · \(a.country)")
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.mutedGray)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding()
                            .background(HBColors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .hbCardStyle()
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Recent orders")
                        .font(HBFont.headline())
                    if d.recentOrders.isEmpty {
                        Text("No orders yet.")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                    } else {
                        ForEach(d.recentOrders) { o in
                            NavigationLink {
                                AdminOrderDetailView(orderId: o.id)
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(o.status.replacingOccurrences(of: "_", with: " ").capitalized)
                                            .font(HBFont.headline())
                                            .foregroundStyle(HBColors.charcoal)
                                        if let t = o.createdAt {
                                            Text(Self.formatDate(t))
                                                .font(HBFont.caption())
                                                .foregroundStyle(HBColors.mutedGray)
                                        }
                                    }
                                    Spacer()
                                    Text(Self.money(o.totalCents))
                                        .font(HBFont.body())
                                        .foregroundStyle(HBColors.gold)
                                }
                                .padding()
                                .hbCardStyle()
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .hbCardStyle()
            }
            .padding()
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        errorMessage = nil
        do {
            let r: AdminCustomerDetailResponse = try await api.request("/admin/customers/\(customerId)", method: "GET")
            detail = r
            tagsEditor = r.user.tags.joined(separator: ", ")
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func saveTags() async {
        let parts = tagsEditor
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        isSavingTags = true
        defer { isSavingTags = false }
        do {
            let body: [String: Any] = ["tags": parts]
            let r: AdminCustomerPatchResponse = try await api.request(
                "/admin/customers/\(customerId)",
                method: "PATCH",
                jsonBody: body
            )
            if let d = detail {
                detail = AdminCustomerDetailResponse(
                    user: r.user,
                    addresses: d.addresses,
                    recentOrders: d.recentOrders
                )
            }
            tagsEditor = r.user.tags.joined(separator: ", ")
            HBFeedback.success()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private static func money(_ cents: Int) -> String {
        NumberFormatter.localizedString(from: NSNumber(value: Double(cents) / 100), number: .currency)
    }

    private static let _isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f
    }()
    private static let _iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime]; return f
    }()
    private static let _mediumDateTime: DateFormatter = {
        let f = DateFormatter(); f.dateStyle = .medium; f.timeStyle = .short; return f
    }()

    private static func formatDate(_ iso: String) -> String {
        let d = _isoFractional.date(from: iso) ?? _iso.date(from: iso)
        guard let date = d else { return iso }
        return _mediumDateTime.string(from: date)
    }
}

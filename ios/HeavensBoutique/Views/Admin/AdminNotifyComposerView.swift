import SwiftUI

/// Admin marketing message composer: audience, content, appearance, live preview, send with feedback.
struct AdminNotifyComposerView: View {
    @EnvironmentObject private var api: APIClient

    /// Bump when customers change (e.g. new signup) so counts and picker refresh.
    var customersListRefreshNonce: Int = 0

    private enum Audience: String, CaseIterable, Identifiable {
        case single
        case marketingSubscribers

        var id: String { rawValue }

        var title: String {
            switch self {
            case .single: return "One customer"
            case .marketingSubscribers: return "Marketing subscribers"
            }
        }
    }

    @State private var audience: Audience = .single
    @State private var selectedCustomer: AdminCustomerSummaryDTO?
    @State private var showCustomerPicker = false

    @State private var customers: [AdminCustomerSummaryDTO] = []
    @State private var customersLoadError: String?

    @State private var notifyTitle = ""
    @State private var notifyBody = ""
    @State private var notifyBadge = ""
    @State private var notifyImageUrl = ""

    @State private var isSending = false
    @State private var errorMessage: String?
    @State private var successSummary: String?
    @State private var confirmMarketingBroadcast = false

    private var marketingSubscriberCount: Int {
        customers.filter { $0.role == "customer" && $0.tags.contains("marketing_emails") }.count
    }

    private var canSend: Bool {
        let title = notifyTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return false }
        switch audience {
        case .single:
            return selectedCustomer != nil
        case .marketingSubscribers:
            return marketingSubscriberCount > 0
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                adminFormSection(title: "Audience") {
                    VStack(alignment: .leading, spacing: 14) {
                        if let err = customersLoadError {
                            Text(err)
                                .font(HBFont.caption())
                                .foregroundStyle(.red)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Picker("Audience", selection: $audience) {
                            ForEach(Audience.allCases) { a in
                                Text(a.title).tag(a)
                            }
                        }
                        .pickerStyle(.segmented)

                        switch audience {
                        case .single:
                            labeledField("Customer", subtitle: "Choose who receives this in the Notifications tab (and push if they use the app).") {
                                Button {
                                    showCustomerPicker = true
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 4) {
                                            if let c = selectedCustomer {
                                                Text(displayName(c))
                                                    .font(.body.weight(.medium))
                                                    .foregroundStyle(HBColors.charcoal)
                                                Text(c.email)
                                                    .font(HBFont.caption())
                                                    .foregroundStyle(HBColors.mutedGray)
                                            } else {
                                                Text("Select customer")
                                                    .font(.body)
                                                    .foregroundStyle(HBColors.mutedGray)
                                            }
                                        }
                                        Spacer()
                                        Image(systemName: "chevron.right")
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(HBColors.mutedGray)
                                    }
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                            }
                        case .marketingSubscribers:
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Sends to every customer who opted into marketing emails (same as “Customer agreed to receive marketing emails” when you add them).")
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.mutedGray)
                                    .fixedSize(horizontal: false, vertical: true)
                                HStack(spacing: 8) {
                                    Image(systemName: "person.3.fill")
                                        .foregroundStyle(HBColors.gold)
                                    Text("\(marketingSubscriberCount) subscriber\(marketingSubscriberCount == 1 ? "" : "s")")
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(HBColors.charcoal)
                                }
                                if marketingSubscriberCount == 0 {
                                    Text("No subscribers yet — add a customer with marketing enabled, or ask shoppers to opt in when you add that flow.")
                                        .font(HBFont.caption())
                                        .foregroundStyle(.orange)
                                }
                                Text("Push notifications: up to 40 devices per send (FCM). Everyone still gets the in-app card.")
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.mutedGray)
                            }
                        }
                    }
                }

                adminFormSection(title: "Content") {
                    VStack(alignment: .leading, spacing: 14) {
                        labeledField("Subject", subtitle: "Short headline — also used as the push title.") {
                            TextField("Spring collection is live", text: $notifyTitle)
                                .font(.body)
                                .textInputAutocapitalization(.sentences)
                        }
                        labeledField("Preview text", subtitle: "Optional body shown under the headline in the app.") {
                            TextField("Tell them what’s new, what’s on sale, or what to tap next…", text: $notifyBody, axis: .vertical)
                                .lineLimit(4...12)
                                .font(.body)
                        }
                    }
                }

                adminFormSection(title: "Appearance") {
                    VStack(alignment: .leading, spacing: 14) {
                        labeledField("Label", subtitle: "Small pill above the headline (e.g. New drop, Sale, VIP)") {
                            TextField("Optional", text: $notifyBadge)
                                .font(.body)
                        }
                        labeledField("Hero image", subtitle: "HTTPS URL only — wide image across the top of the card.") {
                            TextField("https://…", text: $notifyImageUrl)
                                .textInputAutocapitalization(.never)
                                .keyboardType(.URL)
                                .font(.body)
                        }
                    }
                }

                adminFormSection(title: "Preview") {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("How this appears in Notifications (unread styling).")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                        NewsletterStyleNotificationCard(
                            title: notifyPreviewHeadline,
                            detailText: notifyPreviewBody,
                            badge: notifyPreviewBadge,
                            imageURL: notifyPreviewHeroURL,
                            footerTimeText: "Preview",
                            showUnreadChrome: true
                        )
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 20)
            .padding(.bottom, 32)
        }
        .scrollContentBackground(.hidden)
        .background(AdminMarketingComposerChrome.background)
        .navigationTitle("Marketing")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Send") {
                    if audience == .marketingSubscribers {
                        confirmMarketingBroadcast = true
                    } else {
                        Task { await send() }
                    }
                }
                .fontWeight(.semibold)
                .disabled(isSending || !canSend)
            }
        }
        .overlay {
            if isSending {
                ProgressView("Sending…")
                    .padding(20)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
        .alert("Send to marketing subscribers?", isPresented: $confirmMarketingBroadcast) {
            Button("Cancel", role: .cancel) {}
            Button("Send to \(marketingSubscriberCount)") {
                Task { await send() }
            }
        } message: {
            Text("This creates an in-app notification for each subscriber. You’re responsible for content and consent.")
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
        .alert("Sent", isPresented: Binding(
            get: { successSummary != nil },
            set: { if !$0 { successSummary = nil } }
        )) {
            Button("OK", role: .cancel) { successSummary = nil }
        } message: {
            Text(successSummary ?? "")
        }
        .sheet(isPresented: $showCustomerPicker) {
            AdminNotifyCustomerPickerView { c in
                selectedCustomer = c
            }
            .environmentObject(api)
        }
        .task(id: customersListRefreshNonce) {
            await loadCustomers()
        }
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
                .background(AdminMarketingComposerChrome.cardFill)
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
                .background(AdminMarketingComposerChrome.fieldFill)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(Color.black.opacity(0.06), lineWidth: 1)
                )
            if !subtitle.isEmpty {
                Text(subtitle)
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            }
        }
    }

    private var notifyPreviewHeadline: String {
        let t = notifyTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? "Subject" : t
    }

    private var notifyPreviewBody: String? {
        let b = notifyBody.trimmingCharacters(in: .whitespacesAndNewlines)
        return b.isEmpty ? nil : b
    }

    private var notifyPreviewBadge: String? {
        let b = notifyBadge.trimmingCharacters(in: .whitespacesAndNewlines)
        return b.isEmpty ? nil : b
    }

    private var notifyPreviewHeroURL: URL? {
        let s = notifyImageUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let u = URL(string: s), let scheme = u.scheme?.lowercased(), scheme == "https" else { return nil }
        return u
    }

    private func displayName(_ c: AdminCustomerSummaryDTO) -> String {
        if let n = c.fullName?.trimmingCharacters(in: .whitespacesAndNewlines), !n.isEmpty {
            return n
        }
        return c.email
    }

    private func loadCustomers() async {
        customersLoadError = nil
        do {
            let r: AdminCustomersListResponse = try await api.request("/admin/customers", method: "GET")
            customers = r.customers
        } catch {
            customersLoadError = error.localizedDescription
            customers = []
        }
    }

    private func send() async {
        errorMessage = nil
        successSummary = nil
        let title = notifyTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else {
            errorMessage = "Add a subject."
            return
        }

        var payload: [String: Any] = [
            "type": "promotion",
            "title": title,
        ]

        switch audience {
        case .single:
            guard let uid = selectedCustomer?.id else {
                errorMessage = "Select a customer."
                return
            }
            payload["userId"] = uid
            payload["audience"] = "single"
        case .marketingSubscribers:
            payload["audience"] = "marketing_subscribers"
        }

        let bodyText = notifyBody.trimmingCharacters(in: .whitespacesAndNewlines)
        if !bodyText.isEmpty {
            payload["body"] = bodyText
        }
        var data: [String: String] = [:]
        let badge = notifyBadge.trimmingCharacters(in: .whitespacesAndNewlines)
        let img = notifyImageUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        if !badge.isEmpty { data["badge"] = badge }
        if !img.isEmpty { data["imageUrl"] = img }
        if !data.isEmpty {
            payload["data"] = data
        }

        isSending = true
        defer { isSending = false }
        do {
            let r: AdminNotifySendResponse = try await api.request(
                "/notifications",
                method: "POST",
                jsonBody: payload
            )
            guard r.ok else {
                errorMessage = "Send failed."
                return
            }
            let n = r.sentCount ?? 0
            if audience == .marketingSubscribers {
                var parts = ["In-app: \(n) subscriber\(n == 1 ? "" : "s")."]
                if let p = r.pushSent, p > 0 {
                    parts.append("Push: \(p) device(s).")
                }
                if r.pushCapped == true {
                    parts.append("(Push capped at 40; everyone still got the in-app message.)")
                }
                successSummary = parts.joined(separator: " ")
            } else {
                successSummary = "Delivered to \(selectedCustomer?.email ?? "customer")."
            }
            notifyTitle = ""
            notifyBody = ""
            notifyBadge = ""
            notifyImageUrl = ""
            HBFeedback.success()
        } catch let e as APIError {
            errorMessage = e.localizedDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private enum AdminMarketingComposerChrome {
    static var background: Color { HBColors.cream.opacity(0.45) }
    static var cardFill: Color { HBColors.surface }
    static var fieldFill: Color { Color(uiColor: .secondarySystemGroupedBackground) }
}

// MARK: - Customer picker (marketing composer)

private struct AdminNotifyCustomerPickerView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var api: APIClient
    var onPick: (AdminCustomerSummaryDTO) -> Void

    @State private var customers: [AdminCustomerSummaryDTO] = []
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var search = ""

    private var filtered: [AdminCustomerSummaryDTO] {
        let base = customers.filter { $0.role == "customer" }
        let q = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if q.isEmpty { return base }
        return base.filter {
            $0.email.lowercased().contains(q)
                || ($0.fullName?.lowercased().contains(q) ?? false)
                || $0.id.lowercased().contains(q)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading customers…")
                        .tint(HBColors.gold)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let loadError {
                    HBEmptyState(
                        systemImage: "person.crop.circle.badge.xmark",
                        title: "Couldn’t load customers",
                        message: loadError,
                        retryTitle: "Try again",
                        retry: { Task { await load() } }
                    )
                } else if filtered.isEmpty {
                    ContentUnavailableView.search(text: search)
                } else {
                    List(filtered) { c in
                        Button {
                            onPick(c)
                            dismiss()
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(displayName(c))
                                    .font(HBFont.headline())
                                    .foregroundStyle(HBColors.charcoal)
                                Text(c.email)
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.mutedGray)
                            }
                        }
                        .listRowBackground(HBColors.surface)
                    }
                    .listStyle(.plain)
                    .searchable(text: $search, prompt: "Search name, email, or ID")
                }
            }
            .hbScreenBackground()
            .navigationTitle("Choose customer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .task { await load() }
        }
    }

    private func displayName(_ c: AdminCustomerSummaryDTO) -> String {
        if let n = c.fullName?.trimmingCharacters(in: .whitespacesAndNewlines), !n.isEmpty {
            return n
        }
        return c.email
    }

    private func load() async {
        isLoading = true
        loadError = nil
        defer { isLoading = false }
        do {
            let r: AdminCustomersListResponse = try await api.request("/admin/customers", method: "GET")
            customers = r.customers
        } catch {
            loadError = error.localizedDescription
        }
    }
}

#Preview {
    NavigationStack {
        AdminNotifyComposerView()
            .environmentObject(APIClient())
    }
}

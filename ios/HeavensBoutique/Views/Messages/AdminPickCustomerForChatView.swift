import SwiftUI

/// Admin-only: choose which customer the new conversation belongs to (`conversations.user_id`).
struct AdminPickCustomerForChatView: View {
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
                        title: "Couldn’t load people",
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
            .navigationTitle("New chat")
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

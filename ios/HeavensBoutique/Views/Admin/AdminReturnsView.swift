import SwiftUI

/// Admin: view/approve return requests and generate return labels.
struct AdminReturnsView: View {
    @EnvironmentObject private var api: APIClient
    @State private var rows: [AdminReturnListRowDTO] = []
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        Group {
            if isLoading && rows.isEmpty {
                ProgressView().tint(HBColors.gold).frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error, rows.isEmpty {
                HBEmptyState(systemImage: "arrow.uturn.left.circle", title: "Couldn't load returns", message: error, retryTitle: "Try again") {
                    Task { await load() }
                }
            } else if rows.isEmpty {
                HBEmptyState(
                    systemImage: "arrow.uturn.left",
                    title: "No return requests",
                    message: "Customer-initiated return requests will show up here.",
                    retryTitle: nil,
                    retry: nil
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(rows) { r in
                    NavigationLink {
                        AdminReturnDetailView(returnId: r.id)
                            .environmentObject(api)
                    } label: {
                        row(r)
                    }
                    .listRowBackground(HBColors.surface)
                }
                .scrollContentBackground(.hidden)
                .background(HBColors.cream.ignoresSafeArea())
            }
        }
        .navigationTitle("Returns")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
    }

    private func row(_ r: AdminReturnListRowDTO) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(r.reason)
                    .font(HBFont.caption().weight(.semibold))
                    .foregroundStyle(HBColors.charcoal)
                Spacer()
                statusBadge(r.status)
            }
            Text(r.email)
                .font(HBFont.caption())
                .foregroundStyle(HBColors.mutedGray)
                .lineLimit(1)
            HStack {
                Text("Order \(String(r.orderId.prefix(8)).uppercased())")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
                Spacer()
                if let total = r.totalCents {
                    Text(NumberFormatter.localizedString(from: NSNumber(value: Double(total) / 100), number: .currency))
                        .font(HBFont.caption().weight(.medium))
                        .foregroundStyle(HBColors.gold)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func statusBadge(_ status: String) -> some View {
        let (color, label): (Color, String) = {
            switch status {
            case "pending": return (HBColors.mutedGray, "Pending")
            case "approved": return (HBColors.gold, "Approved")
            case "rejected": return (.red.opacity(0.75), "Rejected")
            case "completed": return (.green.opacity(0.75), "Completed")
            default: return (HBColors.mutedGray, status.capitalized)
            }
        }()
        return Text(label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }

    private func load() async {
        if rows.isEmpty { isLoading = true }
        error = nil
        defer { isLoading = false }
        do {
            let r: AdminReturnsResponse = try await api.request("/admin/returns", method: "GET")
            rows = r.returns
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct AdminReturnDetailView: View {
    let returnId: String
    @EnvironmentObject private var api: APIClient
    @State private var ret: AdminReturnDetailDTO?
    @State private var isLoading = true
    @State private var error: String?

    @State private var statusDraft = "pending"
    @State private var adminNotesDraft = ""
    @State private var isSaving = false
    @State private var saveError: String?
    @State private var saveMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if isLoading && ret == nil {
                    ProgressView().tint(HBColors.gold).frame(maxWidth: .infinity).padding()
                } else if let error, ret == nil {
                    Text(error).font(HBFont.body()).foregroundStyle(HBColors.mutedGray)
                } else if let r = ret {
                    header(r)

                    if let addr = r.shippingAddress {
                        addressCard(addr)
                    }

                    editCard

                    if let labelUrl = r.returnLabelUrl, !labelUrl.isEmpty {
                        labelCard(labelUrl)
                    }

                    if let saveMessage {
                        Text(saveMessage).font(HBFont.caption()).foregroundStyle(HBColors.gold)
                    }
                    if let saveError {
                        Text(saveError).font(HBFont.caption()).foregroundStyle(.red.opacity(0.85))
                    }
                }
            }
            .padding()
        }
        .hbScreenBackground()
        .navigationTitle("Return")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
    }

    private func header(_ r: AdminReturnDetailDTO) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Return \(String(r.id.prefix(8)).uppercased())")
                .font(HBFont.headline())
                .foregroundStyle(HBColors.charcoal)
            Text(r.email)
                .font(HBFont.caption())
                .foregroundStyle(HBColors.mutedGray)
            HStack {
                Text("Order \(String(r.orderId.prefix(8)).uppercased())")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
                Spacer()
                if let total = r.totalCents {
                    Text(NumberFormatter.localizedString(from: NSNumber(value: Double(total) / 100), number: .currency))
                        .font(HBFont.caption().weight(.medium))
                        .foregroundStyle(HBColors.gold)
                }
            }
            Text("Reason: \(r.reason)")
                .font(HBFont.caption())
                .foregroundStyle(HBColors.charcoal)
            if let notes = r.notes, !notes.isEmpty {
                Text(notes).font(HBFont.caption()).foregroundStyle(HBColors.mutedGray)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .hbCardStyle()
    }

    private func addressCard(_ addr: ShippingAddressDTO) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("From (customer)")
                .font(HBFont.caption().weight(.semibold))
                .foregroundStyle(HBColors.mutedGray)
            if let name = addr.name, !name.isEmpty {
                Text(name).font(HBFont.caption().weight(.medium)).foregroundStyle(HBColors.charcoal)
            }
            Text(addr.line1).font(HBFont.caption()).foregroundStyle(HBColors.charcoal)
            if let l2 = addr.line2, !l2.isEmpty {
                Text(l2).font(HBFont.caption()).foregroundStyle(HBColors.mutedGray)
            }
            Text("\(addr.city)\(addr.state.map { ", \($0)" } ?? "") \(addr.postal)")
                .font(HBFont.caption()).foregroundStyle(HBColors.mutedGray)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .hbCardStyle()
    }

    private var editCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Admin actions")
                .font(HBFont.caption().weight(.semibold))
                .foregroundStyle(HBColors.charcoal)

            Picker("Status", selection: $statusDraft) {
                Text("Pending").tag("pending")
                Text("Approved").tag("approved")
                Text("Rejected").tag("rejected")
                Text("Completed").tag("completed")
            }
            .pickerStyle(.menu)

            TextField("Admin notes (optional)", text: $adminNotesDraft, axis: .vertical)
                .lineLimit(2...6)

            HBPrimaryButton(title: "Save", isLoading: isSaving) {
                Task { await save(generateLabel: false) }
            }

            HBPrimaryButton(title: "Approve & generate return label", isLoading: isSaving) {
                Task { await save(generateLabel: true) }
            }
            .disabled(statusDraft == "rejected" || statusDraft == "completed")
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(HBColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func labelCard(_ url: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Return label")
                .font(HBFont.caption().weight(.semibold))
                .foregroundStyle(HBColors.charcoal)
            if let link = URL(string: url) {
                Link(destination: link) {
                    HStack {
                        Image(systemName: "printer.fill")
                        Text("Open return label")
                    }
                    .font(HBFont.caption().weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(HBColors.gold)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            } else {
                Text(url).font(.system(.caption, design: .monospaced)).foregroundStyle(HBColors.mutedGray)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .hbCardStyle()
    }

    private func load() async {
        if ret == nil { isLoading = true }
        error = nil
        defer { isLoading = false }
        do {
            let r: AdminReturnDetailResponse = try await api.request("/admin/returns/\(returnId)", method: "GET")
            ret = r.return
            statusDraft = r.return.status
            adminNotesDraft = r.return.adminNotes ?? ""
            saveError = nil
            saveMessage = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func save(generateLabel: Bool) async {
        guard ret != nil else { return }
        isSaving = true
        saveError = nil
        saveMessage = nil
        defer { isSaving = false }
        do {
            var body: [String: Any] = [
                "status": generateLabel ? "approved" : statusDraft,
                "adminNotes": adminNotesDraft.trimmingCharacters(in: .whitespacesAndNewlines),
            ]
            if generateLabel { body["generateLabel"] = true }
            let _: AdminReturnDetailResponse = try await api.request("/admin/returns/\(returnId)", method: "PATCH", jsonBody: body)
            HBFeedback.success()
            saveMessage = generateLabel ? "Approved. Label generated (if configured)." : "Saved."
            await load()
        } catch {
            HBFeedback.warning()
            saveError = error.localizedDescription
        }
    }
}


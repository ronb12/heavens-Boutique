import SwiftUI

struct ReturnsListView: View {
    @EnvironmentObject private var api: APIClient
    @State private var returns: [ReturnDTO] = []
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        Group {
            if isLoading && returns.isEmpty {
                ProgressView().tint(HBColors.gold).frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error, returns.isEmpty {
                HBEmptyState(systemImage: "arrow.uturn.left.slash", title: "Couldn't load returns", message: error, retryTitle: "Try again") {
                    Task { await load() }
                }
            } else if returns.isEmpty {
                HBEmptyState(
                    systemImage: "arrow.uturn.left",
                    title: "No returns",
                    message: "Return requests you submit will appear here.",
                    retryTitle: nil, retry: nil
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(returns) { ret in
                    NavigationLink(destination: ReturnDetailView(returnId: ret.id)) {
                        returnRow(ret)
                    }
                    .listRowBackground(HBColors.surface)
                }
                .scrollContentBackground(.hidden)
                .background(HBColors.cream.ignoresSafeArea())
            }
        }
        .navigationTitle("My returns")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
    }

    private func returnRow(_ ret: ReturnDTO) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(ret.reason)
                    .font(HBFont.caption().weight(.semibold))
                    .foregroundStyle(HBColors.charcoal)
                Spacer()
                returnStatusBadge(ret.status)
            }
            Text("Order \(String(ret.orderId.prefix(8)).uppercased())")
                .font(HBFont.caption())
                .foregroundStyle(HBColors.mutedGray)
        }
        .padding(.vertical, 4)
    }

    private func returnStatusBadge(_ status: String) -> some View {
        let (color, label): (Color, String) = {
            switch status {
            case "pending": return (HBColors.mutedGray, "Pending")
            case "approved": return (HBColors.gold, "Approved")
            case "rejected": return (.red.opacity(0.7), "Rejected")
            case "completed": return (.green.opacity(0.7), "Completed")
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
        if returns.isEmpty { isLoading = true }
        error = nil
        defer { isLoading = false }
        do {
            let r: ReturnsResponse = try await api.request("/returns", method: "GET")
            returns = r.returns
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct ReturnDetailView: View {
    let returnId: String
    @EnvironmentObject private var api: APIClient
    @State private var ret: ReturnDTO?
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if isLoading && ret == nil {
                    ProgressView().tint(HBColors.gold).frame(maxWidth: .infinity).padding()
                } else if let error, ret == nil {
                    Text(error).font(HBFont.body()).foregroundStyle(HBColors.mutedGray)
                } else if let r = ret {
                    Group {
                        infoCard(r)
                        if let labelUrl = r.returnLabelUrl, !labelUrl.isEmpty {
                            labelCard(labelUrl)
                        }
                    }
                }
            }
            .padding()
        }
        .hbScreenBackground()
        .navigationTitle("Return details")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
    }

    private func infoCard(_ r: ReturnDTO) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Return #\(String(r.id.prefix(8)).uppercased())")
                    .font(HBFont.headline())
                    .foregroundStyle(HBColors.charcoal)
                Spacer()
                statusBadge(r.status)
            }
            divider()
            row("Order", String(r.orderId.prefix(8)).uppercased())
            row("Reason", r.reason)
            if let notes = r.notes, !notes.isEmpty {
                row("Notes", notes)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .hbCardStyle()
    }

    private func labelCard(_ url: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Return label ready")
                .font(HBFont.caption().weight(.semibold))
                .foregroundStyle(HBColors.charcoal)
            Text("Print this label and drop off your package at a carrier location.")
                .font(HBFont.caption())
                .foregroundStyle(HBColors.mutedGray)
            if let link = URL(string: url) {
                Link(destination: link) {
                    HStack {
                        Image(systemName: "printer.fill")
                        Text("Print return label")
                    }
                    .font(HBFont.caption().weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(HBColors.gold)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .hbCardStyle()
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack(alignment: .top) {
            Text(label).font(HBFont.caption()).foregroundStyle(HBColors.mutedGray).frame(width: 72, alignment: .leading)
            Text(value).font(HBFont.caption()).foregroundStyle(HBColors.charcoal)
        }
    }

    private func divider() -> some View { Divider().opacity(0.4) }

    private func statusBadge(_ status: String) -> some View {
        let (color, label): (Color, String) = {
            switch status {
            case "pending": return (HBColors.mutedGray, "Pending")
            case "approved": return (HBColors.gold, "Approved")
            case "rejected": return (.red.opacity(0.7), "Rejected")
            case "completed": return (.green.opacity(0.7), "Completed")
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
        if ret == nil { isLoading = true }
        error = nil
        defer { isLoading = false }
        do {
            let r: ReturnResponse = try await api.request("/returns/\(returnId)", method: "GET")
            ret = r.return
        } catch {
            self.error = error.localizedDescription
        }
    }
}

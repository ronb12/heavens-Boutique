import SwiftUI

struct AddressBookView: View {
    @EnvironmentObject private var api: APIClient
    @State private var addresses: [AddressDTO] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var showAddForm = false
    @State private var editingAddress: AddressDTO?
    @State private var deleteError: String?

    var body: some View {
        Group {
            if isLoading && addresses.isEmpty {
                ProgressView().tint(HBColors.gold).frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error, addresses.isEmpty {
                HBEmptyState(systemImage: "location.slash", title: "Couldn't load addresses", message: error, retryTitle: "Try again") {
                    Task { await load() }
                }
            } else {
                List {
                    ForEach(addresses) { addr in
                        addressRow(addr)
                    }
                    Button {
                        showAddForm = true
                    } label: {
                        Label("Add address", systemImage: "plus.circle.fill")
                            .foregroundStyle(HBColors.gold)
                    }
                    .listRowBackground(HBColors.surface)
                }
                .scrollContentBackground(.hidden)
                .background(HBColors.cream.ignoresSafeArea())
            }
        }
        .navigationTitle("Shipping addresses")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showAddForm = true
                } label: {
                    Image(systemName: "plus")
                        .foregroundStyle(HBColors.gold)
                }
            }
        }
        .sheet(isPresented: $showAddForm, onDismiss: { Task { await load() } }) {
            AddressFormView(existingAddress: nil)
        }
        .sheet(item: $editingAddress, onDismiss: { Task { await load() } }) { addr in
            AddressFormView(existingAddress: addr)
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private func addressRow(_ addr: AddressDTO) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                if let label = addr.label, !label.isEmpty {
                    Text(label)
                        .font(HBFont.caption().weight(.semibold))
                        .foregroundStyle(HBColors.gold)
                }
                if addr.isDefault {
                    Text("Default")
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(HBColors.gold.opacity(0.15))
                        .foregroundStyle(HBColors.gold)
                        .clipShape(Capsule())
                }
                Spacer()
                Button {
                    editingAddress = addr
                } label: {
                    Image(systemName: "pencil")
                        .font(.caption)
                        .foregroundStyle(HBColors.mutedGray)
                }
                .buttonStyle(.plain)
            }
            if let name = addr.name, !name.isEmpty {
                Text(name).font(HBFont.caption()).foregroundStyle(HBColors.charcoal)
            }
            Text(addr.line1).font(HBFont.caption()).foregroundStyle(HBColors.charcoal)
            if let line2 = addr.line2, !line2.isEmpty {
                Text(line2).font(HBFont.caption()).foregroundStyle(HBColors.mutedGray)
            }
            Text("\(addr.city)\(addr.state.map { ", \($0)" } ?? "") \(addr.postal)")
                .font(HBFont.caption())
                .foregroundStyle(HBColors.mutedGray)
        }
        .padding(.vertical, 4)
        .listRowBackground(HBColors.surface)
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            if !addr.isDefault {
                Button("Default") {
                    Task { await setDefault(addr) }
                }
                .tint(HBColors.gold)
            }
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) {
                Task { await delete(addr) }
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    private func load() async {
        if addresses.isEmpty { isLoading = true }
        error = nil
        defer { isLoading = false }
        do {
            let r: AddressesResponse = try await api.request("/users/addresses", method: "GET")
            addresses = r.addresses
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func setDefault(_ addr: AddressDTO) async {
        do {
            let _: AddressResponse = try await api.request("/users/addresses/\(addr.id)", method: "PATCH", jsonBody: ["isDefault": true])
            await load()
        } catch { }
    }

    private func delete(_ addr: AddressDTO) async {
        do {
            try await api.requestVoid("/users/addresses/\(addr.id)", method: "DELETE")
            await load()
        } catch { }
    }
}

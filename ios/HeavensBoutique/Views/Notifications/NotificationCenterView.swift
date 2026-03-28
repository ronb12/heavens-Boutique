import SwiftUI

struct NotificationCenterView: View {
    @EnvironmentObject private var api: APIClient
    @StateObject private var vm = NotificationsViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading {
                    ProgressView()
                } else if let err = vm.error {
                    Text(err).foregroundStyle(HBColors.mutedGray)
                } else {
                    List(vm.items) { n in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(n.title)
                                    .font(HBFont.headline())
                                    .foregroundStyle(HBColors.charcoal)
                                Spacer()
                                if n.readAt == nil {
                                    Circle()
                                        .fill(HBColors.gold)
                                        .frame(width: 8, height: 8)
                                }
                            }
                            if let b = n.body {
                                Text(b)
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.mutedGray)
                            }
                            Text(n.type.replacingOccurrences(of: "_", with: " ").capitalized)
                                .font(HBFont.caption())
                                .foregroundStyle(HBColors.rosePink)
                        }
                        .padding(.vertical, 4)
                        .listRowBackground(HBColors.cream)
                    }
                    .listStyle(.plain)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .hbScreenBackground()
            .navigationTitle("Notifications")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Mark all read") {
                        Task { await vm.markAllRead(api: api) }
                    }
                    .foregroundStyle(HBColors.gold)
                }
            }
            .task { await vm.load(api: api) }
            .refreshable { await vm.load(api: api) }
        }
    }
}

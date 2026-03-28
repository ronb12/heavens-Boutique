import SwiftUI

struct NotificationCenterView: View {
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var session: SessionViewModel
    @EnvironmentObject private var appModel: AppModel
    @StateObject private var vm = NotificationsViewModel()

    private var needsSignIn: Bool { !session.isLoggedIn }

    var body: some View {
        NavigationStack {
            Group {
                if needsSignIn {
                    HBEmptyState(
                        systemImage: "bell",
                        title: "Sign in for notifications",
                        message: "Order updates and boutique notes appear here after you create an account or sign in.",
                        retryTitle: "Sign in",
                        retry: { appModel.presentAuth(.login) }
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if vm.isLoading && vm.items.isEmpty {
                    ProgressView("Loading…")
                        .tint(HBColors.gold)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let err = vm.error, vm.items.isEmpty {
                    HBEmptyState(
                        systemImage: "bell.slash",
                        title: "Notifications unavailable",
                        message: err,
                        retryTitle: "Try again",
                        retry: { Task { await vm.load(api: api) } }
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if vm.items.isEmpty {
                    HBEmptyState(
                        systemImage: "bell",
                        title: "You’re all caught up",
                        message: "Order updates, styling tips, and promos will show up here.",
                        retryTitle: nil,
                        retry: nil
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(vm.items) { n in
                            Button {
                                Task {
                                    await vm.markRead(id: n.id, api: api)
                                    routeFromNotification(n)
                                }
                            } label: {
                                notificationRow(n)
                            }
                            .buttonStyle(.plain)
                            .listRowBackground(HBColors.surface)
                        }
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
                    .disabled(needsSignIn || vm.items.isEmpty)
                }
            }
            .task {
                guard !needsSignIn else { return }
                await vm.load(api: api)
            }
            .refreshable {
                guard !needsSignIn else { return }
                await vm.load(api: api)
            }
        }
    }

    @ViewBuilder
    private func notificationRow(_ n: NotificationDTO) -> some View {
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
                        .accessibilityLabel("Unread")
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
        .accessibilityElement(children: .combine)
        .accessibilityHint("Opens related screen when available")
    }

    private func routeFromNotification(_ n: NotificationDTO) {
        if let oid = n.data?.orderId, !oid.isEmpty {
            appModel.pendingOrderIdToOpen = oid
            appModel.openProfileTab()
        } else if n.type.lowercased() == "order" {
            appModel.openProfileTab()
        }
        if let cid = n.data?.conversationId {
            appModel.pendingConversationIdToOpen = cid
            appModel.openMessagesTab()
        }
    }
}

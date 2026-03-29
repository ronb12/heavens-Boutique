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
                    ScrollView {
                        LazyVStack(spacing: 16) {
                            Text("From the boutique")
                                .font(HBFont.caption().weight(.semibold))
                                .foregroundStyle(HBColors.mutedGray)
                                .textCase(.uppercase)
                                .tracking(1.2)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 4)
                                .padding(.top, 4)

                            ForEach(vm.items) { n in
                                Button {
                                    Task {
                                        await vm.markRead(id: n.id, api: api)
                                        routeFromNotification(n)
                                    }
                                } label: {
                                    if n.usesNewsletterLayout {
                                        promotionNewsletterCard(n)
                                    } else {
                                        transactionalNotificationCard(n)
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 28)
                    }
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

    // MARK: - Newsletter / promotion card (editorial layout)

    @ViewBuilder
    private func promotionNewsletterCard(_ n: NotificationDTO) -> some View {
        let heroURL = n.data?.imageUrl.flatMap { URL(string: $0.trimmingCharacters(in: .whitespacesAndNewlines)) }
        NewsletterStyleNotificationCard(
            title: n.title,
            detailText: n.body,
            badge: n.data?.badge,
            imageURL: heroURL,
            footerTimeText: formattedNotificationTime(n.createdAt),
            showUnreadChrome: n.readAt == nil
        )
        .accessibilityHint("Opens related screen when available")
    }

    // MARK: - Transactional cards (orders, messages, cart)

    @ViewBuilder
    private func transactionalNotificationCard(_ n: NotificationDTO) -> some View {
        let unread = n.readAt == nil
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [HBColors.gold.opacity(0.22), HBColors.softPink.opacity(0.35)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 48, height: 48)
                Image(systemName: iconName(for: n))
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(HBColors.gold)
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline) {
                    Text(n.title)
                        .font(HBFont.headline())
                        .foregroundStyle(HBColors.charcoal)
                    Spacer(minLength: 8)
                    if unread {
                        Circle()
                            .fill(HBColors.gold)
                            .frame(width: 8, height: 8)
                    }
                }
                if let b = n.body, !b.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(b)
                        .font(HBFont.body())
                        .foregroundStyle(HBColors.mutedGray)
                        .lineSpacing(3)
                        .fixedSize(horizontal: false, vertical: true)
                }
                HStack {
                    Text(n.type.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(HBFont.caption().weight(.medium))
                        .foregroundStyle(HBColors.rosePink)
                    if let line = formattedNotificationTime(n.createdAt) {
                        Text("·")
                            .foregroundStyle(HBColors.mutedGray.opacity(0.6))
                        Text(line)
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .background(HBColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(HBColors.gold.opacity(unread ? 0.28 : 0.12), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.04), radius: 8, x: 0, y: 3)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Opens related screen when available")
    }

    private func iconName(for n: NotificationDTO) -> String {
        let t = n.type.lowercased()
        if t == "admin_alert" {
            switch n.data?.kind?.lowercased() {
            case "new_order": return "cart.fill.badge.plus"
            case "low_stock": return "cube.box.fill"
            case "new_signup": return "person.badge.plus"
            default: return "megaphone.fill"
            }
        }
        switch t {
        case "order": return "bag.fill"
        case "message": return "bubble.left.and.bubble.right.fill"
        case "abandoned_cart": return "cart.fill"
        case "promotion": return "star.fill"
        case "back_in_stock": return "arrow.clockwise.circle.fill"
        default: return "bell.fill"
        }
    }

    private func formattedNotificationTime(_ iso: String?) -> String? {
        guard let iso, !iso.isEmpty else { return nil }
        let isoFmt = ISO8601DateFormatter()
        isoFmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = isoFmt.date(from: iso)
        if date == nil {
            isoFmt.formatOptions = [.withInternetDateTime]
            date = isoFmt.date(from: iso)
        }
        guard let date else { return nil }
        let rel = RelativeDateTimeFormatter()
        rel.unitsStyle = .abbreviated
        return rel.localizedString(for: date, relativeTo: Date())
    }

    private func routeFromNotification(_ n: NotificationDTO) {
        let t = n.type.lowercased()
        let adminOrderTap = t == "admin_alert" && n.data?.kind?.lowercased() == "new_order"
        if let oid = n.data?.orderId, !oid.isEmpty, t == "order" || adminOrderTap {
            appModel.pendingOrderIdToOpen = oid
            appModel.openProfileTab()
        } else if t == "order" {
            appModel.openProfileTab()
        }
        if let cid = n.data?.conversationId {
            appModel.pendingConversationIdToOpen = cid
            appModel.openMessagesTab()
        }
    }
}

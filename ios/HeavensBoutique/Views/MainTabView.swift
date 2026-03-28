import SwiftUI

fileprivate func hbPushString(_ value: Any?) -> String? {
    if let s = value as? String { return s }
    if let n = value as? NSNumber { return n.stringValue }
    return nil
}

struct MainTabView: View {
    @EnvironmentObject private var appModel: AppModel

    var body: some View {
        VStack(spacing: 0) {
            if appModel.session.isAdmin && appModel.customerViewPreview {
                customerPreviewBanner
            }
            TabView(selection: $appModel.tabSelection) {
            HomeView()
                .tabItem { Label("Home", systemImage: "house.fill") }
                .tag(0)
                .accessibilityIdentifier("tab_home")
            ShopView()
                .tabItem { Label("Shop", systemImage: "bag.fill") }
                .tag(1)
                .accessibilityIdentifier("tab_shop")
            ConversationsListView()
                .tabItem { Label("Messages", systemImage: "bubble.left.and.bubble.right.fill") }
                .tag(2)
                .accessibilityIdentifier("tab_messages")
            NotificationCenterView()
                .tabItem { Label("Notifications", systemImage: "bell.fill") }
                .tag(3)
                .accessibilityIdentifier("tab_notifications")
            ProfileView()
                .tabItem { Label("Profile", systemImage: "person.crop.circle.fill") }
                .tag(4)
                .accessibilityIdentifier("tab_profile")
            }
            .tint(HBColors.gold)
        }
        .onReceive(NotificationCenter.default.publisher(for: .hbPushNotificationTapped)) { note in
            guard let info = note.object as? [AnyHashable: Any] else { return }
            let type = (info["type"] as? String)?.lowercased()
            if let oid = hbPushString(info["orderId"]) ?? hbPushString(info["order_id"]), !oid.isEmpty {
                appModel.pendingOrderIdToOpen = oid
                appModel.openProfileTab()
            } else if type == "order" {
                appModel.openProfileTab()
            }
            if let cid = hbPushString(info["conversationId"]) ?? hbPushString(info["conversation_id"]), !cid.isEmpty {
                appModel.pendingConversationIdToOpen = cid
                appModel.openMessagesTab()
            }
        }
    }

    private var customerPreviewBanner: some View {
        HStack(spacing: 12) {
            Image(systemName: "eye")
                .font(.caption.weight(.semibold))
                .foregroundStyle(HBColors.gold)
            Text("Customer view — browsing as a shopper")
                .font(HBFont.caption().weight(.medium))
                .foregroundStyle(HBColors.charcoal)
            Spacer(minLength: 8)
            Button("Exit") {
                appModel.exitCustomerViewPreview()
                HBFeedback.light()
            }
            .font(HBFont.caption().weight(.semibold))
            .foregroundStyle(HBColors.gold)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(HBColors.surface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(HBColors.gold.opacity(0.35))
                .frame(height: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityHint("Double tap Exit to show admin tools again.")
    }
}

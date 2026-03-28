import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var appModel: AppModel

    var body: some View {
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
        .onReceive(NotificationCenter.default.publisher(for: .hbPushNotificationTapped)) { note in
            guard let info = note.object as? [AnyHashable: Any] else { return }
            let type = (info["type"] as? String)?.lowercased()
            if info["orderId"] != nil || type == "order" {
                appModel.openProfileTab()
            }
            if let cid = info["conversationId"] as? String ?? info["conversation_id"] as? String {
                appModel.pendingConversationIdToOpen = cid
                appModel.openMessagesTab()
            }
        }
    }
}

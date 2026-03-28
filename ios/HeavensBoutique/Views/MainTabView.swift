import SwiftUI

struct MainTabView: View {
    @State private var tab = 0

    var body: some View {
        TabView(selection: $tab) {
            HomeView()
                .tabItem { Label("Home", systemImage: "house.fill") }
                .tag(0)
            ShopView()
                .tabItem { Label("Shop", systemImage: "bag.fill") }
                .tag(1)
            ConversationsListView()
                .tabItem { Label("Messages", systemImage: "bubble.left.and.bubble.right.fill") }
                .tag(2)
            NotificationCenterView()
                .tabItem { Label("Notifications", systemImage: "bell.fill") }
                .tag(3)
            ProfileView()
                .tabItem { Label("Profile", systemImage: "person.crop.circle.fill") }
                .tag(4)
        }
        .tint(HBColors.gold)
    }
}

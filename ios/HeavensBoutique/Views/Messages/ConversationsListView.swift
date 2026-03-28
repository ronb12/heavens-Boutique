import SwiftUI

struct ConversationsListView: View {
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var session: SessionViewModel
    @StateObject private var vm = MessagesViewModel()
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if vm.isLoading {
                    ProgressView()
                } else if let err = vm.error {
                    Text(err).foregroundStyle(HBColors.mutedGray)
                } else if vm.conversations.isEmpty {
                    VStack(spacing: 16) {
                        Text("No conversations yet")
                            .font(HBFont.headline())
                            .foregroundStyle(HBColors.charcoal)
                        Text("Start a chat with our stylists for sizing, styling, or order help.")
                            .font(HBFont.caption())
                            .foregroundStyle(HBColors.mutedGray)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                        HBPrimaryButton(title: "New conversation", isLoading: false) {
                            Task {
                                if let id = await vm.createConversation(api: api) {
                                    await vm.openConversation(id, api: api)
                                    path.append(id)
                                }
                            }
                        }
                        .padding(.horizontal, 32)
                    }
                } else {
                    List(vm.conversations) { c in
                        Button {
                            path.append(c.id)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(c.title ?? "Conversation")
                                    .font(HBFont.headline())
                                    .foregroundStyle(HBColors.charcoal)
                                if let e = c.customerEmail {
                                    Text(e)
                                        .font(HBFont.caption())
                                        .foregroundStyle(HBColors.mutedGray)
                                }
                            }
                        }
                        .listRowBackground(HBColors.cream)
                    }
                    .listStyle(.plain)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .hbScreenBackground()
            .navigationTitle("Messages")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task {
                            if let id = await vm.createConversation(api: api) {
                                await vm.openConversation(id, api: api)
                                path.append(id)
                            }
                        }
                    } label: {
                        Image(systemName: "square.and.pencil")
                            .foregroundStyle(HBColors.gold)
                    }
                }
            }
            .navigationDestination(for: String.self) { id in
                ChatView(conversationId: id)
            }
            .task {
                await vm.loadConversations(api: api, adminAll: session.isAdmin)
            }
            .refreshable {
                await vm.loadConversations(api: api, adminAll: session.isAdmin)
            }
        }
    }
}

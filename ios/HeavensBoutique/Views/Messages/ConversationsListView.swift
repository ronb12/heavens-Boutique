import SwiftUI

struct ConversationsListView: View {
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var session: SessionViewModel
    @EnvironmentObject private var appModel: AppModel

    private var needsSignIn: Bool { !session.isLoggedIn }
    @StateObject private var vm = MessagesViewModel()
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if needsSignIn {
                    HBEmptyState(
                        systemImage: "bubble.left.and.bubble.right",
                        title: "Sign in to message us",
                        message: "Create an account or sign in to chat with our stylists about fit, styling, or your orders.",
                        retryTitle: "Sign in",
                        retry: { appModel.presentAuth(.login) }
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if vm.isLoading && vm.conversations.isEmpty {
                    ProgressView("Loading conversations…")
                        .tint(HBColors.gold)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let err = vm.error, vm.conversations.isEmpty {
                    HBEmptyState(
                        systemImage: "bubble.left.and.bubble.right",
                        title: "Couldn’t load messages",
                        message: err,
                        retryTitle: "Try again",
                        retry: { Task { await vm.loadConversations(api: api, adminAll: session.isAdmin) } }
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if vm.conversations.isEmpty {
                    VStack(spacing: 16) {
                        HBEmptyState(
                            systemImage: "bubble.left.and.bubble.right",
                            title: "No conversations yet",
                            message: "Start a chat with our stylists for sizing, styling, or order help.",
                            retryTitle: nil,
                            retry: nil
                        )
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
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(vm.conversations) { c in
                        Button {
                            Task {
                                await vm.openConversation(c.id, api: api)
                                path.append(c.id)
                            }
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
                        .listRowBackground(HBColors.surface)
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
                    .accessibilityLabel("New conversation")
                    .disabled(needsSignIn)
                }
            }
            .navigationDestination(for: String.self) { id in
                ChatView(conversationId: id)
            }
            .task {
                guard !needsSignIn else { return }
                await vm.loadConversations(api: api, adminAll: session.isAdmin)
                openPendingConversationIfNeeded()
            }
            .onChange(of: appModel.pendingConversationIdToOpen) { _, _ in
                openPendingConversationIfNeeded()
            }
            .refreshable {
                guard !needsSignIn else { return }
                await vm.loadConversations(api: api, adminAll: session.isAdmin)
            }
        }
    }

    private func openPendingConversationIfNeeded() {
        guard let id = appModel.pendingConversationIdToOpen else { return }
        appModel.pendingConversationIdToOpen = nil
        Task {
            await vm.openConversation(id, api: api)
            path.append(id)
        }
    }
}

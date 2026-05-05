import SwiftUI

struct ConversationsListView: View {
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var session: SessionViewModel
    @EnvironmentObject private var appModel: AppModel

    private var useAdminMessageList: Bool { appModel.showAdminChrome }

    private var needsSignIn: Bool { !session.isLoggedIn }
    @StateObject private var vm = MessagesViewModel()
    @State private var path = NavigationPath()
    @State private var showAdminPickCustomer = false

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
                        retry: { Task { await vm.loadConversations(api: api, adminAll: useAdminMessageList) } }
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
                            if useAdminMessageList {
                                showAdminPickCustomer = true
                            } else {
                                Task {
                                    if let id = await vm.createConversation(api: api, listUsesAdminAll: false) {
                                        await vm.openConversation(id, api: api)
                                        path.append(id)
                                    }
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
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                HBFeedback.warning()
                                Task {
                                    _ = await vm.deleteConversation(
                                        conversationId: c.id,
                                        api: api,
                                        listUsesAdminAll: useAdminMessageList
                                    )
                                }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
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
                        if useAdminMessageList {
                            showAdminPickCustomer = true
                        } else {
                            Task {
                                if let id = await vm.createConversation(api: api, listUsesAdminAll: false) {
                                    await vm.openConversation(id, api: api)
                                    path.append(id)
                                }
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
                ChatView(conversationId: id, onConversationDeleted: {
                    Task { await vm.loadConversations(api: api, adminAll: useAdminMessageList) }
                })
            }
            .task {
                guard !needsSignIn else { return }
                await vm.loadConversations(api: api, adminAll: useAdminMessageList)
                openPendingConversationIfNeeded()
            }
            .onChange(of: appModel.pendingConversationIdToOpen) { _, _ in
                openPendingConversationIfNeeded()
            }
            .onChange(of: appModel.customerViewPreview) { _, _ in
                guard !needsSignIn else { return }
                Task { await vm.loadConversations(api: api, adminAll: useAdminMessageList) }
            }
            .refreshable {
                guard !needsSignIn else { return }
                await vm.loadConversations(api: api, adminAll: useAdminMessageList)
            }
            .sheet(isPresented: $showAdminPickCustomer) {
                AdminPickCustomerForChatView { customer in
                    Task {
                        if let id = await vm.createConversation(
                            api: api,
                            customerUserId: customer.id,
                            listUsesAdminAll: true
                        ) {
                            await vm.openConversation(id, api: api)
                            path.append(id)
                        }
                    }
                }
                .environmentObject(api)
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

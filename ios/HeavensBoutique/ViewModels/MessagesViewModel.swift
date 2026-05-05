import Foundation

@MainActor
final class MessagesViewModel: ObservableObject {
    @Published var conversations: [ConversationDTO] = []
    @Published var messages: [MessageDTO] = []
    @Published var isLoading = false
    @Published var isLoadingMessages = false
    @Published var error: String?
    @Published var activeConversationId: String?

    private var pollTask: Task<Void, Never>?
    private var isFetchingMessages = false

    deinit {
        pollTask?.cancel()
    }

    func loadConversations(api: APIClient, adminAll: Bool) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let path = adminAll ? "/conversations?all=1" : "/conversations"
            let r: ConversationsResponse = try await api.request(path, method: "GET")
            conversations = r.conversations
        } catch {
            self.error = error.localizedDescription
        }
    }

    func openConversation(_ id: String, api: APIClient) async {
        error = nil
        activeConversationId = id
        await loadMessages(api: api, force: true)
        startPolling(api: api)
    }

    /// - Parameter force: When true, loads even if a poll is in flight (needed after send/delete so the list updates).
    func loadMessages(api: APIClient, force: Bool = false) async {
        guard let id = activeConversationId else { return }
        if !force, isFetchingMessages { return }
        isFetchingMessages = true
        isLoadingMessages = true
        defer { isFetchingMessages = false; isLoadingMessages = false }
        do {
            let r: MessagesResponse = try await api.request("/conversations/\(id)/messages", method: "GET")
            messages = r.messages
        } catch {
            self.error = error.localizedDescription
        }
    }

    func send(text: String, api: APIClient) async {
        guard let id = activeConversationId else { return }
        do {
            try await api.requestVoid(
                "/conversations/\(id)/messages",
                method: "POST",
                jsonBody: ["body": text]
            )
            await loadMessages(api: api, force: true)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func clearMessages(api: APIClient) async {
        guard let id = activeConversationId else { return }
        do {
            try await api.requestVoid("/conversations/\(id)/messages", method: "DELETE")
            messages = []
            await loadMessages(api: api, force: true)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func deleteMessage(messageId: String, api: APIClient) async {
        guard let id = activeConversationId else { return }
        do {
            try await api.requestVoid(
                "/conversations/\(id)/messages",
                method: "DELETE",
                jsonBody: ["messageId": messageId]
            )
            messages.removeAll { $0.id == messageId }
            await loadMessages(api: api, force: true)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func deleteConversation(conversationId: String, api: APIClient, listUsesAdminAll: Bool) async -> Bool {
        do {
            try await api.requestVoid("/conversations/\(conversationId)", method: "DELETE")
            if activeConversationId == conversationId {
                activeConversationId = nil
                messages = []
                stopPolling()
            }
            await loadConversations(api: api, adminAll: listUsesAdminAll)
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    /// For customers, omit `customerUserId`. Admins must pass the customer’s user UUID (`customerUserId` in the API).
    func createConversation(
        api: APIClient,
        title: String = "Stylist chat",
        customerUserId: String? = nil,
        listUsesAdminAll: Bool = false
    ) async -> String? {
        do {
            struct R: Decodable {
                struct C: Decodable { let id: String }
                let conversation: C
            }
            var body: [String: Any] = ["title": title]
            if let uid = customerUserId?.trimmingCharacters(in: .whitespacesAndNewlines), !uid.isEmpty {
                body["customerUserId"] = uid
            }
            let r: R = try await api.request("/conversations", method: "POST", jsonBody: body)
            await loadConversations(api: api, adminAll: listUsesAdminAll)
            return r.conversation.id
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    private func startPolling(api: APIClient) {
        pollTask?.cancel()
        pollTask = Task {
            var consecutiveErrors = 0
            while !Task.isCancelled {
                let delayNs: UInt64 = consecutiveErrors > 0
                    ? min(UInt64(4_000_000_000) * UInt64(1 << min(consecutiveErrors, 4)), 60_000_000_000)
                    : 4_000_000_000
                try? await Task.sleep(nanoseconds: delayNs)
                guard !Task.isCancelled else { break }
                let hadError = error != nil
                await loadMessages(api: api, force: false)
                if error != nil && (hadError || consecutiveErrors > 0) {
                    consecutiveErrors += 1
                } else {
                    consecutiveErrors = 0
                }
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }
}

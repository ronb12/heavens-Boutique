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
        await loadMessages(api: api)
        startPolling(api: api)
    }

    func loadMessages(api: APIClient) async {
        guard let id = activeConversationId else { return }
        isLoadingMessages = true
        defer { isLoadingMessages = false }
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
            await loadMessages(api: api)
        } catch {
            self.error = error.localizedDescription
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
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 4_000_000_000)
                await loadMessages(api: api)
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }
}

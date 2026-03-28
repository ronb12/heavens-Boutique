import SwiftUI

struct ChatView: View {
    let conversationId: String

    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var session: SessionViewModel
    @StateObject private var vm = MessagesViewModel()
    @State private var draft = ""

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 10) {
                        ForEach(vm.messages) { m in
                            bubble(m)
                                .id(m.id)
                        }
                    }
                    .padding()
                }
                .onChange(of: vm.messages.count) { _, _ in
                    if let last = vm.messages.last {
                        withAnimation {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }

            HStack(spacing: 12) {
                TextField("Message", text: $draft, axis: .vertical)
                    .lineLimit(1...4)
                    .padding(12)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                Button {
                    let t = draft.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !t.isEmpty else { return }
                    draft = ""
                    Task {
                        await vm.send(text: t, api: api)
                    }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title)
                        .foregroundStyle(HBColors.gold)
                }
            }
            .padding()
            .background(HBColors.cream)
        }
        .hbScreenBackground()
        .navigationTitle("Chat")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await vm.openConversation(conversationId, api: api)
        }
        .onDisappear {
            vm.stopPolling()
        }
    }

    @ViewBuilder
    private func bubble(_ m: MessageDTO) -> some View {
        let mine = m.senderId == session.user?.id
        HStack {
            if mine { Spacer(minLength: 48) }
            VStack(alignment: mine ? .trailing : .leading, spacing: 4) {
                if let body = m.body, !body.isEmpty {
                    Text(body)
                        .font(HBFont.body())
                        .foregroundStyle(mine ? Color.white : HBColors.charcoal)
                        .padding(12)
                        .background(mine ? HBColors.gold : Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .shadow(color: .black.opacity(0.05), radius: 4, x: 0, y: 2)
                }
                if mine, m.readAt != nil {
                    Text("Read")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                }
            }
            if !mine { Spacer(minLength: 48) }
        }
    }
}

import SwiftUI

struct ReturnRequestView: View {
    let orderId: String
    let orderItems: [OrderItemDTO]
    @EnvironmentObject private var api: APIClient
    @Environment(\.dismiss) private var dismiss

    @State private var reason = ""
    @State private var notes = ""
    @State private var isSaving = false
    @State private var error: String?
    @State private var submitted = false

    private let reasonOptions = [
        "Wrong size", "Defective / damaged", "Not as described",
        "Changed my mind", "Received wrong item", "Other",
    ]

    var body: some View {
        NavigationStack {
            if submitted {
                submittedView
            } else {
                formView
            }
        }
    }

    private var formView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("We're sorry your order didn't work out. Select a reason and we'll get the return process started.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)

                VStack(alignment: .leading, spacing: 10) {
                    Text("Reason *")
                        .font(HBFont.caption().weight(.semibold))
                        .foregroundStyle(HBColors.charcoal)
                    ForEach(reasonOptions, id: \.self) { opt in
                        Button {
                            reason = opt
                            HBFeedback.light()
                        } label: {
                            HStack {
                                Text(opt)
                                    .font(HBFont.caption())
                                    .foregroundStyle(HBColors.charcoal)
                                Spacer()
                                if reason == opt {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(HBColors.gold)
                                }
                            }
                            .padding()
                            .background(reason == opt ? HBColors.gold.opacity(0.08) : HBColors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .strokeBorder(reason == opt ? HBColors.gold.opacity(0.4) : Color.clear, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Additional notes (optional)")
                        .font(HBFont.caption().weight(.semibold))
                        .foregroundStyle(HBColors.charcoal)
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                        .padding(12)
                        .background(HBColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .font(HBFont.body())
                }

                if let error {
                    Text(error)
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.rosePink)
                }

                HBPrimaryButton(title: "Submit return request", isLoading: isSaving) {
                    Task { await submit() }
                }
                .disabled(reason.isEmpty)
            }
            .padding(24)
        }
        .hbScreenBackground()
        .navigationTitle("Request return")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
    }

    private var submittedView: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "arrow.uturn.left.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(HBColors.gold)
            Text("Return requested")
                .font(HBFont.title(24))
                .foregroundStyle(HBColors.charcoal)
            Text("We'll review your request and email you a prepaid return label once approved.")
                .font(HBFont.body())
                .foregroundStyle(HBColors.mutedGray)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 8)
            HBPrimaryButton(title: "Done", isLoading: false) { dismiss() }
                .padding(.horizontal, 24)
            Spacer()
        }
        .padding(24)
        .hbScreenBackground()
        .navigationTitle("Return requested")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func submit() async {
        guard !reason.isEmpty else { return }
        isSaving = true
        error = nil
        defer { isSaving = false }
        do {
            let _: ReturnResponse = try await api.request(
                "/returns",
                method: "POST",
                jsonBody: [
                    "orderId": orderId,
                    "reason": reason,
                    "notes": notes.trimmingCharacters(in: .whitespacesAndNewlines),
                ]
            )
            HBFeedback.success()
            submitted = true
        } catch {
            self.error = error.localizedDescription
            HBFeedback.warning()
        }
    }
}

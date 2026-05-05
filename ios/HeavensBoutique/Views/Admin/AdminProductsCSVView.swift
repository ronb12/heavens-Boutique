import SwiftUI

struct AdminProductsCSVView: View {
    @EnvironmentObject private var api: APIClient
    @State private var csvText: String = ""
    @State private var isExporting = false
    @State private var isImporting = false
    @State private var message: String?
    @State private var error: String?

    var body: some View {
        VStack(spacing: 12) {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Export / Import CSV")
                        .font(HBFont.headline())
                        .foregroundStyle(HBColors.charcoal)

                    Text("Export gives one row per variant. Import matches products by URL handle (product link name) and variants by size.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)

                    TextEditor(text: $csvText)
                        .font(.system(.caption, design: .monospaced))
                        .frame(minHeight: 320)
                        .padding(12)
                        .background(HBColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    if let message {
                        Text(message).font(HBFont.caption()).foregroundStyle(HBColors.gold)
                    }
                    if let error {
                        Text(error).font(HBFont.caption()).foregroundStyle(HBColors.rosePink)
                    }
                }
                .padding()
            }

            HStack(spacing: 12) {
                HBPrimaryButton(title: "Export CSV", isLoading: isExporting) {
                    Task { await exportCsv() }
                }
                HBPrimaryButton(title: "Import CSV", isLoading: isImporting) {
                    Task { await importCsv() }
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 10)
        }
        .hbScreenBackground()
        .navigationTitle("Product CSV")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func exportCsv() async {
        isExporting = true
        message = nil
        error = nil
        defer { isExporting = false }
        do {
            let data = try await api.requestData("/admin/products-csv", method: "GET")
            csvText = String(data: data, encoding: .utf8) ?? ""
            HBFeedback.success()
            message = "Exported. Copy or edit, then import when ready."
        } catch {
            HBFeedback.warning()
            self.error = error.localizedDescription
        }
    }

    private func importCsv() async {
        isImporting = true
        message = nil
        error = nil
        defer { isImporting = false }
        let trimmed = csvText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { error = "Paste CSV first."; return }
        do {
            let r: AdminProductsCsvImportResponse = try await api.request(
                "/admin/products-csv",
                method: "POST",
                jsonBody: ["csv": trimmed]
            )
            HBFeedback.success()
            message = "Imported. Created \(r.createdProducts ?? 0), updated \(r.updatedProducts ?? 0), variants \(r.upsertedVariants ?? 0)."
        } catch {
            HBFeedback.warning()
            self.error = error.localizedDescription
        }
    }
}


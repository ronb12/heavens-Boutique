import SwiftUI

/// Three-step fulfillment timeline: Confirmed → Shipped → Delivered.
struct OrderTrackingStatusBar: View {
    let status: String
    /// Narrow row for order list; full layout for order detail.
    var compact: Bool = false

    private let labels = ["Confirmed", "Shipped", "Delivered"]

    private var terminal: TerminalKind? {
        switch status.lowercased() {
        case "cancelled": return .cancelled
        case "refunded": return .refunded
        default: return nil
        }
    }

    /// How many of the three steps are complete (0...3).
    private var filledSteps: Int {
        switch status.lowercased() {
        case "pending": return 0
        case "paid": return 1
        case "shipped": return 2
        case "delivered": return 3
        case "cancelled", "refunded": return 0
        default: return 0
        }
    }

    private enum TerminalKind {
        case cancelled
        case refunded

        var title: String {
            switch self {
            case .cancelled: return "Order cancelled"
            case .refunded: return "Order refunded"
            }
        }

        var subtitle: String {
            switch self {
            case .cancelled: return "This order is no longer active."
            case .refunded: return "Your refund has been processed."
            }
        }
    }

    var body: some View {
        if let t = terminal {
            VStack(alignment: .leading, spacing: 6) {
                Text(t.title)
                    .font(compact ? HBFont.caption().weight(.semibold) : HBFont.headline())
                    .foregroundStyle(HBColors.rosePink)
                Text(t.subtitle)
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            }
            .accessibilityElement(children: .combine)
        } else {
            if compact {
                compactBar
            } else {
                fullBar
            }
        }
    }

    private var fullBar: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 0) {
                ForEach(0 ..< labels.count, id: \.self) { i in
                    stepCircle(index: i)
                    if i < labels.count - 1 {
                        connector(from: i)
                    }
                }
            }
            HStack {
                ForEach(0 ..< labels.count, id: \.self) { i in
                    Text(labels[i])
                        .font(HBFont.caption())
                        .foregroundStyle(colorForLabel(at: i))
                        .frame(maxWidth: .infinity)
                }
            }
            if status.lowercased() == "pending" {
                Text("Awaiting payment confirmation")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilitySummary)
    }

    private var compactBar: some View {
        HStack(spacing: 6) {
            ForEach(0 ..< labels.count, id: \.self) { i in
                Circle()
                    .fill(fillColor(for: i))
                    .frame(width: 8, height: 8)
                    .overlay {
                        if i == filledSteps && filledSteps < labels.count && status.lowercased() != "pending" {
                            Circle()
                                .stroke(HBColors.gold, lineWidth: 1.5)
                                .frame(width: 12, height: 12)
                        }
                    }
                if i < labels.count - 1 {
                    Rectangle()
                        .fill(connectorColor(beforeStep: i + 1))
                        .frame(height: 2)
                        .frame(maxWidth: .infinity)
                }
            }
        }
        .accessibilityLabel(accessibilitySummary)
    }

    @ViewBuilder
    private func stepCircle(index i: Int) -> some View {
        let done = i < filledSteps
        let current = !done && i == filledSteps && filledSteps < labels.count

        ZStack {
            Circle()
                .fill(done ? HBColors.gold : HBColors.mutedGray.opacity(0.25))
                .frame(width: compact ? 10 : 22, height: compact ? 10 : 22)
            if done {
                Image(systemName: "checkmark")
                    .font(.system(size: compact ? 6 : 11, weight: .bold))
                    .foregroundStyle(HBColors.cream)
            } else if current {
                Circle()
                    .stroke(HBColors.gold, lineWidth: 2)
                    .frame(width: compact ? 12 : 26, height: compact ? 12 : 26)
            }
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func connector(from i: Int) -> some View {
        Rectangle()
            .fill(connectorColor(beforeStep: i + 1))
            .frame(height: 3)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, -4)
    }

    private func connectorColor(beforeStep stepIndex: Int) -> Color {
        stepIndex <= filledSteps ? HBColors.gold : HBColors.mutedGray.opacity(0.35)
    }

    private func fillColor(for i: Int) -> Color {
        if i < filledSteps { return HBColors.gold }
        if i == filledSteps, status.lowercased() == "pending" { return HBColors.mutedGray.opacity(0.35) }
        if i == filledSteps { return HBColors.mutedGray.opacity(0.35) }
        return HBColors.mutedGray.opacity(0.2)
    }

    private func colorForLabel(at i: Int) -> Color {
        if i < filledSteps { return HBColors.charcoal }
        if i == filledSteps { return HBColors.gold }
        return HBColors.mutedGray
    }

    private var accessibilitySummary: String {
        let s = status.replacingOccurrences(of: "_", with: " ")
        if let t = terminal { return "\(t.title). \(t.subtitle)" }
        return "Order progress: \(s). Step \(max(1, filledSteps)) of \(labels.count) on the way to delivered."
    }
}

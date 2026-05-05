import SwiftUI

/// Card data is not saved on the customer profile; shoppers pay through Stripe at checkout.
struct PaymentMethodsView: View {
    var body: some View {
        List {
            Section {
                Text(
                    "We do not keep your full card on file. When you check out, you add your payment details in Stripe’s secure flow. That keeps your card with Stripe, not in our app."
                )
                .font(HBFont.body())
                .foregroundStyle(HBColors.charcoal)
                .fixedSize(horizontal: false, vertical: true)
                .listRowBackground(HBColors.surface)
            }

            Section {
                Text("Each time you place an order or pay for a gift card, you’ll enter or confirm your payment in Stripe. We don’t use a “save card to my account” list.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
                    .listRowBackground(HBColors.surface)
            }
        }
        .navigationTitle("Secure payments")
        .navigationBarTitleDisplayMode(.inline)
        .scrollContentBackground(.hidden)
        .background(HBColors.cream.ignoresSafeArea())
    }
}

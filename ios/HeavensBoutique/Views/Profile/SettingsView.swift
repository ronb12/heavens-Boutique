import SwiftUI
import UIKit

struct SettingsView: View {
    @AppStorage(HBAppearancePreference.storageKey) private var appearanceRaw: String = HBAppearancePreference.system.rawValue

    var body: some View {
        List {
            Section {
                Picker("Appearance", selection: $appearanceRaw) {
                    ForEach(HBAppearancePreference.allCases) { mode in
                        Text(mode.title).tag(mode.rawValue)
                    }
                }
                .pickerStyle(.inline)
                .listRowBackground(HBColors.surface)
            } header: {
                Text("Appearance")
            } footer: {
                Text("Light and dark themes match the boutique palette. System follows your iPhone’s Display settings.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            }

            Section {
                Button {
                    if let url = URL(string: UIApplication.openNotificationSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                } label: {
                    Label("Notifications & alerts", systemImage: "bell.badge")
                        .foregroundStyle(HBColors.charcoal)
                }
                .listRowBackground(HBColors.surface)
            } footer: {
                Text("Manage push permissions, sounds, and badges in iOS Settings. Your in-app notification list is under the Notifications tab.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            }

            Section("Support") {
                if let phone = Config.supportPhoneURL {
                    Link(destination: phone) {
                        Label(Config.supportPhoneDisplay, systemImage: "phone")
                            .foregroundStyle(HBColors.charcoal)
                    }
                    .listRowBackground(HBColors.surface)
                }
                if let mail = Config.supportEmailURL {
                    Link(destination: mail) {
                        Label(Config.supportEmail, systemImage: "envelope")
                            .foregroundStyle(HBColors.charcoal)
                    }
                    .listRowBackground(HBColors.surface)
                }
                if let store = Config.appStoreListingURL {
                    Link(destination: store) {
                        Label("View on the App Store", systemImage: "bag")
                            .foregroundStyle(HBColors.charcoal)
                    }
                    .listRowBackground(HBColors.surface)
                }
            }

            Section("Legal") {
                if let terms = Config.termsOfServiceURL {
                    Link(destination: terms) {
                        Label("Terms of service", systemImage: "doc.text")
                            .foregroundStyle(HBColors.charcoal)
                    }
                    .listRowBackground(HBColors.surface)
                }
                if let privacy = Config.privacyPolicyURL {
                    Link(destination: privacy) {
                        Label("Privacy policy", systemImage: "hand.raised")
                            .foregroundStyle(HBColors.charcoal)
                    }
                    .listRowBackground(HBColors.surface)
                }
            }

            Section("About") {
                LabeledContent("Version", value: Config.appMarketingVersion)
                    .listRowBackground(HBColors.surface)
                LabeledContent("Build", value: Config.appBuildNumber)
                    .listRowBackground(HBColors.surface)
                VStack(alignment: .leading, spacing: 6) {
                    Text("Copyright © \(Calendar.current.component(.year, from: Date())) Heaven's Boutique. All rights reserved.")
                    Text("Built by Ronell Bradley.")
                    Text("Property of Bradley Virtual Solutions, LLC.")
                }
                .font(HBFont.caption())
                .foregroundStyle(HBColors.mutedGray)
                .listRowBackground(HBColors.surface)
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .scrollContentBackground(.hidden)
        .background(HBColors.cream.ignoresSafeArea())
    }
}

import SwiftUI
import UIKit

struct SettingsView: View {
    @EnvironmentObject private var session: SessionViewModel
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var appModel: AppModel
    @AppStorage(HBAppearancePreference.storageKey) private var appearanceRaw: String = HBAppearancePreference.system.rawValue
    @State private var showAdminHub = false

    var body: some View {
        List {
            if session.isLoggedIn {
                Section("Account") {
                    NavigationLink {
                        AccountDetailsView()
                    } label: {
                        Label("Account details", systemImage: "person.crop.circle")
                            .foregroundStyle(HBColors.charcoal)
                    }
                    .listRowBackground(HBColors.surface)

                    NavigationLink {
                        PaymentMethodsView()
                    } label: {
                        Label("Secure payments", systemImage: "lock.shield.fill")
                            .foregroundStyle(HBColors.charcoal)
                    }
                    .listRowBackground(HBColors.surface)
                }
            }

            if appModel.showAdminChrome {
                Section("Store admin") {
                    Button {
                        showAdminHub = true
                    } label: {
                        Label("Admin tools", systemImage: "gearshape.2")
                            .foregroundStyle(HBColors.charcoal)
                    }
                    .listRowBackground(HBColors.surface)
                }
            }

            if session.canOpenAdminPortal && appModel.customerViewPreview {
                Section {
                    Button {
                        appModel.exitCustomerViewPreview()
                        HBFeedback.light()
                    } label: {
                        Label("Exit customer view", systemImage: "arrow.uturn.backward.circle")
                            .foregroundStyle(HBColors.charcoal)
                    }
                    .listRowBackground(HBColors.surface)
                } header: {
                    Text("Customer view")
                } footer: {
                    Text("You’re previewing the app as a shopper. Admin controls are hidden until you exit.")
                        .font(HBFont.caption())
                        .foregroundStyle(HBColors.mutedGray)
                }
            }

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
                Text("After you sign in, the app may ask to send push alerts for orders and messages. You can change sounds, badges, and delivery in iOS Settings anytime. Your in-app notification list is under the Notifications tab.")
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

            Section("Store info") {
                NavigationLink {
                    ContentPageReaderView(slug: "about", navigationTitle: "About us")
                        .environmentObject(api)
                } label: {
                    Label("About us", systemImage: "heart.text.square")
                        .foregroundStyle(HBColors.charcoal)
                }
                .listRowBackground(HBColors.surface)

                NavigationLink {
                    ContentPageReaderView(slug: "shipping", navigationTitle: "Shipping")
                        .environmentObject(api)
                } label: {
                    Label("Shipping", systemImage: "shippingbox")
                        .foregroundStyle(HBColors.charcoal)
                }
                .listRowBackground(HBColors.surface)

                NavigationLink {
                    ContentPageReaderView(slug: "returns", navigationTitle: "Returns")
                        .environmentObject(api)
                } label: {
                    Label("Returns policy", systemImage: "arrow.uturn.left.circle")
                        .foregroundStyle(HBColors.charcoal)
                }
                .listRowBackground(HBColors.surface)
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

            Section {
                Text(SettingsView.aboutAppDescription)
                    .font(HBFont.body())
                    .foregroundStyle(HBColors.charcoal)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .listRowBackground(HBColors.surface)
            } header: {
                Text("About the app")
            } footer: {
                Text("Curated luxury with soft pink moments — shop, save, and stay in touch with Heaven’s Boutique.")
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            }

            Section {
                LabeledContent("Version", value: Config.appMarketingVersion)
                    .listRowBackground(HBColors.surface)
                LabeledContent("Build", value: Config.appBuildNumber)
                    .listRowBackground(HBColors.surface)
                LabeledContent("Built by", value: Config.builtByName)
                    .foregroundStyle(HBColors.charcoal)
                    .listRowBackground(HBColors.surface)
                LabeledContent("Product of", value: Config.productOfCompany)
                    .foregroundStyle(HBColors.charcoal)
                    .listRowBackground(HBColors.surface)
            } header: {
                Text("App information")
            } footer: {
                Text(Self.copyrightLine)
                    .font(HBFont.caption())
                    .foregroundStyle(HBColors.mutedGray)
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .scrollContentBackground(.hidden)
        .background(HBColors.cream.ignoresSafeArea())
        .sheet(isPresented: $showAdminHub) {
            AdminHubView()
                .environmentObject(api)
                .environmentObject(appModel)
        }
    }

    /// Matches `NSHumanReadableCopyright` in Info.plist; strips a stray comma after the year (e.g. `© 2026,`).
    private static var copyrightLine: String {
        let year = Calendar.current.component(.year, from: Date())
        let yearDigits = String(year)
        let base: String
        if let s = Bundle.main.object(forInfoDictionaryKey: "NSHumanReadableCopyright") as? String,
           !s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            base = s
        } else {
            base = "Copyright © \(yearDigits) Heaven's Boutique. All rights reserved."
        }
        return base
            .replacingOccurrences(of: "\(yearDigits),", with: yearDigits)
            .replacingOccurrences(of: "2026,", with: "2026")
            .replacingOccurrences(of: "2,026", with: "2026")
    }

    private static let aboutAppDescription = """
    Heaven’s Boutique brings the boutique to your iPhone: discover curated pieces, save favorites to your wishlist, and check out securely. Create an account to sync your bag, track orders with shipment updates, get notifications, and message our stylists for fit and styling help — or browse and use guest checkout when you prefer.
    """
}

// MARK: - CMS reader (`GET /pages?slug=`)

struct ContentPageReaderView: View {
    let slug: String
    let navigationTitle: String

    @EnvironmentObject private var api: APIClient
    @State private var page: ContentPageDTO?
    @State private var loadError: String?
    @State private var isLoading = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if isLoading && page == nil {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, 32)
                } else if let loadError {
                    Text(loadError)
                        .font(HBFont.body())
                        .foregroundStyle(HBColors.rosePink)
                } else if let page {
                    Text(page.title)
                        .font(HBFont.title(24))
                        .foregroundStyle(HBColors.charcoal)
                        .accessibilityAddTraits(.isHeader)

                    Text(page.body)
                        .font(HBFont.body())
                        .foregroundStyle(HBColors.charcoal)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(24)
        }
        .hbScreenBackground()
        .navigationTitle(navigationTitle)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        isLoading = true
        loadError = nil
        defer { isLoading = false }
        let encoded = slug.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? slug
        let path = "/pages?slug=\(encoded)"
        do {
            let r: ContentPageDetailResponse = try await api.request(path, method: "GET")
            page = r.page
        } catch {
            loadError = error.localizedDescription
        }
    }
}

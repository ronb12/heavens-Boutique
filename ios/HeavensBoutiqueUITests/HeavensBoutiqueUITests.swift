import XCTest

final class HeavensBoutiqueUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testLaunch_displaysWelcomeOrMainExperience() throws {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 8))

        let wordmark = app.staticTexts["Heaven's Boutique"]
        let boutique = app.staticTexts["Boutique"]
        let tabShop = app.tabBars.buttons["Shop"]

        XCTAssertTrue(
            wordmark.waitForExistence(timeout: 6)
                || boutique.waitForExistence(timeout: 6)
                || tabShop.waitForExistence(timeout: 2),
            "Expected either the guest welcome hero or the main tab bar after launch."
        )
    }

    func testWelcome_signInButtonExists() throws {
        let app = XCUIApplication()
        app.launch()

        let signIn = app.buttons["welcome_sign_in"]
        if signIn.waitForExistence(timeout: 4) {
            XCTAssertTrue(signIn.isHittable)
        }
    }

    func testBrowseGuest_opensMainTabs() throws {
        let app = XCUIApplication()
        app.launch()

        let browse = app.buttons["welcome_browse_guest"]
        guard browse.waitForExistence(timeout: 5) else {
            throw XCTSkip("Welcome screen not shown (already signed in or different state).")
        }
        browse.tap()
        XCTAssertTrue(app.tabBars.buttons["Shop"].waitForExistence(timeout: 5))
    }
}

// MARK: - App Store marketing screenshots (6.5" class: run on iPhone 15 Pro Max / 16 Plus / 11 Pro Max)

/// Run from Xcode (**Product → Test**) with a **6.5-inch display** simulator selected (e.g. *iPhone 15 Pro Max*),
/// or use `ios/scripts/capture-appstore-screenshots.sh`.
/// Attachments (**01_…** … **05_…**) appear in the Report navigator; right-click → **Save Attachment** to export PNGs for App Store Connect.
final class AppStoreScreenshotUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = true
    }

    func testCaptureAppStoreScreenshots_mainJourney() throws {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 12))

        // 1 — Welcome hero or already-signed-in main UI
        pauseForAnimation()
        attachPNG(name: "01_welcome_or_main", app: app)

        let browse = app.buttons["welcome_browse_guest"]
        if browse.waitForExistence(timeout: 4) {
            browse.tap()
            XCTAssertTrue(app.tabBars.buttons["Shop"].waitForExistence(timeout: 10))
            pauseForAnimation()
            attachPNG(name: "02_shop", app: app)
        } else if app.tabBars.buttons["Shop"].waitForExistence(timeout: 2) {
            app.tabBars.buttons["Shop"].tap()
            pauseForAnimation()
            attachPNG(name: "02_shop", app: app)
        }

        guard app.tabBars.buttons["Home"].waitForExistence(timeout: 3) else { return }
        app.tabBars.buttons["Home"].tap()
        pauseForAnimation()
        attachPNG(name: "03_home", app: app)

        guard app.tabBars.buttons["Profile"].waitForExistence(timeout: 3) else { return }
        app.tabBars.buttons["Profile"].tap()
        pauseForAnimation()
        attachPNG(name: "04_profile", app: app)

        guard app.tabBars.buttons["Orders"].waitForExistence(timeout: 3) else { return }
        app.tabBars.buttons["Orders"].tap()
        pauseForAnimation()
        attachPNG(name: "05_orders", app: app)
    }

    private func pauseForAnimation() {
        Thread.sleep(forTimeInterval: 0.65)
    }

    private func attachPNG(name: String, app: XCUIApplication) {
        let shot = app.screenshot()
        let attachment = XCTAttachment(screenshot: shot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}

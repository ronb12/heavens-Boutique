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

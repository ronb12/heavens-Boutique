import Foundation

/// ISO country and US-state pickers aligned with web `formOptions.ts`.
enum AddressRegionOptions {

    /// Curated ISO 3166-1 alpha-2 list (shipping).
    static let countries: [(code: String, name: String)] = [
        ("US", "United States"),
        ("CA", "Canada"),
        ("MX", "Mexico"),
        ("PR", "Puerto Rico"),
        ("GB", "United Kingdom"),
        ("IE", "Ireland"),
        ("FR", "France"),
        ("DE", "Germany"),
        ("IT", "Italy"),
        ("ES", "Spain"),
        ("AU", "Australia"),
        ("NZ", "New Zealand"),
        ("JP", "Japan"),
        ("KR", "South Korea"),
        ("CN", "China"),
    ]

    /// USPS-style subdivision codes including DC.
    static let usStates: [(code: String, name: String)] = [
        ("AL", "Alabama"), ("AK", "Alaska"), ("AZ", "Arizona"), ("AR", "Arkansas"),
        ("CA", "California"), ("CO", "Colorado"), ("CT", "Connecticut"), ("DE", "Delaware"),
        ("DC", "District of Columbia"), ("FL", "Florida"), ("GA", "Georgia"), ("HI", "Hawaii"),
        ("ID", "Idaho"), ("IL", "Illinois"), ("IN", "Indiana"), ("IA", "Iowa"),
        ("KS", "Kansas"), ("KY", "Kentucky"), ("LA", "Louisiana"), ("ME", "Maine"),
        ("MD", "Maryland"), ("MA", "Massachusetts"), ("MI", "Michigan"), ("MN", "Minnesota"),
        ("MS", "Mississippi"), ("MO", "Missouri"), ("MT", "Montana"), ("NE", "Nebraska"),
        ("NV", "Nevada"), ("NH", "New Hampshire"), ("NJ", "New Jersey"), ("NM", "New Mexico"),
        ("NY", "New York"), ("NC", "North Carolina"), ("ND", "North Dakota"), ("OH", "Ohio"),
        ("OK", "Oklahoma"), ("OR", "Oregon"), ("PA", "Pennsylvania"), ("RI", "Rhode Island"),
        ("SC", "South Carolina"), ("SD", "South Dakota"), ("TN", "Tennessee"), ("TX", "Texas"),
        ("UT", "Utah"), ("VT", "Vermont"), ("VA", "Virginia"), ("WA", "Washington"),
        ("WV", "West Virginia"), ("WI", "Wisconsin"), ("WY", "Wyoming"),
    ]

    /// Best-effort ISO2 for dropdown binding; mirrors web `coerceCountryCode`.
    static func normalizedCountryCode(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "US" }
        let upper = trimmed.uppercased()
        if upper.count == 2, upper.allSatisfy({ $0.isLetter }) {
            return upper
        }
        let aliases: [String: String] = [
            "usa": "US", "united states": "US", "united states of america": "US", "america": "US",
            "uk": "GB", "england": "GB",
        ]
        if let mapped = aliases[trimmed.lowercased()] {
            return mapped
        }
        return upper.count == 2 ? upper : "US"
    }

    /// Ensures picker shows a known tag; if saved code isn’t listed, prepend a synthetic row.
    static func countryChoices(forSelectedCode selected: String) -> [(code: String, name: String)] {
        let code = normalizedCountryCode(selected)
        let base = countries
        if base.contains(where: { $0.code == code }) {
            return base
        }
        return [(code, "\(code) (saved)")] + base
    }

    /// Two-letter US state when possible.
    static func coerceUsStateCode(_ raw: String?) -> String {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return ""
        }
        let upper = raw.uppercased()
        if usStates.contains(where: { $0.code == upper }) {
            return upper
        }
        if let match = usStates.first(where: { $0.name.caseInsensitiveCompare(raw) == .orderedSame }) {
            return match.code
        }
        return raw
    }
}

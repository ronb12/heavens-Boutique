import Foundation

enum HBURLCache {
    /// Larger defaults so product grids reuse images across sessions.
    static func configureSharedCache() {
        let memory = 64 * 1_024 * 1_024
        let disk = 256 * 1_024 * 1_024
        URLCache.shared = URLCache(memoryCapacity: memory, diskCapacity: disk, diskPath: "hb_image_cache")
    }
}

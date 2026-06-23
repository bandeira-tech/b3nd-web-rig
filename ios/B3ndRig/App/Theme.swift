import SwiftUI

/// A small palette so the native rig has a consistent identity without an
/// asset catalog dependency.
extension Color {
    /// Brand accent — a B3nd-ish indigo that reads in light and dark.
    static let b3ndAccent = Color(red: 0.36, green: 0.42, blue: 0.95)

    static func statusColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "healthy", "online", "connected": return .green
        case "degraded": return .orange
        default: return .red
        }
    }
}

/// Monospaced text style for URIs and payloads.
extension Font {
    static func b3ndMono(_ size: CGFloat = 13) -> Font {
        .system(size: size, weight: .regular, design: .monospaced)
    }
}

import Foundation

/// The renderer family a payload maps to. Mirrors the web display registry's
/// `DisplayKind`.
public enum DisplayKind: String, Sendable {
    case json, text, markdown, image, html, binary, unknown
}

/// A resolved display decision: which renderer to use plus the normalized
/// payload it should render.
public struct DisplayHint: Sendable {
    public let kind: DisplayKind
    public let contentType: String?
    public let fileExtension: String?
    /// The payload normalized for the chosen renderer.
    public let payload: Payload

    public enum Payload: Sendable {
        case json(JSONValue)
        case text(String)
        /// A `data:` URL or remote URL string for an image.
        case imageURLString(String)
        case binary(Data)
        case none
    }
}

/// Derives a `DisplayHint` from a URI + payload, port of `display/hint.ts`.
///
/// Precedence: URI extension → data-URL sniff → JSON-in-string →
/// markdown heuristic → object/array → text fallback.
public enum DisplayHinter {
    private static let extensionKind: [String: (DisplayKind, String)] = [
        "json": (.json, "application/json"),
        "txt": (.text, "text/plain"),
        "log": (.text, "text/plain"),
        "md": (.markdown, "text/markdown"),
        "markdown": (.markdown, "text/markdown"),
        "html": (.html, "text/html"),
        "htm": (.html, "text/html"),
        "png": (.image, "image/png"),
        "jpg": (.image, "image/jpeg"),
        "jpeg": (.image, "image/jpeg"),
        "gif": (.image, "image/gif"),
        "webp": (.image, "image/webp"),
        "svg": (.image, "image/svg+xml"),
    ]

    public static func derive(uri: String?, data: JSONValue) -> DisplayHint {
        let ext = extensionOf(uri: uri)
        let extHit = ext.flatMap { extensionKind[$0] }

        switch data {
        case .string(let s):
            return deriveFromString(s, ext: ext, extHit: extHit)
        case .object:
            return DisplayHint(kind: .json, contentType: "application/json", fileExtension: ext, payload: .json(data))
        case .array:
            return DisplayHint(kind: .json, contentType: "application/json", fileExtension: ext, payload: .json(data))
        case .null:
            return DisplayHint(kind: .unknown, contentType: nil, fileExtension: ext, payload: .none)
        case .bool, .number:
            return DisplayHint(kind: .json, contentType: nil, fileExtension: ext, payload: .json(data))
        }
    }

    private static func deriveFromString(
        _ s: String, ext: String?, extHit: (DisplayKind, String)?
    ) -> DisplayHint {
        // data:image/... → image
        if s.hasPrefix("data:image/") {
            let contentType = s.dropFirst(5).prefix(while: { $0 != ";" })
            return DisplayHint(kind: .image, contentType: String(contentType), fileExtension: ext, payload: .imageURLString(s))
        }
        if let hit = extHit, hit.0 == .image {
            return DisplayHint(kind: .image, contentType: hit.1, fileExtension: ext, payload: .imageURLString(s))
        }
        // JSON-in-string, before extension-based decisions.
        if let parsed = tryParseJSON(s), extHit?.0 == .json || extHit == nil {
            return DisplayHint(kind: .json, contentType: extHit?.1 ?? "application/json", fileExtension: ext, payload: .json(parsed))
        }
        if let hit = extHit, hit.0 == .html {
            return DisplayHint(kind: .html, contentType: hit.1, fileExtension: ext, payload: .text(s))
        }
        if extHit?.0 == .markdown || looksLikeMarkdown(s) {
            return DisplayHint(kind: .markdown, contentType: extHit?.1 ?? "text/markdown", fileExtension: ext, payload: .text(s))
        }
        if let hit = extHit, hit.0 == .text {
            return DisplayHint(kind: .text, contentType: hit.1, fileExtension: ext, payload: .text(s))
        }
        return DisplayHint(kind: .text, contentType: "text/plain", fileExtension: ext, payload: .text(s))
    }

    // MARK: - helpers

    static func extensionOf(uri: String?) -> String? {
        guard let uri else { return nil }
        let cleaned = uri.split(whereSeparator: { $0 == "?" || $0 == "#" }).first.map(String.init) ?? uri
        let trimmed = cleaned.hasSuffix("/") ? String(cleaned.dropLast()) : cleaned
        guard let last = trimmed.split(separator: "/").last, last.contains(".") else { return nil }
        let ext = last.split(separator: ".").last.map { $0.lowercased() }
        return (ext?.isEmpty == false) ? ext : nil
    }

    /// Parse a string as JSON if it cheaply looks like JSON. Exposed because
    /// the Write surface uses it to decide JSON-vs-text encoding.
    public static func tryParseJSON(_ value: String) -> JSONValue? {
        let trimmed = value.drop(while: { $0 == " " || $0 == "\n" || $0 == "\t" || $0 == "\r" })
        guard let first = trimmed.first else { return nil }
        let looksJSON = first == "{" || first == "[" || first == "\""
            || first == "-" || first.isNumber
            || trimmed.hasPrefix("true") || trimmed.hasPrefix("false") || trimmed.hasPrefix("null")
        guard looksJSON, let data = String(trimmed).data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(JSONValue.self, from: data)
    }

    static func looksLikeMarkdown(_ value: String) -> Bool {
        if value.contains("```") { return true }
        for line in value.split(separator: "\n", omittingEmptySubsequences: false) {
            let t = line.drop(while: { $0 == " " })
            if t.hasPrefix("# ") || t.hasPrefix("## ") || t.hasPrefix("### ")
                || t.hasPrefix("- ") || t.hasPrefix("* ") {
                return true
            }
        }
        return false
    }
}

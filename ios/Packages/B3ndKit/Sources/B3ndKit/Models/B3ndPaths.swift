import Foundation

/// Translation between explorer UI paths and B3nd URIs.
///
/// Port of the path helpers in `web-rig`'s `HttpAdapter`:
///   `/mutable/open/notes/today` ⇄ `mutable://open/notes/today`
///
/// A path is `/<protocol>/<domain>/<...subpath>`. The first segment is the
/// behavior-named scheme (`mutable`, `immutable`, `signed`, …), the second is
/// the domain/authority, and the rest is the record path.
public enum B3ndPaths {
    public enum PathError: Error, Equatable { case rootHasNoURI }

    /// `/mutable/open/notes` → `mutable://open/notes`
    public static func pathToURI(_ path: String) throws -> String {
        let parts = path.split(separator: "/").map(String.init).filter { !$0.isEmpty }
        guard !parts.isEmpty else { throw PathError.rootHasNoURI }
        if parts.count == 1 { return "\(parts[0])://" }
        let scheme = parts[0]
        let domain = parts[1]
        let subpath = parts.count > 2 ? "/" + parts[2...].joined(separator: "/") : ""
        return "\(scheme)://\(domain)\(subpath)"
    }

    /// `mutable://open/notes` → `/mutable/open/notes`
    public static func uriToPath(_ uri: String) -> String {
        guard let parsed = parse(uri) else { return uri }
        let base = "/\(parsed.scheme)/\(parsed.host)"
        return parsed.path.isEmpty || parsed.path == "/" ? base : base + parsed.path
    }

    /// Display tail of a URI — the last path segment, or the host.
    public static func name(forURI uri: String) -> String {
        guard let parsed = parse(uri) else { return uri }
        let segments = parsed.path.split(separator: "/").map(String.init).filter { !$0.isEmpty }
        if let last = segments.last { return last }
        return parsed.host.isEmpty ? "unnamed" : parsed.host
    }

    /// The `scheme://host` prefix used to seed root navigation, matching the
    /// shape `Rig.status().schema` reports.
    public static func schemaPrefix(forURI uri: String) -> String? {
        guard let parsed = parse(uri) else { return nil }
        return "\(parsed.scheme)://\(parsed.host)"
    }

    /// `scheme://host` → `/scheme/host` root node path.
    public static func rootPath(forPrefix prefix: String) -> String? {
        guard let parsed = parse(prefix) else { return nil }
        return "/\(parsed.scheme)/\(parsed.host)"
    }

    // MARK: - Minimal scheme-agnostic URI parse

    struct Parsed { let scheme: String; let host: String; let path: String }

    /// `Foundation.URL`/`URLComponents` reject custom schemes inconsistently,
    /// so we parse `scheme://host/path` by hand. Hostname is the authority up
    /// to the first `/`; everything after is the path.
    static func parse(_ uri: String) -> Parsed? {
        guard let schemeRange = uri.range(of: "://") else { return nil }
        let scheme = String(uri[uri.startIndex..<schemeRange.lowerBound])
        guard !scheme.isEmpty else { return nil }
        let rest = String(uri[schemeRange.upperBound...])
        if let slash = rest.firstIndex(of: "/") {
            let host = String(rest[rest.startIndex..<slash])
            let path = String(rest[slash...])
            return Parsed(scheme: scheme, host: host, path: path)
        }
        return Parsed(scheme: scheme, host: rest, path: "")
    }
}

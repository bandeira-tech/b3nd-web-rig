import Foundation

/// Result of `GET /api/v1/status`. The rig reports its health plus
/// host-defined metadata (`node`, `backend`, `image`, …).
public struct StatusResult: Codable, Equatable, Sendable {
    public let status: String
    public let schema: [String]?
    public let fns: [String]?
    public let node: String?
    public let image: String?
    public let backend: String?

    public init(
        status: String,
        schema: [String]? = nil,
        fns: [String]? = nil,
        node: String? = nil,
        image: String? = nil,
        backend: String? = nil
    ) {
        self.status = status
        self.schema = schema
        self.fns = fns
        self.node = node
        self.image = image
        self.backend = backend
    }

    public var isHealthy: Bool { status == "healthy" }
}

/// One `Output` from a `read`: a URI paired with its payload. A miss is a
/// `.null` payload (the bytes-entity convention).
public struct B3ndOutput: Equatable, Sendable {
    public let uri: String
    public let payload: JSONValue

    public init(uri: String, payload: JSONValue) {
        self.uri = uri
        self.payload = payload
    }

    public var isMiss: Bool { payload.isNull }
}

/// Result of one `receive` (write).
public struct ReceiveResult: Codable, Equatable, Sendable {
    public let accepted: Bool
    public let error: String?

    public init(accepted: Bool, error: String? = nil) {
        self.accepted = accepted
        self.error = error
    }
}

/// A node in the explorer tree. `path` is the canonical identifier
/// (`/mutable/open/notes`); `name` is the display tail.
public struct NavNode: Identifiable, Hashable, Sendable {
    public enum Kind: String, Sendable { case directory, file }

    public let path: String
    public let name: String
    public let kind: Kind

    public var id: String { path }

    public init(path: String, name: String, kind: Kind) {
        self.path = path
        self.name = name
        self.kind = kind
    }

    public var isDirectory: Bool { kind == .directory }
}

/// A configured B3nd backend the rig can point at.
public struct BackendConfig: Identifiable, Hashable, Sendable {
    public let id: String
    public var name: String
    public var baseURL: URL
    /// User-added (vs. shipped in the bundled instances list).
    public var isUserAdded: Bool

    public init(id: String, name: String, baseURL: URL, isUserAdded: Bool = false) {
        self.id = id
        self.name = name
        self.baseURL = baseURL
        self.isUserAdded = isUserAdded
    }
}

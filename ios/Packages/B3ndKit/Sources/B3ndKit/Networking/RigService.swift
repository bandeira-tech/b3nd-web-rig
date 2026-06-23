import Foundation

#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// High-level explorer operations on top of `B3ndClient`, mirroring the
/// web-rig's `HttpAdapter`: list a directory, read a record, and derive the
/// schema-driven root nodes.
public struct RigService {
    public let client: B3ndClient

    public init(client: B3ndClient) {
        self.client = client
    }

    public init(baseURL: URL, session: URLSession = .shared) {
        self.client = B3ndClient(baseURL: baseURL, session: session)
    }

    /// Root nodes are virtual: one per `scheme://host` prefix the node reports
    /// in `status().schema`, plus any prefixes harvested from writes.
    public func rootNodes(extraPrefixes: [String] = []) async throws -> [NavNode] {
        let status = try await client.status()
        var prefixes = status.schema ?? []
        prefixes.append(contentsOf: extraPrefixes)

        var seen = Set<String>()
        var nodes: [NavNode] = []
        for uri in prefixes {
            guard let prefix = B3ndPaths.schemaPrefix(forURI: uri),
                  let path = B3ndPaths.rootPath(forPrefix: prefix),
                  !seen.contains(path) else { continue }
            seen.insert(path)
            nodes.append(NavNode(path: path, name: prefix, kind: .directory))
        }
        return nodes
    }

    /// List the children of a directory path. The node returns an `Output[]`
    /// listing payload: `[[childUri, childPayload], …]` (or bare `string[]`).
    public func listPath(_ path: String) async throws -> [NavNode] {
        var listURI = try B3ndPaths.pathToURI(path)
        if !listURI.hasSuffix("://") && !listURI.hasSuffix("/") {
            listURI += "/"
        }
        guard let output = try await client.readOne(listURI) else { return [] }
        guard let entries = output.payload.arrayValue else { return [] }

        var nodes: [NavNode] = []
        for entry in entries {
            let uri: String
            switch entry {
            case .string(let s):
                uri = s
            case .array(let pair):
                guard let first = pair.first?.stringValue else { continue }
                uri = first
            default:
                continue
            }
            guard !uri.isEmpty else { continue }
            let kind: NavNode.Kind = uri.hasSuffix("/") ? .directory : .file
            nodes.append(NavNode(path: B3ndPaths.uriToPath(uri), name: B3ndPaths.name(forURI: uri), kind: kind))
        }
        return nodes
    }

    /// Read a single record's payload.
    public func readRecord(_ path: String) async throws -> JSONValue {
        let uri = try B3ndPaths.pathToURI(path)
        guard let output = try await client.readOne(uri), !output.isMiss else {
            throw B3ndClientError.http(status: 404, body: "Record not found: \(path)")
        }
        return output.payload
    }
}

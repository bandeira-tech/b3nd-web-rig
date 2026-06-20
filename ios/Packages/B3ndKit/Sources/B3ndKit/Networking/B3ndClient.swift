import Foundation

#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// Errors surfaced by the HTTP client.
public enum B3ndClientError: Error, LocalizedError {
    case badResponse
    case http(status: Int, body: String)
    case decoding(String)

    public var errorDescription: String? {
        switch self {
        case .badResponse: return "Malformed response from node."
        case .http(let status, let body): return "HTTP \(status): \(body)"
        case .decoding(let detail): return "Could not decode response: \(detail)"
        }
    }
}

/// A client for a single B3nd node speaking the `b3nd-move` HTTP transport.
///
/// Wire protocol (see `b3nd-move/src/http/README.md`):
///   - `GET  /api/v1/status`            → `StatusResult`
///   - `POST /api/v1/read?u=<b64>`      → `[[uri, payload], …]`, body-less
///   - `POST /api/v1/receive?u=<b64>`   → `[{accepted, error?}]`, framed body
///
/// `?u=` is the url-safe-base64 URL list (`UrlList`); the `receive` body is
/// the `BytesList` (lenSize 4) of opaque payload bytes, 1:1 with the URIs.
public struct B3ndClient {
    public let baseURL: URL
    private let session: URLSession

    public init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    // MARK: - status

    public func status() async throws -> StatusResult {
        var request = URLRequest(url: endpoint("status"))
        request.httpMethod = "GET"
        let (data, response) = try await session.data(for: request)
        try Self.ensureOK(response, data)
        do {
            return try JSONDecoder().decode(StatusResult.self, from: data)
        } catch {
            throw B3ndClientError.decoding(String(describing: error))
        }
    }

    public func healthCheck() async -> Bool {
        (try? await status())?.isHealthy ?? false
    }

    // MARK: - read

    /// Read a batch of locators. Returns `Output`s 1:1 with `urls`, in order.
    public func read(_ urls: [String]) async throws -> [B3ndOutput] {
        let u = try UrlList.encode(urls)
        var request = URLRequest(url: endpoint("read", query: [URLQueryItem(name: "u", value: u)]))
        request.httpMethod = "POST"
        let (data, response) = try await session.data(for: request)
        try Self.ensureOK(response, data)

        // Response is `[[uri, payload], …]`. Decode as nested JSONValue and
        // map each pair into a typed `B3ndOutput`.
        let raw: [[JSONValue]]
        do {
            raw = try JSONDecoder().decode([[JSONValue]].self, from: data)
        } catch {
            throw B3ndClientError.decoding(String(describing: error))
        }
        return raw.compactMap { tuple in
            guard let uri = tuple.first?.stringValue else { return nil }
            let payload = tuple.count > 1 ? tuple[1] : .null
            return B3ndOutput(uri: uri, payload: payload)
        }
    }

    /// Convenience: read a single locator.
    public func readOne(_ url: String) async throws -> B3ndOutput? {
        try await read([url]).first
    }

    // MARK: - receive (write)

    /// Write a batch of `(uri, payload)` outputs. Results are 1:1 with inputs.
    public func receive(_ outputs: [(uri: String, payload: Data)]) async throws -> [ReceiveResult] {
        let u = try UrlList.encode(outputs.map { $0.uri })
        let body = BytesList.encode(outputs.map { $0.payload }, lenSize: 4)

        var request = URLRequest(url: endpoint("receive", query: [URLQueryItem(name: "u", value: u)]))
        request.httpMethod = "POST"
        request.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        let (data, response) = try await session.data(for: request)
        try Self.ensureOK(response, data)
        do {
            return try JSONDecoder().decode([ReceiveResult].self, from: data)
        } catch {
            throw B3ndClientError.decoding(String(describing: error))
        }
    }

    /// Convenience: write a single JSON-encodable value to a URI.
    @discardableResult
    public func write(uri: String, json value: JSONValue) async throws -> ReceiveResult {
        let bytes = try JSONEncoder().encode(value)
        let results = try await receive([(uri: uri, payload: bytes)])
        return results.first ?? ReceiveResult(accepted: false, error: "No result")
    }

    /// Convenience: write raw bytes to a URI.
    @discardableResult
    public func write(uri: String, bytes: Data) async throws -> ReceiveResult {
        let results = try await receive([(uri: uri, payload: bytes)])
        return results.first ?? ReceiveResult(accepted: false, error: "No result")
    }

    // MARK: - helpers

    private func endpoint(_ path: String, query: [URLQueryItem] = []) -> URL {
        let full = baseURL.appendingPathComponent("api/v1/\(path)")
        guard !query.isEmpty,
              var comps = URLComponents(url: full, resolvingAgainstBaseURL: false)
        else { return full }
        comps.queryItems = query
        return comps.url ?? full
    }

    private static func ensureOK(_ response: URLResponse, _ data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw B3ndClientError.badResponse }
        guard (200..<300).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw B3ndClientError.http(status: http.statusCode, body: body)
        }
    }
}

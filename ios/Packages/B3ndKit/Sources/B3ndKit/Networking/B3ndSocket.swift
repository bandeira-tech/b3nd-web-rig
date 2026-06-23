import Foundation

#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public enum B3ndSocketError: Error, LocalizedError {
    case notConnected
    case timeout
    case requestFailed(String)

    public var errorDescription: String? {
        switch self {
        case .notConnected: return "WebSocket is not connected."
        case .timeout: return "WebSocket request timed out."
        case .requestFailed(let m): return m
        }
    }
}

/// WebSocket transport for a single B3nd node — the live half of the rig.
///
/// Faithful to `b3nd-move/src/ws/client.ts`: one persistent socket, JSON frames
/// keyed by `id`. We implement the two things the app needs over WS:
///   - `status()` — a liveness probe (also tells us whether the node even runs
///     the `ws` service; many nodes only expose the HTTP API).
///   - `observe(_:)` — server-pushed batches of URIs that changed, as an
///     `AsyncStream<[String]>`.
///
/// Reads/writes still go over `B3ndClient` (HTTP); the socket is observe-first.
/// On disconnect, active observe streams finish (matching the upstream client),
/// and the next `observe`/`status` call transparently reconnects — callers wrap
/// consumption in a retry loop.
public actor B3ndSocket {
    public let url: URL
    private let session: URLSession
    private let timeout: TimeInterval

    private var task: URLSessionWebSocketTask?
    private var isOpen = false

    private var pending: [String: CheckedContinuation<WsResponse, Error>] = [:]
    private var observers: [String: AsyncStream<[String]>.Continuation] = [:]

    public init(baseURL: URL, session: URLSession = .shared, timeout: TimeInterval = 15) {
        self.url = Self.webSocketURL(from: baseURL)
        self.session = session
        self.timeout = timeout
    }

    /// Derive `wss://host[:port]/api/v1/ws` from an `http(s)://host` base URL,
    /// matching the web rig's `httpToWsUrl`.
    public static func webSocketURL(from baseURL: URL) -> URL {
        guard var comps = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else { return baseURL }
        comps.scheme = (comps.scheme == "https") ? "wss" : "ws"
        var path = comps.path
        if path.hasSuffix("/") { path.removeLast() }
        comps.path = path + "/api/v1/ws"
        return comps.url ?? baseURL
    }

    // MARK: - public API

    /// Liveness probe. Throws if the node has no `ws` service or is unreachable.
    public func status() async throws -> StatusResult {
        let response = try await request(type: .status, payload: .object([:]))
        guard response.success, let status = response.data?.decoded(as: StatusResult.self) else {
            throw B3ndSocketError.requestFailed(response.error ?? "status failed")
        }
        return status
    }

    /// Subscribe to changes matching `patterns` (e.g. `["mutable://host/**"]`).
    /// Each emitted value is a batch of URIs that fired. The stream finishes on
    /// disconnect or when the consumer stops iterating.
    public nonisolated func observe(_ patterns: [String]) -> AsyncStream<[String]> {
        AsyncStream { continuation in
            let id = UUID().uuidString
            continuation.onTermination = { @Sendable _ in
                Task { await self.endObserve(id) }
            }
            Task { await self.startObserve(id: id, patterns: patterns, continuation: continuation) }
        }
    }

    /// Tear down the socket and fail anything in flight.
    public func close() {
        teardown(reason: nil)
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        isOpen = false
    }

    // MARK: - observe internals

    private func startObserve(
        id: String,
        patterns: [String],
        continuation: AsyncStream<[String]>.Continuation
    ) async {
        guard !patterns.isEmpty else { continuation.finish(); return }
        do {
            try await ensureConnected()
        } catch {
            continuation.finish()
            return
        }
        observers[id] = continuation
        do {
            let frame = try WsFrame.encodeRequest(id: id, type: .observe, payload: WsFrame.observePayload(urls: patterns))
            try await task?.send(.data(frame))
        } catch {
            observers[id] = nil
            continuation.finish()
        }
    }

    private func endObserve(_ id: String) async {
        guard observers.removeValue(forKey: id) != nil else { return }
        guard let task else { return }
        // Best-effort cancel frame (reuses the observe id).
        if let frame = try? WsFrame.encodeRequest(id: id, type: .observeCancel, payload: .object([:])) {
            try? await task.send(.data(frame))
        }
    }

    // MARK: - request/response

    private func request(type: WsRequestType, payload: JSONValue) async throws -> WsResponse {
        try await ensureConnected()
        let id = UUID().uuidString
        let frame = try WsFrame.encodeRequest(id: id, type: type, payload: payload)
        let socketTask = task
        return try await withCheckedThrowingContinuation { (cont: CheckedContinuation<WsResponse, Error>) in
            pending[id] = cont
            Task {
                do {
                    try await socketTask?.send(.data(frame))
                } catch {
                    await self.failPending(id, error: error)
                    return
                }
                await self.scheduleTimeout(id)
            }
        }
    }

    private func failPending(_ id: String, error: Error) {
        pending.removeValue(forKey: id)?.resume(throwing: error)
    }

    private func scheduleTimeout(_ id: String) async {
        try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
        pending.removeValue(forKey: id)?.resume(throwing: B3ndSocketError.timeout)
    }

    // MARK: - connection lifecycle

    private func ensureConnected() async throws {
        if isOpen, task != nil { return }
        let socketTask = session.webSocketTask(with: url)
        task = socketTask
        isOpen = true
        socketTask.resume()
        startReceiveLoop(socketTask)
    }

    private func startReceiveLoop(_ socketTask: URLSessionWebSocketTask) {
        Task {
            while true {
                do {
                    let message = try await socketTask.receive()
                    await self.handle(message)
                } catch {
                    await self.handleDisconnect(error)
                    return
                }
            }
        }
    }

    private func handle(_ message: URLSessionWebSocketTask.Message) {
        let text: String
        switch message {
        case .string(let s): text = s
        case .data(let d): text = String(data: d, encoding: .utf8) ?? ""
        @unknown default: return
        }
        guard let response = WsFrame.parse(text) else { return }

        if let observer = observers[response.id] {
            switch response.observeSignal {
            case .end:
                observers.removeValue(forKey: response.id)
                observer.finish()
            case .batch(let uris):
                if !uris.isEmpty { observer.yield(uris) }
            }
            return
        }

        pending.removeValue(forKey: response.id)?.resume(returning: response)
    }

    private func handleDisconnect(_ error: Error) {
        teardown(reason: error)
        task = nil
        isOpen = false
    }

    /// Fail pending requests and finish observe streams.
    private func teardown(reason: Error?) {
        let err = reason ?? B3ndSocketError.notConnected
        for cont in pending.values { cont.resume(throwing: err) }
        pending.removeAll()
        for observer in observers.values { observer.finish() }
        observers.removeAll()
    }
}

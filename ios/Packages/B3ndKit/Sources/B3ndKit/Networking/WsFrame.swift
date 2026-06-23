import Foundation

/// The request frame types on the B3nd WebSocket transport.
/// Mirrors `b3nd-move/src/ws/client.ts`'s `WebSocketRequest["type"]`.
public enum WsRequestType: String, Sendable {
    case receive
    case read
    case observe
    case observeCancel = "observe-cancel"
    case status
}

/// A parsed inbound WebSocket frame: `{ id, success, data?, error? }`.
public struct WsResponse: Equatable, Sendable {
    public let id: String
    public let success: Bool
    /// `.some(.null)` when the server sent an explicit `data: null`
    /// (observe end-of-stream); `.none` when the `data` key was absent.
    public let data: JSONValue?
    public let error: String?

    public init(id: String, success: Bool, data: JSONValue?, error: String?) {
        self.id = id
        self.success = success
        self.data = data
        self.error = error
    }

    /// What an observe frame means for its subscription.
    public enum ObserveSignal: Equatable, Sendable {
        case batch([String])   // URIs that fired
        case end                // end-of-stream or error → tear down
    }

    /// Interpret this frame as an observe event.
    public var observeSignal: ObserveSignal {
        if !success { return .end }
        if data == .some(.null) || data == nil { return .end }
        return .batch(data?.stringArray ?? [])
    }
}

/// Pure encode/parse for the WebSocket JSON frame protocol. Kept transport-free
/// so it can be unit-tested without a live socket.
public enum WsFrame {
    /// Encode an outbound request envelope `{ id, type, payload }`.
    public static func encodeRequest(id: String, type: WsRequestType, payload: JSONValue) throws -> Data {
        let envelope: JSONValue = .object([
            "id": .string(id),
            "type": .string(type.rawValue),
            "payload": payload,
        ])
        return try JSONEncoder().encode(envelope)
    }

    /// The `observe` payload: `{ urls: [...] }`.
    public static func observePayload(urls: [String]) -> JSONValue {
        .object(["urls": .array(urls.map(JSONValue.string))])
    }

    /// Parse an inbound text frame into a `WsResponse`, or nil if malformed.
    public static func parse(_ text: String) -> WsResponse? {
        guard let data = text.data(using: .utf8),
              let value = try? JSONDecoder().decode(JSONValue.self, from: data),
              case .object(let obj) = value,
              case .string(let id)? = obj["id"] else { return nil }

        let success: Bool = {
            if case .bool(let b)? = obj["success"] { return b }
            return false
        }()
        let error: String? = {
            if case .string(let e)? = obj["error"] { return e }
            return nil
        }()
        // `obj["data"]` is `.some(.null)` for explicit null, `.none` if absent.
        return WsResponse(id: id, success: success, data: obj["data"], error: error)
    }
}

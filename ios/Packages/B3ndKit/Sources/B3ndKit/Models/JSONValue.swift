import Foundation

/// A fully-typed, `Codable` representation of an arbitrary JSON value.
///
/// B3nd read payloads are opaque past the URI — they come back as whatever
/// JSON the producing app encoded. `JSONValue` lets us decode that without a
/// fixed schema and then drive the display layer off the concrete shape.
public indirect enum JSONValue: Codable, Equatable, Hashable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let b = try? container.decode(Bool.self) {
            self = .bool(b)
        } else if let n = try? container.decode(Double.self) {
            self = .number(n)
        } else if let s = try? container.decode(String.self) {
            self = .string(s)
        } else if let a = try? container.decode([JSONValue].self) {
            self = .array(a)
        } else if let o = try? container.decode([String: JSONValue].self) {
            self = .object(o)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container, debugDescription: "Unsupported JSON value")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .bool(let b): try container.encode(b)
        case .number(let n): try container.encode(n)
        case .string(let s): try container.encode(s)
        case .array(let a): try container.encode(a)
        case .object(let o): try container.encode(o)
        }
    }

    /// True when this is `.null` — the bytes-entity "miss" convention.
    public var isNull: Bool { if case .null = self { return true } else { return false } }

    /// String payload when the value is a JSON string, else nil.
    public var stringValue: String? { if case .string(let s) = self { return s } else { return nil } }

    /// Array payload when the value is a JSON array, else nil.
    public var arrayValue: [JSONValue]? { if case .array(let a) = self { return a } else { return nil } }

    /// The value as `[String]` when it is an array of JSON strings (e.g. an
    /// observe batch of URIs), else nil.
    public var stringArray: [String]? {
        guard case .array(let a) = self else { return nil }
        return a.compactMap(\.stringValue)
    }

    /// Re-decode this value into a concrete `Decodable` type by round-tripping
    /// through JSON. Used to lift a WS `data` frame into `StatusResult`, etc.
    public func decoded<T: Decodable>(as type: T.Type) -> T? {
        guard let data = try? JSONEncoder().encode(self) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    /// Pretty-printed JSON for display.
    public func prettyPrinted() -> String {
        let data = try? JSONEncoder.pretty.encode(self)
        return data.flatMap { String(data: $0, encoding: .utf8) } ?? "null"
    }
}

extension JSONEncoder {
    static let pretty: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return e
    }()
}

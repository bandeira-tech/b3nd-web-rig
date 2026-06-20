import Foundation

/// Errors thrown while encoding/decoding a URL list.
public enum UrlListError: Error, Equatable {
    case empty
    case invalidBase64
    case invalidUTF8
}

/// URL-list framer — packs a list of URL-shaped strings into a single
/// url-safe, unpadded base64 string for the `?u=` query slot on the batch
/// HTTP routes (`read`, `receive`, `observe`).
///
/// Port of `b3nd-move/src/codecs/url-list.ts`:
///
///     buf  = BytesList.encode(UTF8(url) for each url, lenSize: 2)
///     wire = url-safe base64 of `buf`, unpadded
public enum UrlList {
    /// Encode a non-empty list of URLs into the wire string.
    public static func encode(_ urls: [String]) throws -> String {
        guard !urls.isEmpty else { throw UrlListError.empty }
        let slots = urls.map { Data($0.utf8) }
        let buf = BytesList.encode(slots, lenSize: 2)
        return toUrlSafeBase64(buf)
    }

    /// Decode a wire string back into the URL array.
    public static func decode(_ param: String) throws -> [String] {
        let buf = try fromUrlSafeBase64(param)
        let slots = try BytesList.decode(buf, lenSize: 2)
        guard !slots.isEmpty else { throw UrlListError.empty }
        return try slots.map { slot in
            guard let s = String(data: slot, encoding: .utf8) else { throw UrlListError.invalidUTF8 }
            return s
        }
    }

    static func toUrlSafeBase64(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func fromUrlSafeBase64(_ s: String) throws -> Data {
        var std = s
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let remainder = std.count % 4
        if remainder != 0 { std += String(repeating: "=", count: 4 - remainder) }
        guard let data = Data(base64Encoded: std) else { throw UrlListError.invalidBase64 }
        return data
    }
}

import Foundation

/// Errors thrown while decoding a length-prefixed bytes-list buffer.
public enum BytesListError: Error, Equatable {
    case truncatedPrefix
    case truncatedBody
    case slotTooLarge(max: Int, length: Int)
    case tooManySlots(max: Int)
}

/// Bytes-list framer — the shared codec behind both the `?u=` URL list
/// (`lenSize: 2`) and the `receive` request body (`lenSize: 4`).
///
///     buf = <lenSize prefix, big-endian><slot bytes> × N
///
/// This is a faithful port of `b3nd-move/src/codecs/bytes-list.ts`. The two
/// `lenSize` settings are the same algorithm at different ceilings:
///   - `2` (u16) — single slot ≤ 64 KiB (short URLs in a query string)
///   - `4` (u32) — single slot ≤ 4 GiB (payload bytes in an HTTP body)
public enum BytesList {
    static func maxFor(_ lenSize: Int) -> Int { lenSize == 2 ? 0xFFFF : 0xFFFF_FFFF }

    /// Encode a list of byte slots into a single framed buffer.
    public static func encode(_ slots: [Data], lenSize: Int = 2) -> Data {
        var out = Data()
        for slot in slots {
            let n = slot.count
            if lenSize == 2 {
                out.append(UInt8((n >> 8) & 0xFF))
                out.append(UInt8(n & 0xFF))
            } else {
                out.append(UInt8((n >> 24) & 0xFF))
                out.append(UInt8((n >> 16) & 0xFF))
                out.append(UInt8((n >> 8) & 0xFF))
                out.append(UInt8(n & 0xFF))
            }
            out.append(slot)
        }
        return out
    }

    /// Decode a framed buffer back into its slots. Mirrors the TS decoder's
    /// truncation / count checks so malformed input fails the same way.
    public static func decode(_ data: Data, lenSize: Int = 2, maxCount: Int = 1024) throws -> [Data] {
        let bytes = [UInt8](data)
        var out: [Data] = []
        var off = 0
        let max = maxFor(lenSize)
        while off < bytes.count {
            guard off + lenSize <= bytes.count else { throw BytesListError.truncatedPrefix }
            var len = 0
            for i in 0..<lenSize { len = (len << 8) | Int(bytes[off + i]) }
            off += lenSize
            if len > max { throw BytesListError.slotTooLarge(max: max, length: len) }
            guard off + len <= bytes.count else { throw BytesListError.truncatedBody }
            out.append(Data(bytes[off..<(off + len)]))
            off += len
            if out.count > maxCount { throw BytesListError.tooManySlots(max: maxCount) }
        }
        return out
    }
}

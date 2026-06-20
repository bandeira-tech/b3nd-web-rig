import XCTest
@testable import B3ndKit

final class CodecTests: XCTestCase {
    func testBytesListRoundTrip() throws {
        let slots = [Data("mutable://open/".utf8), Data([0x00, 0x01, 0xFF])]
        let encoded = BytesList.encode(slots, lenSize: 2)
        let decoded = try BytesList.decode(encoded, lenSize: 2)
        XCTAssertEqual(decoded, slots)
    }

    func testBytesListLenSize4() throws {
        let slots = [Data(repeating: 0xAB, count: 70_000)]
        let encoded = BytesList.encode(slots, lenSize: 4)
        // First 4 bytes encode the length big-endian.
        XCTAssertEqual([UInt8](encoded.prefix(4)), [0x00, 0x01, 0x11, 0x70])
        let decoded = try BytesList.decode(encoded, lenSize: 4)
        XCTAssertEqual(decoded, slots)
    }

    func testBytesListTruncatedBody() {
        // Claims 23330 bytes but supplies none — the exact failure the live
        // backend reported for an un-framed payload.
        let buf = Data([0x5b, 0x22])
        XCTAssertThrowsError(try BytesList.decode(buf, lenSize: 2)) { error in
            XCTAssertEqual(error as? BytesListError, .truncatedBody)
        }
    }

    func testUrlListMatchesKnownWireValue() throws {
        // `mutable://open/` framed at lenSize 2 then url-safe base64, unpadded.
        let wire = try UrlList.encode(["mutable://open/"])
        let decoded = try UrlList.decode(wire)
        XCTAssertEqual(decoded, ["mutable://open/"])
        // No padding, url-safe alphabet only.
        XCTAssertFalse(wire.contains("="))
        XCTAssertFalse(wire.contains("+"))
        XCTAssertFalse(wire.contains("/"))
    }

    func testUrlListEmptyThrows() {
        XCTAssertThrowsError(try UrlList.encode([]))
    }

    func testUrlListMultiple() throws {
        let urls = ["mutable://open/a", "immutable://rig/b"]
        XCTAssertEqual(try UrlList.decode(try UrlList.encode(urls)), urls)
    }
}

final class PathTests: XCTestCase {
    func testPathToURI() throws {
        XCTAssertEqual(try B3ndPaths.pathToURI("/mutable/open/notes/today"), "mutable://open/notes/today")
        XCTAssertEqual(try B3ndPaths.pathToURI("/mutable/open"), "mutable://open")
        XCTAssertEqual(try B3ndPaths.pathToURI("/mutable"), "mutable://")
    }

    func testRootHasNoURI() {
        XCTAssertThrowsError(try B3ndPaths.pathToURI("/"))
    }

    func testURIToPath() {
        XCTAssertEqual(B3ndPaths.uriToPath("mutable://open/notes/today"), "/mutable/open/notes/today")
        XCTAssertEqual(B3ndPaths.uriToPath("mutable://open/"), "/mutable/open")
    }

    func testName() {
        XCTAssertEqual(B3ndPaths.name(forURI: "mutable://open/notes/today"), "today")
        XCTAssertEqual(B3ndPaths.name(forURI: "mutable://open/"), "open")
    }

    func testSchemaPrefix() {
        XCTAssertEqual(B3ndPaths.schemaPrefix(forURI: "mutable://open/notes"), "mutable://open")
        XCTAssertEqual(B3ndPaths.rootPath(forPrefix: "mutable://open"), "/mutable/open")
    }
}

final class DisplayHintTests: XCTestCase {
    func testObjectIsJSON() {
        let hint = DisplayHinter.derive(uri: "mutable://open/x", data: .object(["a": .number(1)]))
        XCTAssertEqual(hint.kind, .json)
    }

    func testJSONInString() {
        let hint = DisplayHinter.derive(uri: nil, data: .string("{\"a\":1}"))
        XCTAssertEqual(hint.kind, .json)
    }

    func testMarkdownHeuristic() {
        let hint = DisplayHinter.derive(uri: "mutable://open/readme", data: .string("# Title\n\nbody"))
        XCTAssertEqual(hint.kind, .markdown)
    }

    func testMarkdownByExtension() {
        let hint = DisplayHinter.derive(uri: "mutable://open/notes/today.md", data: .string("plain"))
        XCTAssertEqual(hint.kind, .markdown)
    }

    func testDataImage() {
        let hint = DisplayHinter.derive(uri: nil, data: .string("data:image/png;base64,AAAA"))
        XCTAssertEqual(hint.kind, .image)
    }

    func testPlainText() {
        let hint = DisplayHinter.derive(uri: "mutable://open/note", data: .string("just text"))
        XCTAssertEqual(hint.kind, .text)
    }
}

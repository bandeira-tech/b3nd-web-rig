// swift-tools-version: 5.9
import PackageDescription

// B3ndKit — the portable core of the native iOS rig.
//
// It contains the B3nd HTTP wire protocol (status / read / receive), the
// domain models, path<->URI mapping, and content display-hint logic. It has
// no UIKit/SwiftUI dependency, so it compiles and unit-tests on any platform
// (`swift build` / `swift test`), including Linux CI.
let package = Package(
    name: "B3ndKit",
    platforms: [
        .iOS(.v16),
        .macOS(.v13),
    ],
    products: [
        .library(name: "B3ndKit", targets: ["B3ndKit"]),
    ],
    targets: [
        .target(name: "B3ndKit"),
        .testTarget(name: "B3ndKitTests", dependencies: ["B3ndKit"]),
    ]
)

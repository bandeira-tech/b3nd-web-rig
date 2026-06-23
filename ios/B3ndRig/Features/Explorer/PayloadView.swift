import SwiftUI
import B3ndKit

/// Renders a record payload using the resolved `DisplayHint`, the SwiftUI
/// analogue of the web display registry's strategies (json / text / markdown /
/// image / binary / unknown).
struct PayloadView: View {
    let uri: String
    let payload: JSONValue

    private var hint: DisplayHint { DisplayHinter.derive(uri: uri, data: payload) }

    var body: some View {
        switch hint.payload {
        case .json(let value):
            JSONPayload(value: value)
        case .text(let text):
            if hint.kind == .markdown {
                MarkdownPayload(text: text)
            } else {
                TextPayload(text: text)
            }
        case .imageURLString(let urlString):
            ImagePayload(urlString: urlString)
        case .binary(let data):
            BinaryPayload(byteCount: data.count)
        case .none:
            EmptyStateView(icon: "doc", title: "Empty record", message: "This URI has no payload.")
        }
    }
}

private struct JSONPayload: View {
    let value: JSONValue
    var body: some View {
        ScrollView([.vertical, .horizontal]) {
            Text(value.prettyPrinted())
                .font(.b3ndMono())
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
        }
    }
}

private struct TextPayload: View {
    let text: String
    var body: some View {
        ScrollView {
            Text(text)
                .font(.b3ndMono())
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
        }
    }
}

private struct MarkdownPayload: View {
    let text: String
    var body: some View {
        ScrollView {
            // SwiftUI's `Text` supports inline Markdown; for block content we
            // render line-by-line so headings/lists keep their breaks.
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(text.split(separator: "\n", omittingEmptySubsequences: false).enumerated()), id: \.offset) { _, line in
                    Text((try? AttributedString(markdown: String(line))) ?? AttributedString(String(line)))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .textSelection(.enabled)
            .padding()
        }
    }
}

private struct ImagePayload: View {
    let urlString: String
    var body: some View {
        ScrollView {
            if let image = Self.decodeDataURL(urlString) {
                image
                    .resizable()
                    .scaledToFit()
                    .padding()
            } else if let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image): image.resizable().scaledToFit()
                    case .failure: EmptyStateView(icon: "photo", title: "Could not load image")
                    default: ProgressView()
                    }
                }
                .padding()
            } else {
                EmptyStateView(icon: "photo", title: "Unrecognized image payload")
            }
        }
    }

    /// Decode a `data:image/...;base64,...` URL into an `Image`.
    static func decodeDataURL(_ s: String) -> Image? {
        guard s.hasPrefix("data:"),
              let comma = s.firstIndex(of: ","),
              s[s.startIndex..<comma].contains(";base64") else { return nil }
        let b64 = String(s[s.index(after: comma)...])
        guard let data = Data(base64Encoded: b64) else { return nil }
        #if canImport(UIKit)
        if let uiImage = UIImage(data: data) { return Image(uiImage: uiImage) }
        #endif
        return nil
    }
}

private struct BinaryPayload: View {
    let byteCount: Int
    var body: some View {
        EmptyStateView(
            icon: "doc.zipper",
            title: "Binary payload",
            message: "\(byteCount) bytes — no text or image preview available."
        )
    }
}

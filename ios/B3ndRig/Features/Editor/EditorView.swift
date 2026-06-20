import SwiftUI
import B3ndKit

/// The Write surface — the rig-level write path. Resolve a URI (with an
/// optional `{account}` placeholder), POST the payload via `receive`, and show
/// the result. Native counterpart of the web rig's text editor section.
struct EditorView: View {
    @EnvironmentObject private var store: AppStore

    @State private var uriTemplate: String = "mutable://{account}/notes/hello"
    @State private var payloadText: String = "{\n  \"msg\": \"hello from the iOS rig\"\n}"
    @State private var isWriting = false
    @State private var outputs: [WriteOutput] = []

    var body: some View {
        NavigationStack {
            Form {
                Section("URI") {
                    TextField("scheme://host/path", text: $uriTemplate, axis: .vertical)
                        .font(.b3ndMono())
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    if uriTemplate.contains("{account}") {
                        Text("Resolves to: \(resolvedURI)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                    }
                }

                Section("Payload") {
                    TextEditor(text: $payloadText)
                        .font(.b3ndMono())
                        .frame(minHeight: 140)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    Text(payloadIsJSON ? "Sent as JSON." : "Sent as a UTF-8 string.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section {
                    Button {
                        Task { await write() }
                    } label: {
                        HStack {
                            if isWriting { ProgressView().padding(.trailing, 4) }
                            Text("Write to node")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isWriting || resolvedURI.isEmpty)
                }

                if !outputs.isEmpty {
                    Section("Recent writes") {
                        ForEach(outputs) { output in
                            WriteOutputRow(output: output)
                        }
                    }
                }
            }
            .navigationTitle("Write")
        }
    }

    // MARK: - resolution

    private var resolvedURI: String {
        let account = store.activeAccount?.pubkey ?? "shared"
        return uriTemplate.replacingOccurrences(of: "{account}", with: account)
    }

    private var payloadIsJSON: Bool {
        DisplayHinter.tryParseJSON(payloadText) != nil
    }

    private func write() async {
        guard let rig = store.rig else { return }
        isWriting = true
        defer { isWriting = false }

        let uri = resolvedURI
        let result: ReceiveResult
        do {
            if let json = DisplayHinter.tryParseJSON(payloadText) {
                result = try await rig.client.write(uri: uri, json: json)
            } else {
                result = try await rig.client.write(uri: uri, bytes: Data(payloadText.utf8))
            }
        } catch {
            let message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            outputs.insert(WriteOutput(uri: uri, accepted: false, error: message), at: 0)
            return
        }

        if result.accepted { store.recordWrittenPrefix(forURI: uri) }
        outputs.insert(WriteOutput(uri: uri, accepted: result.accepted, error: result.error), at: 0)
        if outputs.count > 30 { outputs.removeLast(outputs.count - 30) }
    }
}

struct WriteOutput: Identifiable {
    let id = UUID()
    let uri: String
    let accepted: Bool
    let error: String?
    let timestamp = Date()
}

private struct WriteOutputRow: View {
    let output: WriteOutput
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Image(systemName: output.accepted ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .foregroundStyle(output.accepted ? .green : .red)
                Text(output.accepted ? "Accepted" : "Rejected").font(.subheadline.weight(.medium))
                Spacer()
                Text(output.timestamp, style: .time).font(.caption).foregroundStyle(.secondary)
            }
            Text(output.uri).font(.b3ndMono(12)).lineLimit(1).truncationMode(.middle).foregroundStyle(.secondary)
            if let error = output.error {
                Text(error).font(.caption).foregroundStyle(.red)
            }
        }
    }
}

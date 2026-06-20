import SwiftUI
import B3ndKit

/// The Explorer — schema-driven navigation of the active node's data, the
/// native counterpart of the web rig's filesystem explorer.
struct ExplorerView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        NavigationStack {
            DirectoryView(path: "/", title: store.activeBackend?.name ?? "Explorer")
                .navigationDestination(for: NavNode.self) { node in
                    if node.isDirectory {
                        DirectoryView(path: node.path, title: node.name)
                    } else {
                        RecordView(path: node.path, title: node.name)
                    }
                }
        }
    }
}

/// Lists the children of a path. The root (`/`) is special-cased to the
/// schema-derived prefixes; deeper paths list through the rig.
private struct DirectoryView: View {
    @EnvironmentObject private var store: AppStore
    let path: String
    let title: String

    @State private var nodes: [NavNode] = []
    @State private var phase: LoadPhase = .idle

    var body: some View {
        Group {
            switch phase {
            case .idle, .loading:
                ProgressView("Loading…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .failed(let message):
                EmptyStateView(
                    icon: "exclamationmark.triangle",
                    title: "Couldn't load",
                    message: message,
                    actionTitle: "Retry"
                ) { Task { await load() } }
            case .loaded where nodes.isEmpty:
                EmptyStateView(
                    icon: isRoot ? "tray" : "folder",
                    title: isRoot ? "Nothing here yet" : "Empty directory",
                    message: isRoot
                        ? "This node reports no data prefixes. Write a record in the Write tab to see it appear here."
                        : "No records under this path."
                )
            case .loaded:
                List(nodes) { node in
                    NavigationLink(value: node) {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(node.name).lineLimit(1)
                                if isRoot {
                                    Text(node.path).font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        } icon: {
                            Image(systemName: node.isDirectory ? "folder.fill" : "doc.text")
                                .foregroundStyle(node.isDirectory ? Color.b3ndAccent : .secondary)
                        }
                    }
                }
                .listStyle(.plain)
                .refreshable { await load() }
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(isRoot ? .large : .inline)
        .task(id: store.activeBackendID) { await load() }
    }

    private var isRoot: Bool { path == "/" }

    private func load() async {
        guard let rig = store.rig else {
            phase = .failed("No active backend.")
            return
        }
        phase = .loading
        do {
            if isRoot {
                nodes = try await rig.rootNodes(extraPrefixes: store.extraRootPrefixes())
            } else {
                nodes = try await rig.listPath(path)
            }
            phase = .loaded
        } catch {
            phase = .failed((error as? LocalizedError)?.errorDescription ?? error.localizedDescription)
        }
    }
}

/// Reads and renders a single record.
private struct RecordView: View {
    @EnvironmentObject private var store: AppStore
    let path: String
    let title: String

    @State private var payload: JSONValue?
    @State private var phase: LoadPhase = .idle

    var body: some View {
        Group {
            switch phase {
            case .idle, .loading:
                ProgressView("Reading…").frame(maxWidth: .infinity, maxHeight: .infinity)
            case .failed(let message):
                EmptyStateView(icon: "doc.questionmark", title: "Couldn't read record", message: message, actionTitle: "Retry") {
                    Task { await load() }
                }
            case .loaded:
                if let payload {
                    VStack(spacing: 0) {
                        uriBar
                        Divider()
                        PayloadView(uri: (try? B3ndPaths.pathToURI(path)) ?? path, payload: payload)
                    }
                }
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: path) { await load() }
    }

    private var uriBar: some View {
        HStack {
            Image(systemName: "link").foregroundStyle(.secondary)
            Text((try? B3ndPaths.pathToURI(path)) ?? path)
                .font(.b3ndMono(12))
                .lineLimit(1)
                .truncationMode(.middle)
                .textSelection(.enabled)
            Spacer()
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.thinMaterial)
    }

    private func load() async {
        guard let rig = store.rig else {
            phase = .failed("No active backend.")
            return
        }
        phase = .loading
        do {
            payload = try await rig.readRecord(path)
            phase = .loaded
        } catch {
            phase = .failed((error as? LocalizedError)?.errorDescription ?? error.localizedDescription)
        }
    }
}

/// Simple async-load state machine shared by the explorer screens.
enum LoadPhase: Equatable {
    case idle
    case loading
    case loaded
    case failed(String)
}

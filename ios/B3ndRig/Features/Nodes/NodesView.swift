import SwiftUI
import B3ndKit

/// The Nodes dashboard — live health and capabilities of the active node,
/// from `GET /api/v1/status`. The native counterpart of the web rig's Nodes
/// network overview, scoped to the connected node for the foundation.
struct NodesView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        NavigationStack {
            List {
                if let backend = store.activeBackend {
                    Section("Connected node") {
                        DetailRow(label: "Name", value: backend.name)
                        DetailRow(label: "Base URL", value: backend.baseURL.absoluteString, mono: true)
                    }
                }

                if store.isLoadingStatus {
                    Section { HStack { ProgressView(); Text("Checking health…").foregroundStyle(.secondary) } }
                } else if let status = store.status {
                    statusSection(status)
                } else if let error = store.statusError {
                    Section {
                        EmptyStateView(icon: "wifi.exclamationmark", title: "Node unreachable", message: error)
                            .listRowInsets(EdgeInsets())
                    }
                }
            }
            .navigationTitle("Nodes")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { Task { await store.refreshStatus() } } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .refreshable { await store.refreshStatus() }
        }
    }

    @ViewBuilder
    private func statusSection(_ status: StatusResult) -> some View {
        Section("Health") {
            HStack {
                Text("Status")
                Spacer()
                StatusPill(status.status)
            }
            if let node = status.node { DetailRow(label: "Node", value: node, mono: true) }
            if let backend = status.backend { DetailRow(label: "Backend", value: backend) }
            if let image = status.image { DetailRow(label: "Image", value: image, mono: true) }
        }

        if let fns = status.fns, !fns.isEmpty {
            Section("Capabilities") {
                FlowChips(items: fns)
            }
        }

        Section("Schema prefixes") {
            if let schema = status.schema, !schema.isEmpty {
                ForEach(schema, id: \.self) { uri in
                    Text(uri).font(.b3ndMono(12)).textSelection(.enabled)
                }
            } else {
                Text("No prefixes reported. Lazy stores list a prefix only after it's been written.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

/// A simple wrapping row of capability chips.
private struct FlowChips: View {
    let items: [String]
    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack { chips }
            VStack(alignment: .leading, spacing: 6) { chips }
        }
    }

    private var chips: some View {
        ForEach(items, id: \.self) { item in
            Text(item)
                .font(.caption.weight(.medium))
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Color.b3ndAccent.opacity(0.12), in: Capsule())
                .foregroundStyle(Color.b3ndAccent)
        }
    }
}

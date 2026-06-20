import SwiftUI

/// Apps — the mountable-app surface. In the web rig, apps are themselves
/// stored on B3nd with a display slot and a basepath-scoped rig slot. This is
/// the foundation scaffold: it frames the concept and lists the built-ins the
/// native rig will mount next.
struct AppsView: View {
    @EnvironmentObject private var store: AppStore

    private let builtins: [BuiltinApp] = [
        .init(slug: "notes", name: "Notes", icon: "note.text", blurb: "Markdown notepad", template: "mutable://{account}/notes"),
        .init(slug: "bookmarks", name: "Bookmarks", icon: "bookmark", blurb: "One JSON record per URL", template: "mutable://{account}/bookmarks"),
        .init(slug: "files", name: "Files", icon: "folder", blurb: "Drop any bytes under a basepath", template: "mutable://{account}/files"),
        .init(slug: "inbox", name: "Inbox", icon: "tray.and.arrow.down", blurb: "Timestamped JSON log, newest first", template: "mutable://{account}/inbox"),
    ]

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Mountable apps")
                            .font(.headline)
                        Text("Apps store their data on B3nd under a basepath you choose. Pick an identity and the app follows it.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        HStack(spacing: 6) {
                            Image(systemName: "person.crop.circle")
                            if let account = store.activeAccount {
                                Text("Active: \(account.emoji) \(account.name)")
                            } else {
                                Text("No account — using shared")
                            }
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }

                Section("Built-in apps") {
                    ForEach(builtins) { app in
                        HStack(spacing: 12) {
                            Image(systemName: app.icon)
                                .font(.title2)
                                .foregroundStyle(Color.b3ndAccent)
                                .frame(width: 32)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(app.name)
                                Text(app.blurb).font(.caption).foregroundStyle(.secondary)
                                Text(app.resolved(account: store.activeAccount?.pubkey))
                                    .font(.b3ndMono(11)).foregroundStyle(.tertiary)
                            }
                            Spacer()
                            Text("Soon").font(.caption2).foregroundStyle(.secondary)
                                .padding(.horizontal, 8).padding(.vertical, 3)
                                .background(.quaternary, in: Capsule())
                        }
                    }
                }
            }
            .navigationTitle("Apps")
        }
    }
}

private struct BuiltinApp: Identifiable {
    let slug: String
    let name: String
    let icon: String
    let blurb: String
    let template: String
    var id: String { slug }

    func resolved(account: String?) -> String {
        let value = account.map { String($0.prefix(8)) + "…" } ?? "shared"
        return template.replacingOccurrences(of: "{account}", with: value)
    }
}

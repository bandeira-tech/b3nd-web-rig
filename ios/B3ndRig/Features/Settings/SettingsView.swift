import SwiftUI
import B3ndKit

/// Settings — backend selection / management, theme, and an entry point to
/// Accounts. Native counterpart of the web rig's settings panel.
struct SettingsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var showingAddBackend = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Active node") {
                    Picker("Backend", selection: backendSelection) {
                        ForEach(store.backends) { backend in
                            Text(backend.name).tag(backend.id)
                        }
                    }
                }

                Section("Backends") {
                    ForEach(store.backends) { backend in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(backend.name)
                            Text(backend.baseURL.absoluteString)
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .onDelete { offsets in
                        for index in offsets {
                            let backend = store.backends[index]
                            if backend.isUserAdded { store.removeBackend(backend.id) }
                        }
                    }
                    Button {
                        showingAddBackend = true
                    } label: {
                        Label("Add backend", systemImage: "plus")
                    }
                }

                Section("Appearance") {
                    Picker("Theme", selection: $store.theme) {
                        ForEach(ThemeMode.allCases) { theme in
                            Text(theme.label).tag(theme)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section("Identity") {
                    NavigationLink {
                        AccountsView()
                    } label: {
                        HStack {
                            Label("Accounts", systemImage: "person.crop.circle")
                            Spacer()
                            if let account = store.activeAccount {
                                Text("\(account.emoji) \(account.name)").foregroundStyle(.secondary)
                            } else {
                                Text("None").foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                Section {
                    LabeledContent("App", value: "B3nd Rig (iOS foundation)")
                    LabeledContent("Kit", value: "B3ndKit · HTTP transport")
                }
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $showingAddBackend) {
                AddBackendSheet { name, url in store.addBackend(name: name, baseURL: url) }
            }
        }
    }

    private var backendSelection: Binding<String> {
        Binding(
            get: { store.activeBackendID ?? "" },
            set: { store.setActiveBackend($0) }
        )
    }
}

/// Sheet for adding a custom backend by URL.
private struct AddBackendSheet: View {
    @Environment(\.dismiss) private var dismiss
    let onAdd: (String, URL) -> Void

    @State private var name = ""
    @State private var urlString = "https://"

    private var parsedURL: URL? {
        guard let url = URL(string: urlString.trimmingCharacters(in: .whitespaces)),
              url.scheme == "http" || url.scheme == "https",
              url.host != nil else { return nil }
        return url
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("My node", text: $name)
                }
                Section("Base URL") {
                    TextField("https://node.example.com", text: $urlString)
                        .keyboardType(.URL)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .font(.b3ndMono())
                }
            }
            .navigationTitle("Add backend")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        guard let url = parsedURL else { return }
                        let trimmed = name.trimmingCharacters(in: .whitespaces)
                        onAdd(trimmed.isEmpty ? (url.host ?? "Node") : trimmed, url)
                        dismiss()
                    }
                    .disabled(parsedURL == nil)
                }
            }
        }
    }
}

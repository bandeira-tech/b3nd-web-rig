import SwiftUI

/// Accounts — local Ed25519 identities. The foundation generates real
/// keypairs and tracks the active account (used to resolve `{account}` in the
/// Write tab). Signed-envelope writes are a follow-up; see README.
struct AccountsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var showingNew = false

    var body: some View {
        List {
            if store.accounts.isEmpty {
                EmptyStateView(
                    icon: "person.crop.circle.badge.plus",
                    title: "No accounts yet",
                    message: "Create a local identity. Apps and writes can scope their data to it.",
                    actionTitle: "New account"
                ) { showingNew = true }
                .listRowInsets(EdgeInsets())
            } else {
                Section {
                    ForEach(store.accounts) { account in
                        Button {
                            store.setActiveAccount(account.id)
                        } label: {
                            HStack {
                                Text(account.emoji).font(.title2)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(account.name).foregroundStyle(.primary)
                                    Text(account.shortPubkey)
                                        .font(.b3ndMono(11)).foregroundStyle(.secondary)
                                }
                                Spacer()
                                if account.id == store.activeAccountID {
                                    Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.b3ndAccent)
                                }
                            }
                        }
                    }
                    .onDelete { offsets in
                        for index in offsets { store.removeAccount(store.accounts[index].id) }
                    }
                } footer: {
                    Text("Keys are stored on-device. This foundation keeps them in app storage — move to the Keychain before shipping.")
                }
            }
        }
        .navigationTitle("Accounts")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showingNew = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showingNew) {
            NewAccountSheet { name, emoji in store.addAccount(name: name, emoji: emoji) }
        }
    }
}

private struct NewAccountSheet: View {
    @Environment(\.dismiss) private var dismiss
    let onCreate: (String, String) -> Void

    @State private var name = ""
    @State private var emoji = "🦊"
    private let emojiChoices = ["🦊", "🐙", "🦉", "🐝", "🦋", "🌱", "⭐️", "🔮", "🚀", "🎩"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("Alice", text: $name)
                }
                Section("Emoji") {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(emojiChoices, id: \.self) { choice in
                                Text(choice)
                                    .font(.title)
                                    .padding(8)
                                    .background(emoji == choice ? Color.b3ndAccent.opacity(0.2) : .clear, in: Circle())
                                    .onTapGesture { emoji = choice }
                            }
                        }
                    }
                }
            }
            .navigationTitle("New account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        let trimmed = name.trimmingCharacters(in: .whitespaces)
                        onCreate(trimmed.isEmpty ? "Account" : trimmed, emoji)
                        dismiss()
                    }
                }
            }
        }
    }
}

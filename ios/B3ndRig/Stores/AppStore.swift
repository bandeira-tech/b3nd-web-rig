import Foundation
import SwiftUI
import B3ndKit

/// App-wide theme preference, mirroring the web rig's `ThemeMode`.
enum ThemeMode: String, CaseIterable, Identifiable {
    case system, light, dark
    var id: String { rawValue }
    var label: String { rawValue.capitalized }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }
}

/// The single source of truth for the app — backends, the active rig, theme,
/// and the locally-managed accounts. The SwiftUI analogue of the web rig's
/// zustand `appStore`, scoped to a foundation feature set.
@MainActor
final class AppStore: ObservableObject {
    // Backends / rig
    @Published private(set) var backends: [BackendConfig] = []
    @Published var activeBackendID: String?
    @Published private(set) var status: StatusResult?
    @Published private(set) var statusError: String?
    @Published private(set) var isLoadingStatus = false

    // UI
    @Published var theme: ThemeMode = .system {
        didSet { Persistence.theme = theme }
    }

    // Identity (foundation: local Ed25519 accounts, no signed envelopes yet)
    @Published private(set) var accounts: [ManagedAccount] = []
    @Published var activeAccountID: String?

    /// Prefixes harvested from accepted writes, per backend — seeds root nav
    /// for lazy stores that don't list a prefix until it's been written.
    private var writtenPrefixes: [String: [String]] = [:]

    var activeBackend: BackendConfig? {
        backends.first { $0.id == activeBackendID }
    }

    /// The rig service for the active backend, if any.
    var rig: RigService? {
        activeBackend.map { RigService(baseURL: $0.baseURL) }
    }

    var activeAccount: ManagedAccount? {
        accounts.first { $0.id == activeAccountID }
    }

    // MARK: - lifecycle

    func bootstrap() {
        theme = Persistence.theme
        loadBackends()
        accounts = Persistence.accounts
        activeAccountID = Persistence.activeAccountID ?? accounts.first?.id
        Task { await refreshStatus() }
    }

    private func loadBackends() {
        let config = InstancesConfig.loadBundled()
        let (defaultBackends, defaultID) = config.backendConfigs()
        let userBackends = Persistence.userBackends
        backends = defaultBackends + userBackends

        let savedID = Persistence.activeBackendID
        if let savedID, backends.contains(where: { $0.id == savedID }) {
            activeBackendID = savedID
        } else {
            activeBackendID = defaultID ?? backends.first?.id
        }
    }

    // MARK: - backends

    func setActiveBackend(_ id: String) {
        guard backends.contains(where: { $0.id == id }) else { return }
        activeBackendID = id
        Persistence.activeBackendID = id
        status = nil
        statusError = nil
        Task { await refreshStatus() }
    }

    @discardableResult
    func addBackend(name: String, baseURL: URL) -> BackendConfig {
        let config = BackendConfig(id: UUID().uuidString, name: name, baseURL: baseURL, isUserAdded: true)
        backends.append(config)
        persistUserBackends()
        return config
    }

    func removeBackend(_ id: String) {
        backends.removeAll { $0.id == id && $0.isUserAdded }
        persistUserBackends()
        if activeBackendID == id { activeBackendID = backends.first?.id }
    }

    private func persistUserBackends() {
        Persistence.userBackends = backends.filter { $0.isUserAdded }
    }

    // MARK: - status

    func refreshStatus() async {
        guard let rig else { return }
        isLoadingStatus = true
        statusError = nil
        defer { isLoadingStatus = false }
        do {
            status = try await rig.client.status()
        } catch {
            status = nil
            statusError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    // MARK: - written-prefix tracking

    func recordWrittenPrefix(forURI uri: String) {
        guard let backendID = activeBackendID,
              let prefix = B3ndPaths.schemaPrefix(forURI: uri) else { return }
        var list = writtenPrefixes[backendID] ?? []
        guard !list.contains(prefix) else { return }
        list.append(prefix)
        writtenPrefixes[backendID] = list
    }

    func extraRootPrefixes() -> [String] {
        guard let backendID = activeBackendID else { return [] }
        return writtenPrefixes[backendID] ?? []
    }

    // MARK: - accounts

    func addAccount(name: String, emoji: String) {
        let account = ManagedAccount.generate(name: name, emoji: emoji)
        accounts.insert(account, at: 0)
        activeAccountID = account.id
        persistAccounts()
    }

    func removeAccount(_ id: String) {
        accounts.removeAll { $0.id == id }
        if activeAccountID == id { activeAccountID = accounts.first?.id }
        persistAccounts()
    }

    func setActiveAccount(_ id: String?) {
        activeAccountID = id
        Persistence.activeAccountID = id
    }

    private func persistAccounts() {
        Persistence.accounts = accounts
        Persistence.activeAccountID = activeAccountID
    }
}

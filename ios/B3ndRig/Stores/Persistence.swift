import Foundation
import B3ndKit

/// Thin `UserDefaults`-backed persistence, mirroring the slice of web-rig
/// state that survives reloads (active backend, user backends, theme,
/// accounts).
enum Persistence {
    private static let defaults = UserDefaults.standard

    private enum Key {
        static let activeBackendID = "b3nd.activeBackendID"
        static let userBackends = "b3nd.userBackends"
        static let theme = "b3nd.theme"
        static let accounts = "b3nd.accounts"
        static let activeAccountID = "b3nd.activeAccountID"
    }

    // MARK: - active backend

    static var activeBackendID: String? {
        get { defaults.string(forKey: Key.activeBackendID) }
        set { defaults.set(newValue, forKey: Key.activeBackendID) }
    }

    // MARK: - user backends

    /// Codable mirror of `BackendConfig` (which lives in B3ndKit and is not
    /// itself Codable, to keep the kit free of persistence concerns).
    private struct StoredBackend: Codable {
        let id: String
        let name: String
        let baseURL: String
    }

    static var userBackends: [BackendConfig] {
        get {
            guard let data = defaults.data(forKey: Key.userBackends),
                  let stored = try? JSONDecoder().decode([StoredBackend].self, from: data)
            else { return [] }
            return stored.compactMap { item in
                guard let url = URL(string: item.baseURL) else { return nil }
                return BackendConfig(id: item.id, name: item.name, baseURL: url, isUserAdded: true)
            }
        }
        set {
            let stored = newValue.map { StoredBackend(id: $0.id, name: $0.name, baseURL: $0.baseURL.absoluteString) }
            defaults.set(try? JSONEncoder().encode(stored), forKey: Key.userBackends)
        }
    }

    // MARK: - theme

    static var theme: ThemeMode {
        get { defaults.string(forKey: Key.theme).flatMap(ThemeMode.init(rawValue:)) ?? .system }
        set { defaults.set(newValue.rawValue, forKey: Key.theme) }
    }

    // MARK: - accounts

    static var accounts: [ManagedAccount] {
        get {
            guard let data = defaults.data(forKey: Key.accounts),
                  let decoded = try? JSONDecoder().decode([ManagedAccount].self, from: data)
            else { return [] }
            return decoded
        }
        set { defaults.set(try? JSONEncoder().encode(newValue), forKey: Key.accounts) }
    }

    static var activeAccountID: String? {
        get { defaults.string(forKey: Key.activeAccountID) }
        set { defaults.set(newValue, forKey: Key.activeAccountID) }
    }
}

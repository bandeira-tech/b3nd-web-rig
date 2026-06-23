import Foundation
import B3ndKit

/// The shipped `instances.json` — default backends and which one to start on.
/// Mirrors `web-rig`'s `loadInstanceConfig`.
struct InstancesConfig: Decodable {
    struct Entry: Decodable {
        let name: String?
        let baseUrl: String
    }
    struct Defaults: Decodable {
        let backend: String?
    }

    let defaults: Defaults?
    let backends: [String: Entry]?

    /// The bundled config, or a sane local fallback if the resource is missing.
    static func loadBundled() -> InstancesConfig {
        guard let url = Bundle.main.url(forResource: "instances", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let config = try? JSONDecoder().decode(InstancesConfig.self, from: data)
        else {
            return InstancesConfig(
                defaults: Defaults(backend: "local-api"),
                backends: ["local-api": Entry(name: "Local HTTP API", baseUrl: "http://localhost:9942")]
            )
        }
        return config
    }

    /// Materialize the config into `BackendConfig`s, preserving a stable order
    /// (defaults first when present).
    func backendConfigs() -> (backends: [BackendConfig], defaultID: String?) {
        guard let backends else { return ([], defaults?.backend) }
        let configs: [BackendConfig] = backends.keys.sorted().compactMap { id in
            guard let entry = backends[id], let url = URL(string: entry.baseUrl) else { return nil }
            return BackendConfig(id: id, name: entry.name ?? id, baseURL: url, isUserAdded: false)
        }
        return (configs, defaults?.backend)
    }
}

import SwiftUI

/// The five web-rig experiences mapped to a native tab bar. Each tab owns its
/// own `NavigationStack` so drilling in feels native on iOS.
struct RootView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        TabView {
            ExplorerView()
                .tabItem { Label("Explore", systemImage: "folder") }

            EditorView()
                .tabItem { Label("Write", systemImage: "square.and.pencil") }

            NodesView()
                .tabItem { Label("Nodes", systemImage: "server.rack") }

            AppsView()
                .tabItem { Label("Apps", systemImage: "square.grid.2x2") }

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}

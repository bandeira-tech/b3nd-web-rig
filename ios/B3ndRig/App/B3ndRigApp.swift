import SwiftUI

@main
struct B3ndRigApp: App {
    @StateObject private var store = AppStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .tint(.b3ndAccent)
                .preferredColorScheme(store.theme.colorScheme)
                .task { store.bootstrap() }
        }
    }
}

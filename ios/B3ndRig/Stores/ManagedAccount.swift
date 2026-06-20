import Foundation
import CryptoKit

/// A locally-managed identity. The foundation generates a real Ed25519
/// signing keypair (via CryptoKit) and stores it; signed-envelope writes are
/// out of scope for this first cut, but the address (pubkey hex) is real.
///
/// Mirrors the web rig's `ManagedAccount`. The private key is stored in
/// `UserDefaults` for the foundation; a production build should move it to the
/// Keychain — see README.
struct ManagedAccount: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var emoji: String
    let createdAt: Date
    /// Ed25519 signing public key, hex — the account's address on the network.
    let pubkey: String
    /// Ed25519 signing private key, hex (foundation-only; move to Keychain).
    let privateKeyHex: String

    static func generate(name: String, emoji: String) -> ManagedAccount {
        let key = Curve25519.Signing.PrivateKey()
        return ManagedAccount(
            id: UUID().uuidString,
            name: name,
            emoji: emoji,
            createdAt: Date(),
            pubkey: key.publicKey.rawRepresentation.hexString,
            privateKeyHex: key.rawRepresentation.hexString
        )
    }

    /// Short, address-like display of the pubkey.
    var shortPubkey: String {
        guard pubkey.count > 12 else { return pubkey }
        return "\(pubkey.prefix(6))…\(pubkey.suffix(6))"
    }
}

extension Data {
    var hexString: String {
        map { String(format: "%02x", $0) }.joined()
    }
}

import Foundation

struct User: Codable, Identifiable {
    let id: String
    let email: String
    let displayName: String?
    let storageUsed: Int64?
    let storageLimit: Int64?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case displayName = "display_name"
        case storageUsed = "storage_used"
        case storageLimit = "storage_limit"
        case createdAt = "created_at"
    }

    var formattedStorageUsed: String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useBytes, .useKB, .useMB, .useGB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: storageUsed ?? 0)
    }

    var formattedStorageLimit: String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useBytes, .useKB, .useMB, .useGB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: storageLimit ?? 0)
    }

    var storagePercentage: Double {
        guard let limit = storageLimit, limit > 0, let used = storageUsed else { return 0 }
        return Double(used) / Double(limit)
    }
}

struct AuthTokens: Codable {
    let accessToken: String
    let refreshToken: String?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
    }
}

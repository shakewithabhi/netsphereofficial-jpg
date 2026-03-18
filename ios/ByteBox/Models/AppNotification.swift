import Foundation

struct AppNotification: Identifiable, Codable {
    let id: String
    let type: String
    let title: String
    let message: String
    let isRead: Bool
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, type, title, message
        case isRead = "is_read"
        case createdAt = "created_at"
    }

    var relativeTime: String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let fallbackFormatter = ISO8601DateFormatter()
        fallbackFormatter.formatOptions = [.withInternetDateTime]

        guard let date = isoFormatter.date(from: createdAt) ?? fallbackFormatter.date(from: createdAt) else {
            return createdAt
        }

        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    var typeIcon: String {
        switch type {
        case "upload":
            return "arrow.up.circle.fill"
        case "download":
            return "arrow.down.circle.fill"
        case "share":
            return "person.2.fill"
        case "comment":
            return "bubble.left.fill"
        case "trash":
            return "trash.fill"
        case "restore":
            return "arrow.uturn.backward.circle.fill"
        case "storage":
            return "externaldrive.fill"
        case "security":
            return "lock.shield.fill"
        case "system":
            return "gear"
        default:
            return "bell.fill"
        }
    }

    var typeColor: String {
        switch type {
        case "upload":
            return "green"
        case "download":
            return "blue"
        case "share":
            return "purple"
        case "comment":
            return "orange"
        case "trash":
            return "red"
        case "restore":
            return "teal"
        case "security":
            return "red"
        default:
            return "gray"
        }
    }
}

struct NotificationsListResponse: Codable {
    let notifications: [AppNotification]
}

struct UnreadCountResponse: Codable {
    let count: Int
}

struct TwoFactorSetupResponse: Codable {
    let secret: String
    let qrUrl: String

    enum CodingKeys: String, CodingKey {
        case secret
        case qrUrl = "qr_url"
    }
}

struct TwoFactorVerifyResponse: Codable {
    let backupCodes: [String]

    enum CodingKeys: String, CodingKey {
        case backupCodes = "backup_codes"
    }
}

struct TwoFactorLoginResponse: Codable {
    let accessToken: String
    let refreshToken: String?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
    }
}

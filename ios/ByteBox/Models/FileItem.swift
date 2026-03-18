import Foundation

struct FileItem: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let mimeType: String?
    let size: Int64?
    let folderId: String?
    let userId: String?
    let isStarred: Bool?
    let isTrashed: Bool?
    let thumbnailUrl: String?
    let createdAt: String?
    let updatedAt: String?
    let trashedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case mimeType = "mime_type"
        case size
        case folderId = "folder_id"
        case userId = "user_id"
        case isStarred = "is_starred"
        case isTrashed = "is_trashed"
        case thumbnailUrl = "thumbnail_url"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case trashedAt = "trashed_at"
    }

    var formattedSize: String {
        guard let size = size else { return "Unknown" }
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useBytes, .useKB, .useMB, .useGB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: size)
    }

    var formattedDate: String {
        guard let dateStr = updatedAt ?? createdAt else { return "" }
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let fallbackFormatter = ISO8601DateFormatter()
        fallbackFormatter.formatOptions = [.withInternetDateTime]

        guard let date = isoFormatter.date(from: dateStr) ?? fallbackFormatter.date(from: dateStr) else {
            return dateStr
        }

        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        displayFormatter.timeStyle = .short
        return displayFormatter.string(from: date)
    }

    var isImage: Bool {
        mimeType?.hasPrefix("image/") ?? false
    }

    var isVideo: Bool {
        mimeType?.hasPrefix("video/") ?? false
    }

    var isPDF: Bool {
        mimeType == "application/pdf"
    }

    var isAudio: Bool {
        mimeType?.hasPrefix("audio/") ?? false
    }
}

struct FolderItem: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let parentId: String?
    let userId: String?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case parentId = "parent_id"
        case userId = "user_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct FolderContents: Codable {
    let files: [FileItem]
    let folders: [FolderItem]
}

struct Comment: Codable, Identifiable {
    let id: String
    let content: String
    let userId: String?
    let fileId: String?
    let userDisplayName: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case content
        case userId = "user_id"
        case fileId = "file_id"
        case userDisplayName = "user_display_name"
        case createdAt = "created_at"
    }

    var formattedDate: String {
        guard let dateStr = createdAt else { return "" }
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let fallbackFormatter = ISO8601DateFormatter()
        fallbackFormatter.formatOptions = [.withInternetDateTime]

        guard let date = isoFormatter.date(from: dateStr) ?? fallbackFormatter.date(from: dateStr) else {
            return dateStr
        }

        let displayFormatter = RelativeDateTimeFormatter()
        displayFormatter.unitsStyle = .abbreviated
        return displayFormatter.localizedString(for: date, relativeTo: Date())
    }
}

struct DownloadResponse: Codable {
    let url: String
}

struct FilesListResponse: Codable {
    let files: [FileItem]
}

struct CommentsListResponse: Codable {
    let comments: [Comment]
}

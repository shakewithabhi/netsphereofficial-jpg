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

// MARK: - Explore / Post Models

struct Post: Codable, Identifiable, Hashable {
    let id: String
    let fileId: String
    let userId: String
    let caption: String
    let category: String
    let tags: [String]
    let thumbnailUrl: String?
    let videoUrl: String?
    let durationSeconds: Double
    let viewCount: Int
    let likeCount: Int
    let commentCount: Int
    let createdAt: String
    let updatedAt: String
    let creatorName: String
    let creatorAvatar: String?
    let isLiked: Bool
    let isSubscribed: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case fileId = "file_id"
        case userId = "user_id"
        case caption, category, tags
        case thumbnailUrl = "thumbnail_url"
        case videoUrl = "video_url"
        case durationSeconds = "duration_seconds"
        case viewCount = "view_count"
        case likeCount = "like_count"
        case commentCount = "comment_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case creatorName = "creator_name"
        case creatorAvatar = "creator_avatar"
        case isLiked = "is_liked"
        case isSubscribed = "is_subscribed"
    }

    var formattedDuration: String {
        let m = Int(durationSeconds) / 60
        let s = Int(durationSeconds) % 60
        return "\(m):\(String(format: "%02d", s))"
    }

    var formattedViews: String {
        formatCount(viewCount)
    }

    var formattedLikes: String {
        formatCount(likeCount)
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

    private func formatCount(_ n: Int) -> String {
        if n >= 1_000_000 {
            let val = Double(n) / 1_000_000.0
            return val.truncatingRemainder(dividingBy: 1) == 0
                ? "\(Int(val))M" : String(format: "%.1fM", val)
        }
        if n >= 1_000 {
            let val = Double(n) / 1_000.0
            return val.truncatingRemainder(dividingBy: 1) == 0
                ? "\(Int(val))K" : String(format: "%.1fK", val)
        }
        return "\(n)"
    }
}

struct PostComment: Codable, Identifiable {
    let id: String
    let postId: String
    let userId: String
    let userName: String
    let userAvatar: String?
    let content: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case postId = "post_id"
        case userId = "user_id"
        case userName = "user_name"
        case userAvatar = "user_avatar"
        case content
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
}

struct CreatorProfile: Codable {
    let userId: String
    let displayName: String
    let avatarUrl: String?
    let subscriberCount: Int
    let postCount: Int
    let totalViews: Int
    let isSubscribed: Bool
    let posts: [Post]

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case subscriberCount = "subscriber_count"
        case postCount = "post_count"
        case totalViews = "total_views"
        case isSubscribed = "is_subscribed"
        case posts
    }
}

struct PostsListResponse: Codable {
    let posts: [Post]
}

struct PostCommentsListResponse: Codable {
    let comments: [PostComment]
}

struct TrendingTag: Codable {
    let tag: String
    let count: Int
}

struct FilesListResponse: Codable {
    let files: [FileItem]
}

struct CommentsListResponse: Codable {
    let comments: [Comment]
}

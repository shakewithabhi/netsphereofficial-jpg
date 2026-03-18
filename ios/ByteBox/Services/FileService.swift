import Foundation

final class FileService {
    static let shared = FileService()
    private let api = APIClient.shared

    private init() {}

    // MARK: - Folder Contents

    func getRootContents(sort: String = "name", order: String = "asc") async throws -> FolderContents {
        return try await api.request(
            "GET",
            path: "/folders/root/contents",
            queryItems: [
                URLQueryItem(name: "limit", value: "50"),
                URLQueryItem(name: "sort", value: sort),
                URLQueryItem(name: "order", value: order)
            ]
        )
    }

    func getFolderContents(folderId: String, sort: String = "name", order: String = "asc") async throws -> FolderContents {
        return try await api.request(
            "GET",
            path: "/folders/\(folderId)/contents",
            queryItems: [
                URLQueryItem(name: "limit", value: "50"),
                URLQueryItem(name: "sort", value: sort),
                URLQueryItem(name: "order", value: order)
            ]
        )
    }

    // MARK: - Folder Operations

    func createFolder(name: String, parentId: String?) async throws -> FolderItem {
        var body: [String: Any] = ["name": name]
        if let parentId = parentId {
            body["parent_id"] = parentId
        }
        return try await api.request("POST", path: "/folders", body: body)
    }

    func renameFolder(folderId: String, name: String) async throws -> FolderItem {
        return try await api.request("PUT", path: "/folders/\(folderId)", body: ["name": name])
    }

    // MARK: - File Operations

    func getDownloadURL(fileId: String) async throws -> DownloadResponse {
        return try await api.request("GET", path: "/files/\(fileId)/download")
    }

    func uploadFile(data: Data, fileName: String, mimeType: String, folderId: String?) async throws -> FileItem {
        var fields: [String: String] = [:]
        if let folderId = folderId {
            fields["folder_id"] = folderId
        }
        return try await api.upload(
            path: "/files/upload",
            fileData: data,
            fileName: fileName,
            mimeType: mimeType,
            fields: fields
        )
    }

    func trashFile(fileId: String) async throws {
        let _: EmptyResponse = try await api.request("POST", path: "/files/\(fileId)/trash")
    }

    func restoreFile(fileId: String) async throws {
        let _: EmptyResponse = try await api.request("POST", path: "/files/\(fileId)/restore")
    }

    func permanentDelete(fileId: String) async throws {
        let _: EmptyResponse = try await api.request("DELETE", path: "/files/\(fileId)")
    }

    func copyFile(fileId: String, folderId: String?) async throws -> FileItem {
        var body: [String: Any] = [:]
        if let folderId = folderId {
            body["folder_id"] = folderId
        }
        return try await api.request("POST", path: "/files/\(fileId)/copy", body: body)
    }

    // MARK: - Remote Upload

    func remoteUpload(url: String, folderId: String? = nil, fileName: String? = nil) async throws -> FileItem {
        var body: [String: Any] = ["url": url]
        if let folderId = folderId {
            body["folder_id"] = folderId
        }
        if let fileName = fileName {
            body["file_name"] = fileName
        }
        return try await api.request("POST", path: "/files/remote-upload", body: body)
    }

    // MARK: - Star Operations

    func starFile(fileId: String) async throws {
        let _: EmptyResponse = try await api.request("POST", path: "/files/\(fileId)/star")
    }

    func unstarFile(fileId: String) async throws {
        let _: EmptyResponse = try await api.request("DELETE", path: "/files/\(fileId)/star")
    }

    func getStarredFiles() async throws -> FilesListResponse {
        return try await api.request("GET", path: "/files/starred")
    }

    // MARK: - Trash

    func getTrash() async throws -> FilesListResponse {
        return try await api.request("GET", path: "/files/trash")
    }

    // MARK: - Search

    func searchFiles(query: String) async throws -> FilesListResponse {
        return try await api.request(
            "GET",
            path: "/files/search",
            queryItems: [URLQueryItem(name: "q", value: query)]
        )
    }

    // MARK: - Comments

    func getComments(fileId: String) async throws -> CommentsListResponse {
        return try await api.request("GET", path: "/files/\(fileId)/comments")
    }

    func createComment(fileId: String, content: String) async throws -> Comment {
        return try await api.request(
            "POST",
            path: "/files/\(fileId)/comments",
            body: ["content": content]
        )
    }

    func deleteComment(fileId: String, commentId: String) async throws {
        let _: EmptyResponse = try await api.request(
            "DELETE",
            path: "/files/\(fileId)/comments/\(commentId)"
        )
    }

    // MARK: - Notifications

    func getNotifications(limit: Int = 20) async throws -> [AppNotification] {
        let response: NotificationsListResponse = try await api.request(
            "GET",
            path: "/notifications",
            queryItems: [URLQueryItem(name: "limit", value: "\(limit)")]
        )
        return response.notifications
    }

    func getUnreadCount() async throws -> Int {
        let response: UnreadCountResponse = try await api.request(
            "GET",
            path: "/notifications/unread-count"
        )
        return response.count
    }

    func markNotificationRead(_ id: String) async throws {
        let _: EmptyResponse = try await api.request(
            "POST",
            path: "/notifications/\(id)/read"
        )
    }

    func markAllNotificationsRead() async throws {
        let _: EmptyResponse = try await api.request(
            "POST",
            path: "/notifications/read-all"
        )
    }

    func registerPushToken(_ token: String, platform: String) async throws {
        let _: EmptyResponse = try await api.request(
            "POST",
            path: "/notifications/push-token",
            body: ["token": token, "platform": platform]
        )
    }
}

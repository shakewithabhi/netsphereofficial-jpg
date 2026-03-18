import Foundation

@MainActor
final class NotificationsViewModel: ObservableObject {
    @Published var notifications: [AppNotification] = []
    @Published var unreadCount: Int = 0
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let fileService = FileService.shared

    func loadNotifications() async {
        isLoading = true
        errorMessage = nil

        do {
            notifications = try await fileService.getNotifications()
            unreadCount = notifications.filter { !$0.isRead }.count
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func loadUnreadCount() async {
        do {
            unreadCount = try await fileService.getUnreadCount()
        } catch {
            // Silently fail for badge count
        }
    }

    func markAsRead(_ id: String) async {
        do {
            try await fileService.markNotificationRead(id)
            if let index = notifications.firstIndex(where: { $0.id == id }) {
                let n = notifications[index]
                notifications[index] = AppNotification(
                    id: n.id,
                    type: n.type,
                    title: n.title,
                    message: n.message,
                    isRead: true,
                    createdAt: n.createdAt
                )
                unreadCount = notifications.filter { !$0.isRead }.count
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func markAllAsRead() async {
        do {
            try await fileService.markAllNotificationsRead()
            notifications = notifications.map {
                AppNotification(
                    id: $0.id,
                    type: $0.type,
                    title: $0.title,
                    message: $0.message,
                    isRead: true,
                    createdAt: $0.createdAt
                )
            }
            unreadCount = 0
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

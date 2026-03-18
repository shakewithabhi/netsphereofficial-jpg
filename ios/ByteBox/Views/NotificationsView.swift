import SwiftUI

struct NotificationsView: View {
    @StateObject private var viewModel = NotificationsViewModel()

    private let brandBlue = Color(red: 0.231, green: 0.510, blue: 0.965)

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.notifications.isEmpty {
                    ProgressView("Loading notifications...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.notifications.isEmpty {
                    emptyState
                } else {
                    notificationsList
                }
            }
            .navigationTitle("Notifications")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if !viewModel.notifications.isEmpty {
                        Button {
                            Task {
                                await viewModel.markAllAsRead()
                            }
                        } label: {
                            Text("Mark All Read")
                                .font(.caption)
                        }
                        .disabled(viewModel.unreadCount == 0)
                    }
                }
            }
            .refreshable {
                await viewModel.loadNotifications()
            }
            .task {
                await viewModel.loadNotifications()
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "bell.slash")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)

            Text("No notifications yet")
                .font(.title3)
                .fontWeight(.medium)
                .foregroundStyle(.secondary)

            Text("You'll see notifications about your files and account here.")
                .font(.subheadline)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var notificationsList: some View {
        List {
            ForEach(viewModel.notifications) { notification in
                notificationRow(notification)
                    .swipeActions(edge: .trailing) {
                        if !notification.isRead {
                            Button {
                                Task {
                                    await viewModel.markAsRead(notification.id)
                                }
                            } label: {
                                Label("Read", systemImage: "envelope.open")
                            }
                            .tint(brandBlue)
                        }
                    }
            }
        }
        .listStyle(.plain)
    }

    private func notificationRow(_ notification: AppNotification) -> some View {
        HStack(alignment: .top, spacing: 12) {
            // Type icon
            Image(systemName: notification.typeIcon)
                .font(.title3)
                .foregroundStyle(iconColor(for: notification.typeColor))
                .frame(width: 32, height: 32)

            // Content
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(notification.title)
                        .font(.subheadline)
                        .fontWeight(notification.isRead ? .regular : .semibold)
                        .lineLimit(1)

                    Spacer()

                    Text(notification.relativeTime)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Text(notification.message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            // Unread indicator
            if !notification.isRead {
                Circle()
                    .fill(brandBlue)
                    .frame(width: 8, height: 8)
                    .padding(.top, 6)
            }
        }
        .padding(.vertical, 4)
    }

    private func iconColor(for colorName: String) -> Color {
        switch colorName {
        case "green": return .green
        case "blue": return .blue
        case "purple": return .purple
        case "orange": return .orange
        case "red": return .red
        case "teal": return .teal
        default: return .gray
        }
    }
}

#Preview {
    NotificationsView()
}

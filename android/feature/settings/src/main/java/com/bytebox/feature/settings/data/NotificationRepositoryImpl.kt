package com.bytebox.feature.settings.data

import com.bytebox.core.common.Result
import com.bytebox.core.common.map
import com.bytebox.core.network.api.NotificationApi
import com.bytebox.core.network.dto.NotificationDto
import com.bytebox.core.network.safeApiCall
import com.bytebox.domain.model.Notification
import com.bytebox.domain.repository.NotificationRepository
import javax.inject.Inject

class NotificationRepositoryImpl @Inject constructor(
    private val notificationApi: NotificationApi
) : NotificationRepository {

    override suspend fun getNotifications(): Result<List<Notification>> {
        return safeApiCall { notificationApi.getNotifications() }.map { response ->
            response.notifications.map { it.toDomain() }
        }
    }

    override suspend fun getUnreadCount(): Result<Int> {
        return safeApiCall { notificationApi.getUnreadCount() }.map { it.count }
    }

    override suspend fun markAsRead(id: String): Result<Unit> {
        return safeApiCall { notificationApi.markAsRead(id) }
    }

    override suspend fun markAllAsRead(): Result<Unit> {
        return safeApiCall { notificationApi.markAllAsRead() }
    }

    private fun NotificationDto.toDomain() = Notification(
        id = id,
        type = type,
        title = title,
        message = message,
        isRead = isRead,
        createdAt = createdAt
    )
}

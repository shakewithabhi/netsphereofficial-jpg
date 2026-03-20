package com.bytebox.domain.repository

import com.bytebox.core.common.Result
import com.bytebox.domain.model.Notification

interface NotificationRepository {
    suspend fun getNotifications(): Result<List<Notification>>
    suspend fun getUnreadCount(): Result<Int>
    suspend fun markAsRead(id: String): Result<Unit>
    suspend fun markAllAsRead(): Result<Unit>
}

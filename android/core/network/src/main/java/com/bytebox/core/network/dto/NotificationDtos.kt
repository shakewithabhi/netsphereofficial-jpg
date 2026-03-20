package com.bytebox.core.network.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class NotificationDto(
    val id: String,
    val type: String,
    val title: String,
    val message: String,
    @Json(name = "is_read") val isRead: Boolean,
    @Json(name = "created_at") val createdAt: String
)

@JsonClass(generateAdapter = true)
data class NotificationsResponse(val notifications: List<NotificationDto>)

@JsonClass(generateAdapter = true)
data class NotificationCountResponse(val count: Int)

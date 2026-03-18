package com.bytebox.domain.model

data class NotificationItem(
    val id: String,
    val type: String,
    val title: String,
    val message: String,
    val isRead: Boolean,
    val createdAt: String
)

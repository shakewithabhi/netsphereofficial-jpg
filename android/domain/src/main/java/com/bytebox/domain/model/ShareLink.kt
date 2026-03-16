package com.bytebox.domain.model

data class ShareLink(
    val id: String,
    val fileId: String,
    val code: String,
    val shareUrl: String,
    val hasPassword: Boolean,
    val expiresAt: String?,
    val maxDownloads: Int?,
    val downloadCount: Int,
    val isActive: Boolean,
    val fileName: String?,
    val fileSize: Long?,
    val createdAt: String
)

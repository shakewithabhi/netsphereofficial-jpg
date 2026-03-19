package com.bytebox.domain.model

data class ShareInfo(
    val shareType: String,
    val fileName: String?,
    val fileSize: Long?,
    val mimeType: String?,
    val folderName: String?,
    val hasPassword: Boolean,
    val isVideo: Boolean,
    val thumbnailUrl: String?,
    val videoThumbnailUrl: String?,
    val hlsUrl: String?,
    val likeCount: Int,
    val commentCount: Int,
    val isLiked: Boolean,
    val ownerName: String,
    val downloadCount: Int,
)

data class ShareComment(
    val id: String,
    val shareId: String,
    val userId: String,
    val userName: String,
    val content: String,
    val createdAt: String,
)

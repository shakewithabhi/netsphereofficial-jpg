package com.bytebox.domain.model

import com.bytebox.core.common.FileCategory

data class ExploreItem(
    val id: String,
    val code: String,
    val fileName: String,
    val fileSize: Long,
    val mimeType: String,
    val thumbnailUrl: String?,
    val ownerName: String,
    val downloadCount: Int,
    val createdAt: String,
) {
    val category: FileCategory
        get() = when {
            mimeType.startsWith("image/") -> FileCategory.IMAGE
            mimeType.startsWith("video/") -> FileCategory.VIDEO
            mimeType.startsWith("audio/") -> FileCategory.AUDIO
            mimeType == "application/pdf" -> FileCategory.PDF
            mimeType.contains("word") || mimeType.contains("document") -> FileCategory.OFFICE_DOCUMENT
            mimeType.startsWith("text/") -> FileCategory.TEXT_DOCUMENT
            else -> FileCategory.OTHER
        }
}

data class Post(
    val id: String,
    val userId: String,
    val userName: String,
    val caption: String,
    val category: String,
    val tags: List<String>,
    val viewCount: Long,
    val likeCount: Long,
    val commentCount: Long,
    val isLiked: Boolean,
    val isSubscribed: Boolean,
    val subscriberCount: Long,
    val videoUrl: String?,
    val thumbnailUrl: String?,
    val hlsUrl: String?,
    val fileName: String,
    val mimeType: String,
    val fileSize: Long,
    val durationSeconds: Int,
    val createdAt: String,
)

data class PostComment(
    val id: String,
    val userId: String,
    val userName: String,
    val content: String,
    val createdAt: String,
)

data class CreatorProfile(
    val userId: String,
    val name: String,
    val postCount: Long,
    val subscriberCount: Long,
    val isSubscribed: Boolean,
)

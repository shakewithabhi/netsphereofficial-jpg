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
    val likeCount: Int = 0,
    val commentCount: Int = 0,
    val hlsUrl: String? = null,
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

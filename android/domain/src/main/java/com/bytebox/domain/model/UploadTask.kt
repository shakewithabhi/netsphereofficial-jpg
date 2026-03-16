package com.bytebox.domain.model

data class UploadTask(
    val id: Long,
    val fileName: String,
    val fileSize: Long,
    val mimeType: String,
    val folderId: String?,
    val status: UploadStatus,
    val progress: Float,
    val completedChunks: Int,
    val totalChunks: Int,
    val errorMessage: String?,
    val serverFileId: String? = null,
    val shareUrl: String? = null
)

enum class UploadStatus {
    PENDING, UPLOADING, PAUSED, COMPLETED, FAILED
}

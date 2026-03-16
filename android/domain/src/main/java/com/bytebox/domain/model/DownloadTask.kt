package com.bytebox.domain.model

data class DownloadTask(
    val id: Long,
    val fileId: String,
    val fileName: String,
    val fileSize: Long,
    val localPath: String?,
    val status: DownloadStatus,
    val progress: Float,
    val bytesDownloaded: Long,
    val errorMessage: String?
)

enum class DownloadStatus {
    PENDING, DOWNLOADING, PAUSED, COMPLETED, FAILED
}

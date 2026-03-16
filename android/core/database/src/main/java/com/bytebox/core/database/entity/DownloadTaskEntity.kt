package com.bytebox.core.database.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "download_tasks")
data class DownloadTaskEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "file_id") val fileId: String,
    @ColumnInfo(name = "file_name") val fileName: String,
    @ColumnInfo(name = "file_size") val fileSize: Long,
    @ColumnInfo(name = "download_url") val downloadUrl: String?,
    @ColumnInfo(name = "local_path") val localPath: String?,
    val status: String, // pending, downloading, paused, completed, failed
    val progress: Float = 0f,
    @ColumnInfo(name = "bytes_downloaded") val bytesDownloaded: Long = 0,
    @ColumnInfo(name = "error_message") val errorMessage: String? = null,
    @ColumnInfo(name = "work_manager_id") val workManagerId: String? = null,
    @ColumnInfo(name = "created_at") val createdAt: Long = System.currentTimeMillis()
)

package com.bytebox.core.database.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "upload_tasks")
data class UploadTaskEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "local_file_uri") val localFileUri: String,
    @ColumnInfo(name = "file_name") val fileName: String,
    @ColumnInfo(name = "file_size") val fileSize: Long,
    @ColumnInfo(name = "mime_type") val mimeType: String,
    @ColumnInfo(name = "folder_id") val folderId: String?,
    @ColumnInfo(name = "upload_session_id") val uploadSessionId: String?,
    val status: String, // pending, uploading, paused, completed, failed
    val progress: Float = 0f,
    @ColumnInfo(name = "completed_chunks") val completedChunks: Int = 0,
    @ColumnInfo(name = "total_chunks") val totalChunks: Int = 0,
    @ColumnInfo(name = "error_message") val errorMessage: String? = null,
    @ColumnInfo(name = "work_manager_id") val workManagerId: String? = null,
    @ColumnInfo(name = "server_file_id") val serverFileId: String? = null,
    @ColumnInfo(name = "share_url") val shareUrl: String? = null,
    @ColumnInfo(name = "created_at") val createdAt: Long = System.currentTimeMillis()
)

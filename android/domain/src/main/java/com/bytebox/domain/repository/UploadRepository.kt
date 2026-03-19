package com.bytebox.domain.repository

import com.bytebox.domain.model.UploadTask
import kotlinx.coroutines.flow.Flow

interface UploadRepository {
    fun getActiveTasks(): Flow<List<UploadTask>>
    fun getAllTasks(): Flow<List<UploadTask>>
    suspend fun enqueueUpload(
        localFileUri: String,
        fileName: String,
        fileSize: Long,
        mimeType: String,
        folderId: String?,
        sharePublicly: Boolean = false,
    ): Long
    suspend fun cancelUpload(taskId: Long)
    suspend fun retryUpload(taskId: Long)
    suspend fun clearCompleted()
    suspend fun removeUpload(taskId: Long)
}

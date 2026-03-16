package com.bytebox.domain.repository

import com.bytebox.domain.model.DownloadTask
import kotlinx.coroutines.flow.Flow

interface DownloadRepository {
    fun getActiveTasks(): Flow<List<DownloadTask>>
    fun getAllTasks(): Flow<List<DownloadTask>>
    suspend fun enqueueDownload(fileId: String, fileName: String, fileSize: Long): Long
    suspend fun cancelDownload(taskId: Long)
    suspend fun retryDownload(taskId: Long)
    suspend fun clearCompleted()
}

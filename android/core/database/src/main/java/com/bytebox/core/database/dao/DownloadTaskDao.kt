package com.bytebox.core.database.dao

import androidx.room.*
import com.bytebox.core.database.entity.DownloadTaskEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface DownloadTaskDao {

    @Query("SELECT * FROM download_tasks ORDER BY created_at DESC")
    fun getAllTasks(): Flow<List<DownloadTaskEntity>>

    @Query("SELECT * FROM download_tasks WHERE status IN ('pending', 'downloading') ORDER BY created_at ASC")
    fun getActiveTasks(): Flow<List<DownloadTaskEntity>>

    @Query("SELECT * FROM download_tasks WHERE id = :id")
    suspend fun getTaskById(id: Long): DownloadTaskEntity?

    @Insert
    suspend fun insertTask(task: DownloadTaskEntity): Long

    @Update
    suspend fun updateTask(task: DownloadTaskEntity)

    @Query("UPDATE download_tasks SET status = :status, progress = :progress, bytes_downloaded = :bytesDownloaded WHERE id = :id")
    suspend fun updateProgress(id: Long, status: String, progress: Float, bytesDownloaded: Long)

    @Query("UPDATE download_tasks SET status = 'failed', error_message = :error WHERE id = :id")
    suspend fun markFailed(id: Long, error: String)

    @Delete
    suspend fun deleteTask(task: DownloadTaskEntity)

    @Query("DELETE FROM download_tasks WHERE status = 'completed'")
    suspend fun clearCompleted()
}

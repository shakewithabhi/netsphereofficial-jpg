package com.bytebox.core.database.dao

import androidx.room.*
import com.bytebox.core.database.entity.UploadTaskEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface UploadTaskDao {

    @Query("SELECT * FROM upload_tasks ORDER BY created_at DESC")
    fun getAllTasks(): Flow<List<UploadTaskEntity>>

    @Query("SELECT * FROM upload_tasks WHERE status IN ('pending', 'uploading') ORDER BY created_at ASC")
    fun getActiveTasks(): Flow<List<UploadTaskEntity>>

    @Query("SELECT * FROM upload_tasks WHERE id = :id")
    suspend fun getTaskById(id: Long): UploadTaskEntity?

    @Insert
    suspend fun insertTask(task: UploadTaskEntity): Long

    @Update
    suspend fun updateTask(task: UploadTaskEntity)

    @Query("UPDATE upload_tasks SET status = :status, progress = :progress, completed_chunks = :completedChunks WHERE id = :id")
    suspend fun updateProgress(id: Long, status: String, progress: Float, completedChunks: Int)

    @Query("UPDATE upload_tasks SET status = 'failed', error_message = :error WHERE id = :id")
    suspend fun markFailed(id: Long, error: String)

    @Query("UPDATE upload_tasks SET server_file_id = :fileId WHERE id = :id")
    suspend fun updateServerFileId(id: Long, fileId: String)

    @Query("UPDATE upload_tasks SET share_url = :shareUrl WHERE id = :id")
    suspend fun updateShareUrl(id: Long, shareUrl: String)

    @Delete
    suspend fun deleteTask(task: UploadTaskEntity)

    @Query("DELETE FROM upload_tasks WHERE id = :id")
    suspend fun deleteTaskById(id: Long)

    @Query("DELETE FROM upload_tasks WHERE status = 'completed'")
    suspend fun clearCompleted()

    @Query("DELETE FROM upload_tasks")
    suspend fun deleteAll()
}

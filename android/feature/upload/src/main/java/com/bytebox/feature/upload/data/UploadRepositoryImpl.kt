package com.bytebox.feature.upload.data

import androidx.work.WorkManager
import com.bytebox.core.database.dao.UploadTaskDao
import com.bytebox.core.database.entity.UploadTaskEntity
import com.bytebox.core.worker.UploadWorker
import com.bytebox.domain.model.UploadStatus
import com.bytebox.domain.model.UploadTask
import com.bytebox.domain.repository.UploadRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class UploadRepositoryImpl @Inject constructor(
    private val uploadTaskDao: UploadTaskDao,
    private val workManager: WorkManager
) : UploadRepository {

    override fun getActiveTasks(): Flow<List<UploadTask>> =
        uploadTaskDao.getActiveTasks().map { list -> list.map { it.toDomain() } }

    override fun getAllTasks(): Flow<List<UploadTask>> =
        uploadTaskDao.getAllTasks().map { list -> list.map { it.toDomain() } }

    override suspend fun enqueueUpload(
        localFileUri: String,
        fileName: String,
        fileSize: Long,
        mimeType: String,
        folderId: String?
    ): Long {
        val entity = UploadTaskEntity(
            localFileUri = localFileUri,
            fileName = fileName,
            fileSize = fileSize,
            mimeType = mimeType,
            folderId = folderId,
            uploadSessionId = null,
            status = "pending"
        )
        val taskId = uploadTaskDao.insertTask(entity)

        val workRequest = UploadWorker.buildRequest(taskId)
        workManager.enqueue(workRequest)

        uploadTaskDao.updateTask(entity.copy(
            id = taskId,
            workManagerId = workRequest.id.toString()
        ))

        return taskId
    }

    override suspend fun cancelUpload(taskId: Long) {
        val task = uploadTaskDao.getTaskById(taskId) ?: return
        task.workManagerId?.let { workManager.cancelWorkById(java.util.UUID.fromString(it)) }
        uploadTaskDao.updateTask(task.copy(status = "failed", errorMessage = "Cancelled"))
    }

    override suspend fun retryUpload(taskId: Long) {
        val task = uploadTaskDao.getTaskById(taskId) ?: return
        val workRequest = UploadWorker.buildRequest(taskId)
        workManager.enqueue(workRequest)
        uploadTaskDao.updateTask(task.copy(
            status = "pending",
            errorMessage = null,
            workManagerId = workRequest.id.toString()
        ))
    }

    override suspend fun clearCompleted() {
        uploadTaskDao.clearCompleted()
    }

    override suspend fun removeUpload(taskId: Long) {
        val task = uploadTaskDao.getTaskById(taskId) ?: return
        task.workManagerId?.let { workManager.cancelWorkById(java.util.UUID.fromString(it)) }
        uploadTaskDao.deleteTaskById(taskId)
    }

    private fun UploadTaskEntity.toDomain() = UploadTask(
        id = id,
        fileName = fileName,
        fileSize = fileSize,
        mimeType = mimeType,
        folderId = folderId,
        status = UploadStatus.valueOf(status.uppercase()),
        progress = progress,
        completedChunks = completedChunks,
        totalChunks = totalChunks,
        errorMessage = errorMessage,
        serverFileId = serverFileId,
        shareUrl = shareUrl
    )
}

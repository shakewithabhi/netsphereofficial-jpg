package com.bytebox.feature.download.data

import androidx.work.WorkManager
import com.bytebox.core.database.dao.DownloadTaskDao
import com.bytebox.core.database.entity.DownloadTaskEntity
import com.bytebox.core.worker.DownloadWorker
import com.bytebox.domain.model.DownloadStatus
import com.bytebox.domain.model.DownloadTask
import com.bytebox.domain.repository.DownloadRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class DownloadRepositoryImpl @Inject constructor(
    private val downloadTaskDao: DownloadTaskDao,
    private val workManager: WorkManager
) : DownloadRepository {

    override fun getActiveTasks(): Flow<List<DownloadTask>> =
        downloadTaskDao.getActiveTasks().map { list -> list.map { it.toDomain() } }

    override fun getAllTasks(): Flow<List<DownloadTask>> =
        downloadTaskDao.getAllTasks().map { list -> list.map { it.toDomain() } }

    override suspend fun enqueueDownload(fileId: String, fileName: String, fileSize: Long): Long {
        val entity = DownloadTaskEntity(
            fileId = fileId,
            fileName = fileName,
            fileSize = fileSize,
            downloadUrl = null,
            localPath = null,
            status = "pending"
        )
        val taskId = downloadTaskDao.insertTask(entity)

        val workRequest = DownloadWorker.buildRequest(taskId)
        workManager.enqueue(workRequest)

        downloadTaskDao.updateTask(entity.copy(
            id = taskId,
            workManagerId = workRequest.id.toString()
        ))

        return taskId
    }

    override suspend fun cancelDownload(taskId: Long) {
        val task = downloadTaskDao.getTaskById(taskId) ?: return
        task.workManagerId?.let { workManager.cancelWorkById(java.util.UUID.fromString(it)) }
        downloadTaskDao.updateTask(task.copy(status = "failed", errorMessage = "Cancelled"))
    }

    override suspend fun retryDownload(taskId: Long) {
        val task = downloadTaskDao.getTaskById(taskId) ?: return
        val workRequest = DownloadWorker.buildRequest(taskId)
        workManager.enqueue(workRequest)
        downloadTaskDao.updateTask(task.copy(
            status = "pending",
            errorMessage = null,
            workManagerId = workRequest.id.toString()
        ))
    }

    override suspend fun clearCompleted() {
        downloadTaskDao.clearCompleted()
    }

    private fun DownloadTaskEntity.toDomain() = DownloadTask(
        id = id,
        fileId = fileId,
        fileName = fileName,
        fileSize = fileSize,
        localPath = localPath,
        status = DownloadStatus.valueOf(status.uppercase()),
        progress = progress,
        bytesDownloaded = bytesDownloaded,
        errorMessage = errorMessage
    )
}

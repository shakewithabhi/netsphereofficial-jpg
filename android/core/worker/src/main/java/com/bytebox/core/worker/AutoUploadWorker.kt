package com.bytebox.core.worker

import android.content.Context
import android.os.Environment
import android.webkit.MimeTypeMap
import androidx.hilt.work.HiltWorker
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequest
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.bytebox.core.database.dao.UploadTaskDao
import com.bytebox.core.database.entity.UploadTaskEntity
import com.bytebox.core.datastore.UserPreferences
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import timber.log.Timber
import java.io.File
import java.util.concurrent.TimeUnit

@HiltWorker
class AutoUploadWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val userPreferences: UserPreferences,
    private val uploadTaskDao: UploadTaskDao
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val enabled = userPreferences.autoUploadEnabled.first()
        if (!enabled) return@withContext Result.success()

        val lastTimestamp = userPreferences.lastAutoUploadTimestamp.first()
        val targetFolderId = userPreferences.autoUploadFolderId.first()

        val cameraDir = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM),
            "Camera"
        )

        if (!cameraDir.exists() || !cameraDir.isDirectory) {
            Timber.d("Camera directory not found: ${cameraDir.absolutePath}")
            return@withContext Result.success()
        }

        val newFiles = cameraDir.listFiles { file ->
            file.isFile && file.lastModified() > lastTimestamp && isMediaFile(file)
        }?.sortedBy { it.lastModified() } ?: emptyList()

        if (newFiles.isEmpty()) {
            Timber.d("No new camera files to upload")
            return@withContext Result.success()
        }

        Timber.d("Found ${newFiles.size} new camera files to upload")

        var latestTimestamp = lastTimestamp
        val workManager = WorkManager.getInstance(applicationContext)

        for (file in newFiles) {
            val mimeType = getMimeType(file) ?: "application/octet-stream"
            val uri = android.net.Uri.fromFile(file)

            val task = UploadTaskEntity(
                localFileUri = uri.toString(),
                fileName = file.name,
                fileSize = file.length(),
                mimeType = mimeType,
                folderId = targetFolderId,
                uploadSessionId = null,
                status = "pending"
            )

            val taskId = uploadTaskDao.insertTask(task)
            val uploadRequest = UploadWorker.buildRequest(taskId)
            workManager.enqueue(uploadRequest)

            if (file.lastModified() > latestTimestamp) {
                latestTimestamp = file.lastModified()
            }
        }

        userPreferences.setLastAutoUploadTimestamp(latestTimestamp)
        Result.success()
    }

    private fun isMediaFile(file: File): Boolean {
        val mimeType = getMimeType(file) ?: return false
        return mimeType.startsWith("image/") || mimeType.startsWith("video/")
    }

    private fun getMimeType(file: File): String? {
        val extension = file.extension.lowercase()
        return MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension)
    }

    companion object {
        const val WORK_NAME = "auto_upload_camera"

        fun buildPeriodicRequest(wifiOnly: Boolean): PeriodicWorkRequest {
            val networkType = if (wifiOnly) NetworkType.UNMETERED else NetworkType.CONNECTED
            return PeriodicWorkRequestBuilder<AutoUploadWorker>(15, TimeUnit.MINUTES)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(networkType)
                        .build()
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
        }

        fun enqueue(context: Context, wifiOnly: Boolean) {
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                buildPeriodicRequest(wifiOnly)
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}

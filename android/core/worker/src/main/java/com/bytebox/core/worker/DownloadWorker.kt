package com.bytebox.core.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.os.Environment
import androidx.core.app.NotificationCompat
import androidx.hilt.work.HiltWorker
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.bytebox.core.database.dao.DownloadTaskDao
import com.bytebox.core.network.api.FileApi
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import timber.log.Timber
import java.io.File
import java.io.FileOutputStream

@HiltWorker
class DownloadWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val fileApi: FileApi,
    private val downloadTaskDao: DownloadTaskDao,
    private val okHttpClient: OkHttpClient
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val taskId = inputData.getLong(KEY_TASK_ID, -1)
        if (taskId == -1L) return Result.failure()

        val task = downloadTaskDao.getTaskById(taskId) ?: return Result.failure()

        createNotificationChannel()
        setForeground(createForegroundInfo(task.fileName, 0f))

        return withContext(Dispatchers.IO) {
            try {
                // Get download URL from API
                val urlResp = fileApi.getDownloadUrl(task.fileId)
                if (!urlResp.isSuccessful) {
                    downloadTaskDao.markFailed(taskId, "Failed to get download URL")
                    return@withContext Result.retry()
                }

                val downloadUrl = urlResp.body()!!.url

                // Prepare output file
                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                val byteboxDir = File(downloadsDir, "ByteBox")
                byteboxDir.mkdirs()
                val outputFile = File(byteboxDir, task.fileName)

                // Download with resume support
                val existingBytes = if (outputFile.exists()) outputFile.length() else 0L

                val requestBuilder = Request.Builder().url(downloadUrl)
                if (existingBytes > 0) {
                    requestBuilder.addHeader("Range", "bytes=$existingBytes-")
                }

                val httpResponse = okHttpClient.newCall(requestBuilder.build()).execute()
                if (!httpResponse.isSuccessful && httpResponse.code != 206) {
                    downloadTaskDao.markFailed(taskId, "Download failed: ${httpResponse.code}")
                    return@withContext Result.retry()
                }

                val body = httpResponse.body ?: return@withContext Result.retry()
                val totalBytes = task.fileSize
                var downloadedBytes = existingBytes

                val fos = FileOutputStream(outputFile, existingBytes > 0)
                val buffer = ByteArray(8192)

                body.byteStream().use { input ->
                    fos.use { output ->
                        while (true) {
                            val bytesRead = input.read(buffer)
                            if (bytesRead == -1) break

                            output.write(buffer, 0, bytesRead)
                            downloadedBytes += bytesRead

                            val progress = if (totalBytes > 0) downloadedBytes.toFloat() / totalBytes else 0f
                            downloadTaskDao.updateProgress(taskId, "downloading", progress, downloadedBytes)
                            setForeground(createForegroundInfo(task.fileName, progress))
                        }
                    }
                }

                downloadTaskDao.updateTask(task.copy(
                    status = "completed",
                    progress = 1f,
                    bytesDownloaded = downloadedBytes,
                    localPath = outputFile.absolutePath
                ))

                Result.success()
            } catch (e: Exception) {
                Timber.e(e, "Download failed for task $taskId")
                downloadTaskDao.markFailed(taskId, e.message ?: "Download failed")
                Result.retry()
            }
        }
    }

    private fun createForegroundInfo(fileName: String, progress: Float): ForegroundInfo {
        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setContentTitle("Downloading")
            .setContentText(fileName)
            .setSmallIcon(android.R.drawable.ic_menu_save)
            .setProgress(100, (progress * 100).toInt(), false)
            .setOngoing(true)
            .build()

        return ForegroundInfo(NOTIFICATION_ID, notification)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Download Progress",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = applicationContext.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    companion object {
        const val KEY_TASK_ID = "task_id"
        private const val CHANNEL_ID = "download_channel"
        private const val NOTIFICATION_ID = 1002

        fun buildRequest(taskId: Long): OneTimeWorkRequest {
            return OneTimeWorkRequestBuilder<DownloadWorker>()
                .setInputData(workDataOf(KEY_TASK_ID to taskId))
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, java.util.concurrent.TimeUnit.SECONDS)
                .build()
        }
    }
}

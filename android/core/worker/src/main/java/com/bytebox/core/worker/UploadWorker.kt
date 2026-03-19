package com.bytebox.core.worker

import android.content.pm.ServiceInfo
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.net.Uri
import android.os.Build
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
import com.bytebox.core.common.Constants
import com.bytebox.core.database.dao.UploadTaskDao
import com.bytebox.core.database.entity.UploadTaskEntity
import com.bytebox.core.network.api.ShareApi
import com.bytebox.core.network.api.UploadApi
import com.bytebox.core.network.dto.CompletePartRequest
import com.bytebox.core.network.dto.CreateShareRequest
import com.bytebox.core.network.dto.InitUploadRequest
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import timber.log.Timber
import java.util.concurrent.TimeUnit

@HiltWorker
class UploadWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val uploadApi: UploadApi,
    private val shareApi: ShareApi,
    private val uploadTaskDao: UploadTaskDao,
    private val okHttpClient: OkHttpClient,
    @javax.inject.Named("base_url") private val baseUrl: String
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val taskId = inputData.getLong(KEY_TASK_ID, -1)
        if (taskId == -1L) return Result.failure()

        val task = uploadTaskDao.getTaskById(taskId) ?: return Result.failure()

        createNotificationChannel()
        try {
            setForeground(createForegroundInfo(task.fileName, 0f))
        } catch (e: Exception) {
            Timber.w(e, "Could not set foreground — notification permission may be denied")
        }

        return withContext(Dispatchers.IO) {
            try {
                val uri = Uri.parse(task.localFileUri)
                if (task.fileSize <= Constants.SMALL_FILE_THRESHOLD) {
                    uploadSmallFile(taskId, uri, task)
                } else {
                    uploadChunkedFile(taskId, uri, task)
                }
            } catch (e: Exception) {
                Timber.e(e, "Upload failed for task $taskId")
                uploadTaskDao.markFailed(taskId, e.message ?: "Upload failed")
                Result.retry()
            }
        }
    }

    private suspend fun uploadSmallFile(taskId: Long, uri: Uri, task: UploadTaskEntity): Result {
        uploadTaskDao.updateProgress(taskId, "uploading", 0.5f, 0)
        try {
            setForeground(createForegroundInfo(task.fileName, 0.5f))
        } catch (e: Exception) {
            Timber.w(e, "Could not set foreground")
        }

        val inputStream = applicationContext.contentResolver.openInputStream(uri)
            ?: return Result.failure()
        val bytes = inputStream.use { it.readBytes() }

        val requestBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("file", task.fileName, bytes.toRequestBody(task.mimeType.toMediaType()))
            .apply { task.folderId?.let { addFormDataPart("folder_id", it) } }
            .build()

        val httpRequest = Request.Builder()
            .url("${getBaseUrl()}files/upload")
            .post(requestBody)
            .build()

        val httpResponse = okHttpClient.newCall(httpRequest).execute()
        return if (httpResponse.isSuccessful) {
            val responseBody = httpResponse.body?.string() ?: "{}"
            Timber.d("Upload response: $responseBody")
            val serverFileId = try {
                val json = org.json.JSONObject(responseBody)
                // Response may be wrapped: {"success":true,"data":{"id":"..."}} or flat {"id":"..."}
                val fileObj = if (json.has("data")) json.getJSONObject("data") else json
                if (fileObj.has("id")) fileObj.getString("id") else null
            } catch (e: Exception) {
                Timber.e(e, "Failed to parse upload response")
                null
            }
            Timber.d("Extracted serverFileId: $serverFileId")
            if (!serverFileId.isNullOrBlank()) {
                uploadTaskDao.updateServerFileId(taskId, serverFileId)
                if (task.sharePublicly) createShareLink(taskId, serverFileId)
            }
            uploadTaskDao.updateProgress(taskId, "completed", 1f, 1)
            try { uri.path?.let { java.io.File(it).delete() } } catch (_: Exception) {}
            Result.success()
        } else {
            uploadTaskDao.markFailed(taskId, "Upload failed: ${httpResponse.code}")
            Result.retry()
        }
    }

    private suspend fun uploadChunkedFile(taskId: Long, uri: Uri, task: UploadTaskEntity): Result {
        var sessionId = task.uploadSessionId
        var totalChunks = task.totalChunks
        var presignedUrls: List<String>

        if (sessionId == null) {
            val initResp = uploadApi.initUpload(
                InitUploadRequest(
                    filename = task.fileName,
                    fileSize = task.fileSize,
                    mimeType = task.mimeType,
                    folderId = task.folderId,
                    chunkSize = Constants.CHUNK_SIZE
                )
            )

            if (!initResp.isSuccessful()) {
                uploadTaskDao.markFailed(taskId, "Failed to init upload: ${initResp.code()}")
                return Result.retry()
            }

            val initBody = initResp.body()!!
            sessionId = initBody.uploadId
            totalChunks = initBody.totalChunks
            presignedUrls = initBody.presignedUrls

            uploadTaskDao.updateTask(task.copy(
                uploadSessionId = sessionId,
                totalChunks = totalChunks,
                status = "uploading"
            ))
        } else {
            val statusResp = uploadApi.getUploadStatus(sessionId)
            if (!statusResp.isSuccessful()) return Result.retry()
            presignedUrls = listOf()
        }

        val inputStream = applicationContext.contentResolver.openInputStream(uri)
            ?: return Result.failure()
        val chunkSize = Constants.CHUNK_SIZE
        var completedChunks = task.completedChunks

        inputStream.use { stream ->
            val buffer = ByteArray(chunkSize)
            var partNumber = 1

            while (true) {
                val bytesRead = stream.read(buffer)
                if (bytesRead == -1) break

                if (partNumber <= completedChunks) {
                    partNumber++
                    continue
                }

                val chunk = if (bytesRead < chunkSize) buffer.copyOf(bytesRead) else buffer.clone()

                if (partNumber <= presignedUrls.size) {
                    val httpRequest = Request.Builder()
                        .url(presignedUrls[partNumber - 1])
                        .put(chunk.toRequestBody("application/octet-stream".toMediaType()))
                        .build()

                    val httpResponse = okHttpClient.newCall(httpRequest).execute()
                    if (!httpResponse.isSuccessful) {
                        uploadTaskDao.markFailed(taskId, "Chunk $partNumber upload failed")
                        return Result.retry()
                    }

                    val etag = httpResponse.header("ETag") ?: ""
                    uploadApi.completePart(sessionId!!, CompletePartRequest(
                        partNumber = partNumber,
                        etag = etag,
                        size = bytesRead.toLong()
                    ))
                }

                completedChunks = partNumber
                val progress = completedChunks.toFloat() / totalChunks.toFloat()
                uploadTaskDao.updateProgress(taskId, "uploading", progress, completedChunks)
                try {
                    setForeground(createForegroundInfo(task.fileName, progress))
                } catch (e: Exception) {
                    Timber.w(e, "Could not set foreground")
                }

                partNumber++
            }
        }

        val finalResp = uploadApi.finalizeUpload(sessionId!!)
        return if (finalResp.isSuccessful()) {
            val serverFileId = try { finalResp.body()?.id } catch (_: Exception) { null }
            if (serverFileId != null) {
                uploadTaskDao.updateServerFileId(taskId, serverFileId)
                if (task.sharePublicly) createShareLink(taskId, serverFileId)
            }
            uploadTaskDao.updateProgress(taskId, "completed", 1f, totalChunks)
            try { uri.path?.let { java.io.File(it).delete() } } catch (_: Exception) {}
            Result.success()
        } else {
            uploadTaskDao.markFailed(taskId, "Finalize failed: ${finalResp.code()}")
            Result.retry()
        }
    }

    private suspend fun createShareLink(taskId: Long, fileId: String) {
        Timber.d("Creating share link for task=$taskId fileId=$fileId")
        try {
            val resp = shareApi.createShare(CreateShareRequest(fileId = fileId))
            Timber.d("Share API response: code=${resp.code()} body=${resp.body()} error=${resp.errorBody()?.string()}")
            if (resp.isSuccessful()) {
                val shareUrl = resp.body()?.shareUrl
                if (shareUrl != null) {
                    uploadTaskDao.updateShareUrl(taskId, shareUrl)
                    Timber.i("Share link created for task $taskId: $shareUrl")
                }
            } else {
                Timber.w("Failed to create share link: ${resp.code()}")
            }
        } catch (e: Exception) {
            Timber.w(e, "Could not create share link for task $taskId")
        }
    }

    private fun getBaseUrl(): String {
        return baseUrl
    }

    private fun createForegroundInfo(fileName: String, progress: Float): ForegroundInfo {
        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setContentTitle("Uploading")
            .setContentText(fileName)
            .setSmallIcon(android.R.drawable.ic_menu_upload)
            .setProgress(100, (progress * 100).toInt(), false)
            .setOngoing(true)
            .build()
        return ForegroundInfo(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Upload Progress", NotificationManager.IMPORTANCE_LOW
            )
            applicationContext.getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }
    }

    companion object {
        const val KEY_TASK_ID = "task_id"
        private const val CHANNEL_ID = "upload_channel"
        private const val NOTIFICATION_ID = 1001

        fun buildRequest(taskId: Long): OneTimeWorkRequest {
            return OneTimeWorkRequestBuilder<UploadWorker>()
                .setInputData(workDataOf(KEY_TASK_ID to taskId))
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
                .build()
        }
    }
}

private fun <T> retrofit2.Response<T>.isSuccessful(): Boolean = isSuccessful

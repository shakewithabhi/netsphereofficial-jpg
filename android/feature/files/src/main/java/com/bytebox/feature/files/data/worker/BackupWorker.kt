package com.bytebox.feature.files.data.worker

import android.content.Context
import android.provider.MediaStore
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.bytebox.core.database.dao.UploadTaskDao
import com.bytebox.core.database.entity.UploadTaskEntity
import com.bytebox.core.datastore.UserPreferences
import com.bytebox.core.network.api.FileApi
import com.bytebox.core.network.dto.CreateFolderRequest
import com.bytebox.core.worker.UploadWorker
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import timber.log.Timber

@HiltWorker
class BackupWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val fileApi: FileApi,
    private val userPreferences: UserPreferences,
    private val uploadTaskDao: UploadTaskDao
) : CoroutineWorker(context, params) {

    companion object {
        const val WORK_NAME = "camera_backup"
        private const val BACKUP_FOLDER_NAME = "Camera Backup"
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val enabled = userPreferences.autoUploadEnabled.first()
            if (!enabled) return@withContext Result.success()

            val lastBackupTime = userPreferences.lastAutoUploadTimestamp.first()

            // Query new photos/videos since last backup
            val newMedia = getNewMedia(lastBackupTime)
            if (newMedia.isEmpty()) {
                Timber.d("No new media files to back up")
                return@withContext Result.success()
            }

            Timber.d("Found ${newMedia.size} new media files to back up")

            // Ensure backup folder exists
            val folderId = getOrCreateBackupFolder()

            val workManager = WorkManager.getInstance(applicationContext)
            var latestTime = lastBackupTime

            for (media in newMedia) {
                try {
                    val uri = android.net.Uri.parse(media.uri)

                    val task = UploadTaskEntity(
                        localFileUri = uri.toString(),
                        fileName = media.displayName,
                        fileSize = media.size,
                        mimeType = media.mimeType,
                        folderId = folderId,
                        uploadSessionId = null,
                        status = "pending"
                    )

                    val taskId = uploadTaskDao.insertTask(task)
                    val uploadRequest = UploadWorker.buildRequest(taskId)
                    workManager.enqueue(uploadRequest)

                    if (media.dateAdded > latestTime) {
                        latestTime = media.dateAdded
                    }
                } catch (e: Exception) {
                    Timber.w(e, "Failed to queue backup for ${media.displayName}")
                    // Skip failed files, continue with others
                }
            }

            userPreferences.setLastAutoUploadTimestamp(latestTime)
            Result.success()
        } catch (e: Exception) {
            Timber.e(e, "Camera backup failed")
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }

    private data class MediaFile(
        val uri: String,
        val displayName: String,
        val mimeType: String,
        val size: Long,
        val dateAdded: Long
    )

    private fun getNewMedia(sinceTime: Long): List<MediaFile> {
        val media = mutableListOf<MediaFile>()
        val projection = arrayOf(
            MediaStore.MediaColumns._ID,
            MediaStore.MediaColumns.DISPLAY_NAME,
            MediaStore.MediaColumns.MIME_TYPE,
            MediaStore.MediaColumns.SIZE,
            MediaStore.MediaColumns.DATE_ADDED
        )
        val sinceSeconds = (sinceTime / 1000).toString()

        // Query images
        queryMedia(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            projection,
            sinceSeconds,
            "image/jpeg",
            media
        )

        // Query videos
        queryMedia(
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
            projection,
            sinceSeconds,
            "video/mp4",
            media
        )

        return media.sortedBy { it.dateAdded }
    }

    private fun queryMedia(
        contentUri: android.net.Uri,
        projection: Array<String>,
        sinceSeconds: String,
        defaultMimeType: String,
        results: MutableList<MediaFile>
    ) {
        applicationContext.contentResolver.query(
            contentUri,
            projection,
            "${MediaStore.MediaColumns.DATE_ADDED} > ?",
            arrayOf(sinceSeconds),
            "${MediaStore.MediaColumns.DATE_ADDED} ASC"
        )?.use { cursor ->
            val idCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
            val nameCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
            val mimeCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.MIME_TYPE)
            val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE)
            val dateCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED)

            while (cursor.moveToNext()) {
                val id = cursor.getLong(idCol)
                val displayName = cursor.getString(nameCol) ?: "unknown"
                val mimeType = cursor.getString(mimeCol) ?: defaultMimeType
                val size = cursor.getLong(sizeCol)
                val dateAdded = cursor.getLong(dateCol) * 1000 // Convert to millis

                val uri = android.content.ContentUris.withAppendedId(contentUri, id).toString()
                results.add(MediaFile(uri, displayName, mimeType, size, dateAdded))
            }
        }
    }

    private suspend fun getOrCreateBackupFolder(): String? {
        // Check if we already have a folder ID stored
        val existingId = userPreferences.autoUploadFolderId.first()
        if (existingId != null) return existingId

        return try {
            val response = fileApi.createFolder(
                CreateFolderRequest(name = BACKUP_FOLDER_NAME, parentId = null)
            )
            if (response.isSuccessful) {
                val folderId = response.body()?.id
                if (folderId != null) {
                    userPreferences.setAutoUploadFolderId(folderId)
                }
                folderId
            } else {
                Timber.w("Failed to create backup folder: ${response.code()}")
                null
            }
        } catch (e: Exception) {
            Timber.w(e, "Could not create backup folder")
            null
        }
    }
}

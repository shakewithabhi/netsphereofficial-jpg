package com.bytebox.core.worker

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkerParameters
import com.bytebox.core.database.dao.PendingOperationDao
import com.bytebox.core.network.api.FileApi
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import timber.log.Timber
import java.util.concurrent.TimeUnit

@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val pendingOperationDao: PendingOperationDao,
    private val fileApi: FileApi
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val pendingOps = pendingOperationDao.getPending()
        if (pendingOps.isEmpty()) return@withContext Result.success()

        var hasFailures = false

        for (op in pendingOps) {
            if (op.retryCount >= MAX_RETRIES) {
                Timber.w("Skipping operation ${op.id} — max retries reached")
                continue
            }

            pendingOperationDao.markSyncing(op.id)

            try {
                val success = when (op.operationType) {
                    "TRASH" -> fileApi.trashFile(op.fileId).isSuccessful
                    "RESTORE" -> fileApi.restoreFile(op.fileId).isSuccessful
                    "DELETE" -> fileApi.permanentDeleteFile(op.fileId).isSuccessful
                    "RENAME" -> {
                        val payload = op.payload?.let { JSONObject(it) }
                        val newName = payload?.optString("name") ?: ""
                        if (newName.isNotEmpty()) {
                            // Rename is done via folder rename or file rename depending on type
                            val isFolder = payload?.optBoolean("isFolder", false) ?: false
                            if (isFolder) {
                                fileApi.renameFolder(
                                    op.fileId,
                                    com.bytebox.core.network.dto.RenameFolderRequest(newName)
                                ).isSuccessful
                            } else {
                                // File rename not yet in API — mark as failed
                                false
                            }
                        } else false
                    }
                    "MOVE" -> {
                        // Move API not yet available — mark as failed for manual retry
                        Timber.w("MOVE operation not yet supported via API")
                        false
                    }
                    else -> {
                        Timber.w("Unknown operation type: ${op.operationType}")
                        false
                    }
                }

                if (success) {
                    pendingOperationDao.delete(op.id)
                    Timber.d("Synced operation ${op.id} (${op.operationType})")
                } else {
                    pendingOperationDao.markFailed(op.id)
                    hasFailures = true
                    Timber.w("Failed to sync operation ${op.id}")
                }
            } catch (e: Exception) {
                Timber.e(e, "Error syncing operation ${op.id}")
                pendingOperationDao.markFailed(op.id)
                hasFailures = true
            }
        }

        if (hasFailures) Result.retry() else Result.success()
    }

    companion object {
        private const val MAX_RETRIES = 5
        const val WORK_NAME = "sync_pending_operations"

        fun buildRequest(): OneTimeWorkRequest {
            return OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
        }
    }
}

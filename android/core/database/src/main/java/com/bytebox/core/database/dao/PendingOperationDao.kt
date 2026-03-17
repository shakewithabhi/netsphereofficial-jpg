package com.bytebox.core.database.dao

import androidx.room.*
import com.bytebox.core.database.entity.PendingOperationEntity

@Dao
interface PendingOperationDao {

    @Insert
    suspend fun insert(operation: PendingOperationEntity): Long

    @Query("SELECT * FROM pending_operations WHERE status = 'PENDING' ORDER BY created_at ASC")
    suspend fun getPending(): List<PendingOperationEntity>

    @Query("UPDATE pending_operations SET status = 'SYNCING' WHERE id = :id")
    suspend fun markSyncing(id: Long)

    @Query("UPDATE pending_operations SET status = 'FAILED', retry_count = retry_count + 1 WHERE id = :id")
    suspend fun markFailed(id: Long)

    @Query("DELETE FROM pending_operations WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("DELETE FROM pending_operations")
    suspend fun deleteAll()
}

package com.bytebox.core.database.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pending_operations")
data class PendingOperationEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "operation_type") val operationType: String, // RENAME, DELETE, MOVE, TRASH, RESTORE
    @ColumnInfo(name = "file_id") val fileId: String,
    val payload: String? = null, // JSON string for extra data
    val status: String = "PENDING", // PENDING, SYNCING, FAILED
    @ColumnInfo(name = "retry_count") val retryCount: Int = 0,
    @ColumnInfo(name = "created_at") val createdAt: Long = System.currentTimeMillis()
)

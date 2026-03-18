package com.bytebox.core.database.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pinned_files")
data class PinnedFileEntity(
    @PrimaryKey val id: String,
    val name: String,
    @ColumnInfo(name = "mime_type") val mimeType: String,
    val size: Long,
    @ColumnInfo(name = "local_path") val localPath: String,
    @ColumnInfo(name = "pinned_at") val pinnedAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "last_synced") val lastSynced: Long = System.currentTimeMillis()
)

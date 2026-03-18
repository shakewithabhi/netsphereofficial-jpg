package com.bytebox.core.database.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_files")
data class CachedFileEntity(
    @PrimaryKey val id: String,
    val name: String,
    @ColumnInfo(name = "folder_id") val folderId: String?,
    val size: Long,
    @ColumnInfo(name = "mime_type") val mimeType: String,
    @ColumnInfo(name = "thumbnail_url") val thumbnailUrl: String?,
    @ColumnInfo(name = "scan_status") val scanStatus: String,
    @ColumnInfo(name = "trashed_at") val trashedAt: String?,
    @ColumnInfo(name = "created_at") val createdAt: String,
    @ColumnInfo(name = "updated_at") val updatedAt: String,
    @ColumnInfo(name = "is_starred", defaultValue = "0") val isStarred: Boolean = false
)

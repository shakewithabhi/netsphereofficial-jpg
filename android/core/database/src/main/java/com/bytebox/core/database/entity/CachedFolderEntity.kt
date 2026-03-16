package com.bytebox.core.database.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_folders")
data class CachedFolderEntity(
    @PrimaryKey val id: String,
    val name: String,
    @ColumnInfo(name = "parent_id") val parentId: String?,
    val path: String,
    @ColumnInfo(name = "trashed_at") val trashedAt: String?,
    @ColumnInfo(name = "created_at") val createdAt: String,
    @ColumnInfo(name = "updated_at") val updatedAt: String
)

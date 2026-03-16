package com.bytebox.core.database.dao

import androidx.room.*
import com.bytebox.core.database.entity.CachedFolderEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface FolderDao {

    @Query("SELECT * FROM cached_folders WHERE parent_id = :parentId AND trashed_at IS NULL ORDER BY name ASC")
    fun getFoldersByParent(parentId: String?): Flow<List<CachedFolderEntity>>

    @Query("SELECT * FROM cached_folders WHERE trashed_at IS NOT NULL ORDER BY trashed_at DESC")
    fun getTrashedFolders(): Flow<List<CachedFolderEntity>>

    @Query("SELECT * FROM cached_folders WHERE id = :id")
    suspend fun getFolderById(id: String): CachedFolderEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFolders(folders: List<CachedFolderEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFolder(folder: CachedFolderEntity)

    @Delete
    suspend fun deleteFolder(folder: CachedFolderEntity)

    @Query("DELETE FROM cached_folders")
    suspend fun deleteAll()
}

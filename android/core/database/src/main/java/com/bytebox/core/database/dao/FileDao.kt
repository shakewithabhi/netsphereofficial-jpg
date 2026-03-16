package com.bytebox.core.database.dao

import androidx.room.*
import com.bytebox.core.database.entity.CachedFileEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface FileDao {

    @Query("SELECT * FROM cached_files WHERE folder_id = :folderId AND trashed_at IS NULL ORDER BY name ASC")
    fun getFilesByFolder(folderId: String?): Flow<List<CachedFileEntity>>

    @Query("SELECT * FROM cached_files WHERE trashed_at IS NOT NULL ORDER BY trashed_at DESC")
    fun getTrashedFiles(): Flow<List<CachedFileEntity>>

    @Query("SELECT * FROM cached_files WHERE id = :id")
    suspend fun getFileById(id: String): CachedFileEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFiles(files: List<CachedFileEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFile(file: CachedFileEntity)

    @Delete
    suspend fun deleteFile(file: CachedFileEntity)

    @Query("DELETE FROM cached_files WHERE folder_id = :folderId")
    suspend fun deleteFilesByFolder(folderId: String?)

    @Query("DELETE FROM cached_files")
    suspend fun deleteAll()
}

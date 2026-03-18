package com.bytebox.core.database.dao

import androidx.room.*
import com.bytebox.core.database.entity.PinnedFileEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PinnedFileDao {
    @Query("SELECT * FROM pinned_files ORDER BY pinned_at DESC")
    fun getAllPinnedFiles(): Flow<List<PinnedFileEntity>>

    @Query("SELECT * FROM pinned_files WHERE id = :id")
    suspend fun getPinnedFile(id: String): PinnedFileEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPinnedFile(file: PinnedFileEntity)

    @Delete
    suspend fun deletePinnedFile(file: PinnedFileEntity)

    @Query("DELETE FROM pinned_files WHERE id = :id")
    suspend fun deletePinnedFileById(id: String)

    @Query("SELECT EXISTS(SELECT 1 FROM pinned_files WHERE id = :id)")
    suspend fun isFilePinned(id: String): Boolean
}

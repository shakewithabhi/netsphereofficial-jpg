package com.bytebox.core.database

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.bytebox.core.database.dao.*
import com.bytebox.core.database.entity.*

@Database(
    entities = [
        CachedFileEntity::class,
        CachedFolderEntity::class,
        UploadTaskEntity::class,
        DownloadTaskEntity::class,
        PendingOperationEntity::class
    ],
    version = 4,
    exportSchema = false
)
abstract class ByteBoxDatabase : RoomDatabase() {
    abstract fun fileDao(): FileDao
    abstract fun folderDao(): FolderDao
    abstract fun uploadTaskDao(): UploadTaskDao
    abstract fun downloadTaskDao(): DownloadTaskDao
    abstract fun pendingOperationDao(): PendingOperationDao

    companion object {
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE upload_tasks ADD COLUMN server_file_id TEXT")
            }
        }
        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE upload_tasks ADD COLUMN share_url TEXT")
            }
        }
        val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """CREATE TABLE IF NOT EXISTS pending_operations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                        operation_type TEXT NOT NULL,
                        file_id TEXT NOT NULL,
                        payload TEXT,
                        status TEXT NOT NULL DEFAULT 'PENDING',
                        retry_count INTEGER NOT NULL DEFAULT 0,
                        created_at INTEGER NOT NULL
                    )"""
                )
            }
        }
    }
}

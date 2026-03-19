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
        PendingOperationEntity::class,
        PinnedFileEntity::class
    ],
    version = 7,
    exportSchema = false
)
abstract class ByteBoxDatabase : RoomDatabase() {
    abstract fun fileDao(): FileDao
    abstract fun folderDao(): FolderDao
    abstract fun uploadTaskDao(): UploadTaskDao
    abstract fun downloadTaskDao(): DownloadTaskDao
    abstract fun pendingOperationDao(): PendingOperationDao
    abstract fun pinnedFileDao(): PinnedFileDao

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
        val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE cached_files ADD COLUMN is_starred INTEGER NOT NULL DEFAULT 0")
            }
        }
        val MIGRATION_5_6 = object : Migration(5, 6) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """CREATE TABLE IF NOT EXISTS pinned_files (
                        id TEXT NOT NULL PRIMARY KEY,
                        name TEXT NOT NULL,
                        mime_type TEXT NOT NULL,
                        size INTEGER NOT NULL,
                        local_path TEXT NOT NULL,
                        pinned_at INTEGER NOT NULL,
                        last_synced INTEGER NOT NULL
                    )"""
                )
            }
        }
        val MIGRATION_6_7 = object : Migration(6, 7) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE upload_tasks ADD COLUMN share_publicly INTEGER NOT NULL DEFAULT 0")
            }
        }
    }
}

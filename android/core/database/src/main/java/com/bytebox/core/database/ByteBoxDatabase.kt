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
        DownloadTaskEntity::class
    ],
    version = 3,
    exportSchema = false
)
abstract class ByteBoxDatabase : RoomDatabase() {
    abstract fun fileDao(): FileDao
    abstract fun folderDao(): FolderDao
    abstract fun uploadTaskDao(): UploadTaskDao
    abstract fun downloadTaskDao(): DownloadTaskDao

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
    }
}

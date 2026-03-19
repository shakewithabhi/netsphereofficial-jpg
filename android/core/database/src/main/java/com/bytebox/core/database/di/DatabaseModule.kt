package com.bytebox.core.database.di

import android.content.Context
import androidx.room.Room
import com.bytebox.core.database.ByteBoxDatabase
import com.bytebox.core.database.dao.*
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): ByteBoxDatabase =
        Room.databaseBuilder(
            context,
            ByteBoxDatabase::class.java,
            "bytebox.db"
        ).addMigrations(
            ByteBoxDatabase.MIGRATION_1_2,
            ByteBoxDatabase.MIGRATION_2_3,
            ByteBoxDatabase.MIGRATION_3_4,
            ByteBoxDatabase.MIGRATION_4_5,
            ByteBoxDatabase.MIGRATION_5_6,
            ByteBoxDatabase.MIGRATION_6_7
        ).fallbackToDestructiveMigration().build()

    @Provides fun provideFileDao(db: ByteBoxDatabase): FileDao = db.fileDao()
    @Provides fun provideFolderDao(db: ByteBoxDatabase): FolderDao = db.folderDao()
    @Provides fun provideUploadTaskDao(db: ByteBoxDatabase): UploadTaskDao = db.uploadTaskDao()
    @Provides fun provideDownloadTaskDao(db: ByteBoxDatabase): DownloadTaskDao = db.downloadTaskDao()
    @Provides fun providePendingOperationDao(db: ByteBoxDatabase): PendingOperationDao = db.pendingOperationDao()
    @Provides fun providePinnedFileDao(db: ByteBoxDatabase): PinnedFileDao = db.pinnedFileDao()
}

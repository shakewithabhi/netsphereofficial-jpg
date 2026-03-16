package com.bytebox.feature.upload.data.di

import com.bytebox.domain.repository.UploadRepository
import com.bytebox.feature.upload.data.UploadRepositoryImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class UploadModule {

    @Binds
    @Singleton
    abstract fun bindUploadRepository(impl: UploadRepositoryImpl): UploadRepository
}

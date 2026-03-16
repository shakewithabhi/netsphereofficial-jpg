package com.bytebox.feature.files.data.di

import com.bytebox.domain.repository.FileRepository
import com.bytebox.feature.files.data.repository.FileRepositoryImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class FileModule {

    @Binds
    @Singleton
    abstract fun bindFileRepository(impl: FileRepositoryImpl): FileRepository
}
